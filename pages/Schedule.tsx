
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../AppContext';
import { Shift, ScheduleEvent, User, ShiftTimes } from '../types';
import { suggestInstructor } from '../geminiService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type ViewMode = 'DAY' | 'WEEK' | 'MONTH';
type RecurrenceMode = 'CONSECUTIVE' | 'SPECIFIC_DAYS';

const Schedule: React.FC = () => {
  const { 
    users, groups, courses, rooms, events, 
    addEvent, updateEvent, deleteEvent, 
    technicalCompetencies, activityCategories,
    getCalendarEvent, customLogo, customFont, reportBackground,
    currentUser 
  } = useApp();

  const isInstructor = currentUser?.role === 'INSTRUCTOR';

  // --- STATE DE NAVEGAÇÃO E FILTROS DO CALENDÁRIO ---
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [viewMode, setViewMode] = useState<ViewMode>('WEEK');
  
  const [filterClassGroupId, setFilterClassGroupId] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterRoomId, setFilterRoomId] = useState('');
  const [filterInstructorId, setFilterInstructorId] = useState(isInstructor && currentUser ? currentUser.id : '');

  // --- STATE DO FORMULÁRIO DE AGENDAMENTO ---
  const [isFormOpen, setIsFormOpen] = useState(false); 
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  
  // --- STATE DO MODAL DE EXPORTAÇÃO ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
    classGroupId: '',
    instructorId: isInstructor && currentUser ? currentUser.id : ''
  });
  
  // Recurrence States
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('CONSECUTIVE');
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([]); // 0=Dom, 1=Seg...
  const [durationDays, setDurationDays] = useState(1);
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [skippedHolidays, setSkippedHolidays] = useState<{date: string, title: string}[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    type: 'AULA',
    subject: '',
    date: new Date().toISOString().split('T')[0],
    shift: Shift.NOITE,
    instructorId: '',
    roomId: '',
    classGroupId: ''
  });

  const weekDaysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Identifica quais dias são permitidos com base na turma selecionada e se é EAD
  const allowedWeekDays = useMemo(() => {
      if (formData.type === 'AULA') {
          // REGRA 1: Se for matéria EAD, só permite SEXTA-FEIRA (5)
          if (formData.subject && formData.subject.startsWith('EAD -')) {
              return [5];
          }

          // REGRA 2: Se for aula normal, respeita os dias da turma
          if (formData.classGroupId) {
              const group = groups.find(g => g.id === formData.classGroupId);
              // Se a turma tem dias definidos, retorna eles. Se não (array vazio), permite todos.
              if (group && group.weekDays && group.weekDays.length > 0) {
                  return group.weekDays;
              }
          }
      }
      return null; // Null significa "todos permitidos"
  }, [formData.type, formData.classGroupId, formData.subject, groups]);

  // Calcula o MÁXIMO de dias permitidos com base na carga horária da UC e aulas JÁ AGENDADAS
  const maxSubjectDays = useMemo(() => {
    if (formData.type !== 'AULA' || !formData.subject || !formData.classGroupId) return 365;

    const group = groups.find(g => g.id === formData.classGroupId);
    const course = courses.find(c => c.id === group?.courseId);
    const subjectInfo = course?.subjects.find(s => s.name === formData.subject);

    if (group && subjectInfo) {
        // Horas por dia baseado na configuração da turma
        // 4 aulas = 4h; 5 aulas = 3.75h; 6 aulas = 5h
        let hoursPerDay = 3.75;
        if (group.classesPerDay === 4) hoursPerDay = 4.0;
        else if (group.classesPerDay === 6) hoursPerDay = 5.0;
        else hoursPerDay = group.classesPerDay * 0.75;

        // Total de dias necessários para cobrir a carga horária
        const totalDaysNeeded = Math.ceil(subjectInfo.hours / hoursPerDay);

        // Contabiliza aulas já agendadas para esta turma e matéria
        const scheduledCount = events.filter(e => 
            e.classGroupId === formData.classGroupId && 
            e.subject === formData.subject && 
            e.type === 'AULA' &&
            e.id !== editingEventId // Exclui o evento atual se estiver editando
        ).length;

        const remaining = totalDaysNeeded - scheduledCount;
        return remaining > 0 ? remaining : 0;
    }
    return 365;
  }, [formData.type, formData.subject, formData.classGroupId, groups, courses, events, editingEventId]);

  // Toggle week day selection (Com restrição baseada na turma)
  const toggleWeekDay = (dayIndex: number) => {
    // Se houver restrição e o dia clicado não estiver nela, impede a ação
    if (allowedWeekDays !== null && !allowedWeekDays.includes(dayIndex)) {
        return;
    }

    if (selectedWeekDays.includes(dayIndex)) {
      setSelectedWeekDays(selectedWeekDays.filter(d => d !== dayIndex));
    } else {
      setSelectedWeekDays([...selectedWeekDays, dayIndex].sort());
    }
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEventId(null);
    setPreviewDates([]);
    setSkippedHolidays([]);
    setDurationDays(1);
    setRecurrenceMode('CONSECUTIVE');
    setFormData(prev => ({ ...prev, title: '', subject: '', instructorId: '', roomId: '', classGroupId: '' }));
    setAiSuggestions([]);
    setSelectedWeekDays([]);
  };

  // Auto-calculate duration based on Subject Hours and Group Config
  useEffect(() => {
    if (formData.type === 'AULA' && formData.subject && formData.classGroupId) {
        // Usa o valor calculado pelo useMemo para definir a duração inicial sugerida
        // Só define se não estiver editando um evento existente
        if (!editingEventId) {
            setDurationDays(maxSubjectDays);
        }
            
        // Configuração automática de dias da semana baseada na turma e tipo de aula
        if (formData.subject.startsWith('EAD -')) {
            // REGRA EAD: Força modo dias específicos e seleciona Sexta (5)
            setRecurrenceMode('SPECIFIC_DAYS');
            setSelectedWeekDays([5]);
        } else {
            const group = groups.find(g => g.id === formData.classGroupId);
            if (group && group.weekDays && group.weekDays.length > 0) {
                setRecurrenceMode('SPECIFIC_DAYS');
                setSelectedWeekDays(group.weekDays); // Pré-seleciona todos os dias da turma
            } else {
                setRecurrenceMode('CONSECUTIVE'); // Default if no specific days
            }
        }
    }
  }, [formData.subject, formData.classGroupId, formData.type, maxSubjectDays, groups, editingEventId]);

  // Generate Date Preview (Com Pulo de Feriados)
  useEffect(() => {
    // Se o maxSubjectDays for 0 (UC concluída) e estamos criando, zera preview
    if (!editingEventId && maxSubjectDays === 0 && formData.type === 'AULA' && formData.subject) {
        setPreviewDates([]);
        setSkippedHolidays([]);
        return;
    }

    if (durationDays <= 0) {
        setPreviewDates([]);
        setSkippedHolidays([]);
        return;
    }

    const generated: string[] = [];
    const skipped: {date: string, title: string}[] = [];
    
    // Se for edição, não gera preview múltiplo, apenas usa a data do form
    if (editingEventId) {
        setPreviewDates([]); 
        setSkippedHolidays([]);
        return;
    }

    const start = new Date(formData.date + 'T00:00:00');
    let current = new Date(start);
    let count = 0;
    
    // Safety break to prevent infinite loops
    let loops = 0; 

    while (count < durationDays && loops < 730) { // Aumentado limite de loops para garantir agendamento em turmas com poucos dias na semana
        loops++;
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        
        let matchesPattern = true;

        if (recurrenceMode === 'SPECIFIC_DAYS') {
            if (selectedWeekDays.length > 0 && !selectedWeekDays.includes(dayOfWeek)) {
                matchesPattern = false;
            }
        }

        if (matchesPattern) {
            // Verifica se é feriado/não letivo
            const holiday = getCalendarEvent(dateStr);
            
            if (holiday && holiday.isDayOff) {
                // É feriado: PULA (Não incrementa count, registra pulo)
                skipped.push({ date: dateStr, title: holiday.title });
            } else {
                // É dia letivo: Agenda
                generated.push(dateStr);
                count++;
            }
        }
        
        // Next day
        current.setDate(current.getDate() + 1);
    }
    setPreviewDates(generated);
    setSkippedHolidays(skipped);

  }, [formData.date, durationDays, recurrenceMode, selectedWeekDays, getCalendarEvent, editingEventId, maxSubjectDays, formData.type, formData.subject]);


  // --- HELPERS DE CALENDÁRIO ---
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); 
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const getWeekDays = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(d.setDate(diff));
    const week = [];
    const startObj = new Date(date);
    startObj.setDate(date.getDate() - date.getDay()); 
    for (let i = 0; i < 7; i++) {
        const wDay = new Date(startObj);
        wDay.setDate(startObj.getDate() + i);
        week.push(wDay);
    }
    return week;
  };

  const formattedCurrentDateRange = useMemo(() => {
      const d = currentDate;
      if (viewMode === 'DAY') return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (viewMode === 'MONTH') return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const week = getWeekDays(d);
      const start = week[0];
      const end = week[6];
      return `${start.getDate()}/${start.getMonth()+1} a ${end.getDate()}/${end.getMonth()+1}`;
  }, [currentDate, viewMode]);

  const navigateDate = (direction: number) => {
      const newDate = new Date(currentDate);
      if (viewMode === 'DAY') newDate.setDate(newDate.getDate() + direction);
      if (viewMode === 'WEEK') newDate.setDate(newDate.getDate() + (direction * 7));
      if (viewMode === 'MONTH') newDate.setMonth(newDate.getMonth() + direction);
      setCurrentDate(newDate);
      if (viewMode === 'DAY') setFormData(prev => ({...prev, date: newDate.toISOString().split('T')[0]}));
  };

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
        if (e.type === 'LAB_USO') return false;
        if (filterClassGroupId && e.classGroupId !== filterClassGroupId) return false;
        if (filterShift && e.shift !== filterShift) return false;
        if (filterRoomId && e.roomId !== filterRoomId) return false;
        if (filterInstructorId && e.instructorId !== filterInstructorId) return false;

        const eventDateStr = e.date;
        if (viewMode === 'DAY') return eventDateStr === currentDate.toISOString().split('T')[0];
        if (viewMode === 'WEEK') {
            const week = getWeekDays(currentDate);
            return eventDateStr >= week[0].toISOString().split('T')[0] && eventDateStr <= week[6].toISOString().split('T')[0];
        }
        if (viewMode === 'MONTH') {
             const d = new Date(e.date + 'T00:00:00');
             return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
        }
        return true;
    });
  }, [events, viewMode, currentDate, filterClassGroupId, filterShift, filterRoomId, filterInstructorId]);

  const handleAiSuggest = useCallback(async () => {
    if (!formData.subject || formData.type !== 'AULA') return;
    setIsLoadingSuggestion(true);
    
    const instructorLoads: Record<string, number> = {};
    events.forEach(e => {
       instructorLoads[e.instructorId] = (instructorLoads[e.instructorId] || 0) + (e.type === 'AULA' ? 4 : 1);
    });

    const context = {
        busyInstructorIds: events
            .filter(e => e.date === formData.date && e.shift === formData.shift)
            .map(e => e.instructorId),
        instructorLoads,
        requiredCompetencyIds: [] as string[],
        allCompetencies: technicalCompetencies
    };
    
    const group = groups.find(g => g.id === formData.classGroupId);
    const course = courses.find(c => c.id === group?.courseId);
    const subjectInfo = course?.subjects.find(s => s.name === formData.subject);
    context.requiredCompetencyIds = subjectInfo?.competencyIds || [];

    const suggestions = await suggestInstructor(formData.subject, users, context);
    setAiSuggestions(suggestions);
    setIsLoadingSuggestion(false);
  }, [formData.subject, formData.date, formData.shift, formData.classGroupId, formData.type, groups, courses, events, users, technicalCompetencies]);

  useEffect(() => {
    const timer = setTimeout(() => {
        if (formData.subject && formData.date && formData.shift && formData.type === 'AULA' && process.env.API_KEY) {
            handleAiSuggest();
        }
    }, 800);
    return () => clearTimeout(timer);
  }, [formData.subject, formData.date, formData.shift, formData.classGroupId, formData.type, handleAiSuggest]);

  const enrichedInstructors = useMemo(() => {
    if (formData.type !== 'AULA') {
        return users
            .filter(u => u.role === 'INSTRUCTOR')
            .map(u => ({
                ...u,
                isBusy: false,
                hasCompetence: true,
                load: 0,
                capacity: 0
            }));
    }

    const targetDate = previewDates.length > 0 ? previewDates[0] : formData.date;
    const group = groups.find(g => g.id === formData.classGroupId);
    const course = courses.find(c => c.id === group?.courseId);
    const subjectInfo = course?.subjects.find(s => s.name === formData.subject);
    const requiredCompetencies = subjectInfo?.competencyIds || [];

    const busyInstructorIds = events
      .filter(e => e.date === targetDate && e.shift === formData.shift && e.id !== editingEventId)
      .map(e => e.instructorId);

    const instructorLoads: Record<string, number> = {};
    events.forEach(e => {
       instructorLoads[e.instructorId] = (instructorLoads[e.instructorId] || 0) + (e.type === 'AULA' ? 4 : 1);
    });
    
    return users
      .filter(u => u.role === 'INSTRUCTOR')
      .map(u => {
        const isBusy = busyInstructorIds.includes(u.id);
        const hasCompetence = requiredCompetencies.length > 0 
          ? requiredCompetencies.some(rc => u.competencyIds?.includes(rc))
          : true; 
        const load = instructorLoads[u.id] || 0;
        let capacity = 176; 
        if (u.workloadId && u.workloadId.includes('w1')) capacity = 88; 
        if (u.workloadId && u.workloadId.includes('w3')) capacity = 0; 

        return { ...u, isBusy, hasCompetence, load, capacity };
      })
      .sort((a, b) => {
        if (aiSuggestions.includes(a.id) && !aiSuggestions.includes(b.id)) return -1;
        if (!aiSuggestions.includes(a.id) && aiSuggestions.includes(b.id)) return 1;
        if (a.isBusy !== b.isBusy) return a.isBusy ? 1 : -1;
        if (a.hasCompetence !== b.hasCompetence) return a.hasCompetence ? -1 : 1;
        return a.load - b.load;
      });
  }, [previewDates, formData.date, formData.shift, formData.subject, formData.classGroupId, formData.type, groups, courses, events, users, editingEventId, aiSuggestions]);

  // Verificação de Bloqueios de Calendário (Feriados)
  const holidayCheck = useMemo(() => {
    // 1. Edição Simples (Bloqueio Total)
    if (editingEventId) {
        const h = getCalendarEvent(formData.date);
        if (h && h.isDayOff) {
            return { 
                hasConflict: true, 
                isBlocking: true, // Impede salvar
                title: h.title, 
                dates: [formData.date] 
            };
        }
        return { hasConflict: false, isBlocking: false, title: '', dates: [] };
    }
    
    // 2. Criação (Os feriados já foram pulados na geração do previewDates)
    // Então aqui verificamos se houve dias pulados para exibir o aviso informativo
    if (skippedHolidays.length > 0) {
        return {
            hasConflict: true,
            isBlocking: false,
            title: 'Recesso/Feriado',
            dates: skippedHolidays.map(s => s.date),
            details: skippedHolidays
        };
    }

    return { hasConflict: false, isBlocking: false, title: '', dates: [] };
  }, [formData.date, editingEventId, skippedHolidays, getCalendarEvent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInstructor) return; // Segurança extra
    
    // Validação de Edição Única (Bloqueio Rígido)
    if (editingEventId && holidayCheck.isBlocking) {
        alert(`Data bloqueada: ${holidayCheck.title}. Escolha outra data.`);
        return;
    }

    if (!formData.title || !formData.date || (!formData.instructorId && formData.type === 'AULA')) {
        alert("Preencha os campos obrigatórios.");
        return;
    }

    // Validação de limite de dias para UC (Nova regra)
    if (!editingEventId && formData.type === 'AULA' && maxSubjectDays === 0) {
        alert("Esta Unidade Curricular já atingiu a carga horária máxima planejada. Não é possível agendar mais aulas.");
        return;
    }

    const eventBase = {
        title: formData.title,
        type: formData.type,
        subject: formData.type === 'AULA' ? formData.subject : undefined,
        shift: formData.shift,
        instructorId: formData.instructorId || (users.find(u => u.username === 'admin')?.id || '1'), 
        roomId: formData.roomId,
        classGroupId: formData.type === 'AULA' ? formData.classGroupId : undefined
    };

    if (editingEventId) {
        updateEvent({ id: editingEventId, date: formData.date, ...eventBase } as ScheduleEvent);
    } else {
        if (previewDates.length === 0) {
             alert("Nenhuma data válida para agendamento. Verifique se a UC já foi concluída ou se as datas coincidem com feriados.");
             return;
        }

        let added = 0;
        previewDates.forEach(d => {
            const ok = addEvent({ ...eventBase, date: d } as any);
            if (ok) added++;
        });
        
        const msg = `${added} eventos criados.` + (skippedHolidays.length > 0 ? `\n(Nota: ${skippedHolidays.length} feriados foram pulados e a agenda foi estendida).` : '');
        alert(msg);
    }
    
    closeForm();
  };

  const handleEdit = (event: ScheduleEvent) => {
    // Instrutores não podem editar
    if (isInstructor) return;

    setFormData({
        title: event.title,
        type: event.type,
        subject: event.subject || '',
        date: event.date,
        shift: event.shift,
        instructorId: event.instructorId,
        roomId: event.roomId,
        classGroupId: event.classGroupId || ''
    });
    setEditingEventId(event.id);
    setDurationDays(1); // Reset duration on single edit
    setAiSuggestions([]);
    setIsFormOpen(true); // Abre a sidebar ao editar
  };

  const handleDelete = (id: string) => {
    if (isInstructor) return;
    if (window.confirm("Confirmar exclusão?")) {
        deleteEvent(id);
        if (editingEventId === id) closeForm();
    }
  };

  const handleStartScheduling = () => {
    closeForm(); // Reseta para limpo
    setIsFormOpen(true);
  };

  const renderEventCard = (ev: ScheduleEvent, minimal = false) => {
      const instructor = users.find(u => u.id === ev.instructorId);
      const room = rooms.find(r => r.id === ev.roomId);
      
      // Cálculo do número da aula
      let lessonCountBadge = null;
      if (ev.type === 'AULA' && ev.classGroupId && ev.subject) {
          const subjectEvents = events
              .filter(e => e.classGroupId === ev.classGroupId && e.subject === ev.subject && e.type === 'AULA')
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          const index = subjectEvents.findIndex(e => e.id === ev.id);
          if (index !== -1) {
              const total = subjectEvents.length;
              lessonCountBadge = (
                  <span className="text-[9px] font-mono bg-indigo-100 text-indigo-700 px-1.5 rounded-full border border-indigo-200" title={`Aula ${index + 1} de ${total}`}>
                      #{index + 1}
                  </span>
              );
          }
      }

      return (
        <div key={ev.id} onClick={() => handleEdit(ev)} className={`group relative bg-white border border-l-4 rounded shadow-sm hover:shadow-md cursor-pointer transition-all mb-1 overflow-hidden flex flex-col ${minimal ? 'p-1 text-[8px]' : 'p-2 min-h-[70px]'}`}
             style={{ borderLeftColor: ev.shift === Shift.NOITE ? '#4f46e5' : ev.shift === Shift.TARDE ? '#f59e0b' : '#10b981' }}>
            
            {/* Delete Button - Hidden for Instructors */}
            {!isInstructor && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ev.id);
                    }}
                    className="absolute top-0.5 right-0.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 z-10 bg-white/80 rounded-full"
                    title="Excluir"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            )}

            {!minimal ? (
                <>
                    {/* Header: Type and Shift */}
                    <div className="flex justify-between items-center mb-1 pr-4">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider border border-slate-100 px-1 rounded">{ev.type}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">{ev.shift}</span>
                    </div>

                    {/* Body: Title (Turma) and Instructor */}
                    <div className="flex-1 pr-3">
                        <div className="font-bold text-slate-800 text-xs leading-tight mb-0.5 truncate" title={ev.title}>
                            {ev.title}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-600 truncate">
                            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            <span className="truncate">{instructor?.name || 'Sem Instrutor'}</span>
                        </div>
                    </div>

                    {/* Footer: UC, Lesson Count, Room */}
                    <div className="mt-2 pt-1 border-t border-slate-50 flex flex-col gap-1">
                        {ev.subject && (
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-indigo-600 font-bold truncate max-w-[70%]" title={ev.subject}>{ev.subject}</span>
                                {lessonCountBadge}
                            </div>
                        )}
                        <div className="flex justify-end text-[9px] text-slate-400 font-medium">
                            {room?.name}
                        </div>
                    </div>
                </>
            ) : (
                /* Minimal View (Month) */
                <div className="pr-3">
                    <div className="font-bold text-slate-700 truncate">{ev.title}</div>
                    <div className="flex justify-between items-center mt-0.5">
                       <span className="text-slate-500 truncate max-w-[60%]">{ev.subject || ev.type}</span>
                       {lessonCountBadge}
                    </div>
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-100px)]">
      {/* Sidebar Form - Condicionalmente Renderizado */}
      {isFormOpen && !isInstructor && (
        <div className="w-full md:w-[400px] bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex flex-col flex-shrink-0 animate-in slide-in-from-left duration-300">
            {/* ... (Existing Form Code - Unchanged logic) ... */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
                <h2 className="text-lg font-bold text-slate-800">{editingEventId ? 'Editar Evento' : 'Novo Agendamento'}</h2>
                <div className="flex items-center gap-2">
                    {editingEventId && (
                        <button type="button" onClick={() => handleDelete(editingEventId)} className="text-slate-400 hover:text-red-500 transition-colors" title="Excluir">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    )}
                    <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-600 transition-colors" title="Fechar">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Evento</label>
                        <select className="w-full border p-2 rounded text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.type} onChange={e => setFormData({...formData,type: e.target.value})}>
                            {activityCategories.filter(c => c.name !== 'LAB_USO').map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* SE FOR AULA: MOSTRA FORMULÁRIO COMPLETO */}
                {formData.type === 'AULA' ? (
                <>
                    <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-12">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Turma</label>
                        <select 
                            className="w-full border p-2 rounded text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" 
                            value={formData.classGroupId} 
                            onChange={e => {
                            const groupId = e.target.value;
                            const group = groups.find(x => x.id === groupId);
                            setFormData(prev => ({
                                ...prev, 
                                classGroupId: groupId, 
                                title: group?.name || '', 
                                roomId: group?.roomId || '', // Sugere a sala da turma ou limpa
                                shift: group ? group.shift : prev.shift,
                                subject: '' 
                            }));
                            }}
                        >
                            <option value="">Selecione...</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div className="col-span-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Turno</label>
                            <select className="w-full border p-2 rounded text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.shift} onChange={e => setFormData({...formData, shift: e.target.value as Shift})}>
                                {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                    </div>
                    <div className="col-span-6">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Início</label>
                            <input type="date" className="w-full border p-2 rounded text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                    
                    {/* NOVA FUNCIONALIDADE: PREVISÃO DE TÉRMINO DA UC */}
                    {previewDates.length > 0 && formData.subject && (
                        <div className="col-span-12 bg-indigo-50 p-2 rounded-lg border border-indigo-100 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-indigo-700 uppercase">Previsão de Término (UC):</span>
                            <span className="text-xs font-bold text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200">
                                {previewDates[previewDates.length - 1].split('-').reverse().join('/')}
                            </span>
                        </div>
                    )}
                    </div>

                    <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unidade Curricular</label>
                    <select className="w-full border p-2 rounded text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})}>
                        <option value="">Selecione</option>
                        {groups.find(g => g.id === formData.classGroupId) && courses.find(c => c.id === groups.find(g => g.id === formData.classGroupId)?.courseId)?.subjects.map(s => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                        ))}
                    </select>
                    </div>

                    <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sala</label>
                    <select className="w-full border p-2 rounded text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.roomId} onChange={e => setFormData({...formData, roomId: e.target.value})}>
                        <option value="">Selecione</option>
                        {rooms.filter(r => r.isActive).map(r => (
                            <option key={r.id} value={r.id}>
                                {r.name} {r.block ? `(${r.block})` : ''} {r.type === 'LABORATORIO' ? '(Lab)' : ''}
                            </option>
                        ))}
                    </select>
                    </div>
                </>
                ) : (
                /* FORMULÁRIO SIMPLIFICADO PARA NÃO-AULAS */
                <>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Título / Descrição</label>
                        <input className="w-full border p-2 rounded text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Reunião de Pais" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                    <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Início</label>
                            <input type="date" className="w-full border p-2 rounded text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                    </div>
                    <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Turno</label>
                            <select className="w-full border p-2 rounded text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.shift} onChange={e => setFormData({...formData, shift: e.target.value as Shift})}>
                                {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                    </div>
                    </div>
                    <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Responsável</label>
                    <select className="w-full border p-2 rounded text-xs font-medium bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.instructorId} onChange={e => setFormData({...formData, instructorId: e.target.value})}>
                        <option value="">Selecione</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    </div>
                </>
                )}

                {/* SEÇÃO DE DURAÇÃO E RECORRÊNCIA (COMUM A TODOS) */}
                {!editingEventId && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {/* ... (Existing Recurrence UI Code) ... */}
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[10px] font-bold text-indigo-600 uppercase">Duração e Recorrência</h4>
                        {allowedWeekDays !== null && (
                            <span className="text-[9px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 font-bold uppercase flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Grade Fixa
                            </span>
                        )}
                    </div>
                    
                    <div className="flex gap-2 mb-2">
                        <button type="button" disabled={allowedWeekDays !== null} onClick={() => setRecurrenceMode('CONSECUTIVE')} className={`flex-1 py-1 text-[10px] font-bold rounded border ${recurrenceMode === 'CONSECUTIVE' ? 'bg-white border-indigo-300 text-indigo-700 shadow-sm' : 'border-transparent text-slate-400'} ${allowedWeekDays !== null ? 'opacity-50 cursor-not-allowed' : ''}`}>Consecutivo</button>
                        <button type="button" disabled={allowedWeekDays !== null} onClick={() => setRecurrenceMode('SPECIFIC_DAYS')} className={`flex-1 py-1 text-[10px] font-bold rounded border ${recurrenceMode === 'SPECIFIC_DAYS' ? 'bg-white border-indigo-300 text-indigo-700 shadow-sm' : 'border-transparent text-slate-400'} ${allowedWeekDays !== null ? 'opacity-50 cursor-not-allowed' : ''}`}>Dias Semana</button>
                    </div>

                    {recurrenceMode === 'SPECIFIC_DAYS' && (
                        <div className="flex justify-between mb-3 bg-white p-2 rounded border border-slate-100">
                            {weekDaysMap.map((day, idx) => {
                                const isAllowed = allowedWeekDays === null || allowedWeekDays.includes(idx);
                                return (
                                    <button 
                                    key={idx} 
                                    type="button" 
                                    disabled={!isAllowed}
                                    onClick={() => toggleWeekDay(idx)}
                                    className={`
                                        w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center transition-all 
                                        ${!isAllowed ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : ''}
                                        ${isAllowed && selectedWeekDays.includes(idx) ? 'bg-indigo-600 text-white' : ''}
                                        ${isAllowed && !selectedWeekDays.includes(idx) ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' : ''}
                                    `}
                                    >
                                        {day.charAt(0)}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Quantidade de Dias:</label>
                        <input 
                        type="number" min="1" max={maxSubjectDays} 
                        className="w-16 border p-1 rounded text-center text-xs font-bold text-indigo-600 outline-none" 
                        value={durationDays} 
                        onChange={e => {
                            let val = parseInt(e.target.value) || 1;
                            // Limita ao máximo permitido pela UC
                            if (val > maxSubjectDays) val = maxSubjectDays;
                            setDurationDays(val);
                        }} 
                        />
                        {formData.type === 'AULA' && maxSubjectDays < 365 && (
                            <span className={`text-[9px] font-bold ml-1 flex items-center ${maxSubjectDays === 0 ? 'text-red-500' : 'text-amber-600'}`} title="Calculado com base na carga horária restante da UC">
                               (Restante: {maxSubjectDays})
                            </span>
                        )}
                    </div>
                    {previewDates.length > 0 && (
                        <p className="text-[9px] text-slate-400 mt-1 italic text-right">Agendando {previewDates.length} ocorrências.</p>
                    )}
                    {maxSubjectDays === 0 && formData.type === 'AULA' && formData.subject && (
                        <p className="text-[9px] text-red-500 mt-1 font-bold">Carga horária desta UC concluída.</p>
                    )}
                </div>
                )}

                {/* SEÇÃO DE SUGESTÃO IA (APENAS PARA AULAS) */}
                {formData.type === 'AULA' && (
                <div className="flex-1 flex flex-col min-h-[200px]">
                    {/* ... (Existing AI UI Code) ... */}
                    <div className="flex justify-between items-center mb-2 mt-4 pb-2 border-b">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Instrutor Sugerido</label>
                        <span className="text-[9px] text-slate-400 italic">
                            {isLoadingSuggestion ? 'Calculando IA...' : 'Automático'}
                        </span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar max-h-[250px] p-1">
                        {enrichedInstructors.map(u => {
                            const isSelected = formData.instructorId === u.id;
                            return (
                                <div 
                                    key={u.id}
                                    onClick={() => setFormData({...formData, instructorId: u.id})}
                                    className={`
                                    flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-all
                                    ${isSelected ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-slate-100 hover:border-indigo-200'}
                                    ${u.isBusy ? 'opacity-70' : 'opacity-100'}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img src={u.photoUrl || `https://picsum.photos/40/40?random=${u.id}`} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                                            {aiSuggestions.includes(u.id) && (
                                                <div className="absolute -top-1 -right-1 bg-amber-400 text-white rounded-full p-0.5" title="Recomendado pela IA">
                                                    <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold leading-none mb-0.5 ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{u.name}</p>
                                            {u.hasCompetence ? (
                                                <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Competente</span>
                                            ) : (
                                                <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold uppercase">Sem Validação</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center justify-end gap-1 mb-0.5">
                                            {u.isBusy ? (
                                                <span className="text-red-500" title="Ocupado neste horário">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                </span>
                                            ) : (
                                                <span className="text-emerald-500" title="Disponível">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[9px] font-mono font-bold text-slate-400">{u.load}h / {u.capacity || '?'}h</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}

                {/* HOLIDAY WARNING */}
                {holidayCheck.hasConflict && (
                    <div className={`border rounded-lg p-3 animate-pulse ${holidayCheck.isBlocking ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <svg className={`w-4 h-4 ${holidayCheck.isBlocking ? 'text-red-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className={`text-xs font-bold uppercase ${holidayCheck.isBlocking ? 'text-red-700' : 'text-blue-700'}`}>
                                {holidayCheck.isBlocking ? 'Data Bloqueada' : 'Ajuste Automático de Feriados'}
                            </span>
                        </div>
                        <p className={`text-[10px] leading-tight ${holidayCheck.isBlocking ? 'text-red-600' : 'text-blue-600'}`}>
                            {holidayCheck.isBlocking ? (
                                <>O agendamento coincide com: <strong>{holidayCheck.title}</strong>. Ação bloqueada.</>
                            ) : (
                                <>
                                    {holidayCheck.details?.length} feriado(s) ou recesso(s) foram detectados e <strong>pulados automaticamente</strong>. O cronograma foi estendido para manter a quantidade de aulas.
                                </>
                            )}
                        </p>
                    </div>
                )}

                <div className="pt-4 flex gap-2 border-t mt-auto">
                    <button type="button" onClick={closeForm} className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold text-xs uppercase hover:bg-slate-200">Cancelar</button>
                    <button 
                    type="submit" 
                    disabled={holidayCheck.isBlocking}
                    className={`flex-1 text-white py-3 rounded-lg font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${holidayCheck.isBlocking ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        Salvar Agendamento
                    </button>
                </div>
            </form>
        </div>
      )}

      {/* Main Calendar View */}
      <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
          
          {/* Modal de Exportação */}
          {isExportModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
               <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                     <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                     Exportar Agenda em PDF
                  </h3>
                  
                  <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Início</label>
                           <input 
                             type="date" 
                             className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                             value={exportFilter.startDate} 
                             onChange={e => setExportFilter({...exportFilter, startDate: e.target.value})} 
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Fim</label>
                           <input 
                             type="date" 
                             className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                             value={exportFilter.endDate} 
                             onChange={e => setExportFilter({...exportFilter, endDate: e.target.value})} 
                           />
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Turma (Opcional)</label>
                        <select 
                           className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                           value={exportFilter.classGroupId} 
                           onChange={e => setExportFilter({...exportFilter, classGroupId: e.target.value})}
                        >
                           <option value="">Todas as Turmas</option>
                           {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                     </div>

                     {!isInstructor && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Instrutor (Opcional)</label>
                            <select 
                            className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                            value={exportFilter.instructorId} 
                            onChange={e => setExportFilter({...exportFilter, instructorId: e.target.value})}
                            >
                            <option value="">Todos os Instrutores</option>
                            {users.filter(u => u.role === 'INSTRUCTOR').map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                            </select>
                        </div>
                     )}
                  </div>

                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                     <button 
                       onClick={() => setIsExportModalOpen(false)} 
                       className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold text-xs uppercase hover:bg-slate-200"
                     >
                       Cancelar
                     </button>
                     <button 
                       onClick={() => {
                          const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
                          const pageWidth = doc.internal.pageSize.getWidth();
                          
                          // COLORS
                          const COLOR_PRIMARY = [22, 65, 148]; // #164194
                          
                          if (customFont) {
                              doc.addFileToVFS('CustomFont.ttf', customFont);
                              doc.addFont('CustomFont.ttf', 'CustomFont', 'normal');
                              doc.setFont('CustomFont');
                          } else {
                              doc.setFont("helvetica");
                          }

                          if (reportBackground) {
                              doc.addImage(reportBackground, 'PNG', 0, 0, 297, 210);
                          }

                          const filteredExport = events.filter(e => {
                             if (e.type === 'LAB_USO') return false;
                             if (e.date < exportFilter.startDate || e.date > exportFilter.endDate) return false;
                             if (exportFilter.classGroupId && e.classGroupId !== exportFilter.classGroupId) return false;
                             if (exportFilter.instructorId && e.instructorId !== exportFilter.instructorId) return false;
                             return true;
                          }).sort((a,b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));

                          if (filteredExport.length === 0) {
                             alert("Nenhum evento encontrado para os filtros selecionados.");
                             return;
                          }

                          doc.setFontSize(16);
                          doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
                          // Title Case applied
                          doc.text("Relatório De Agenda", pageWidth / 2, 20, { align: 'center' });
                          
                          doc.setFontSize(10);
                          doc.setTextColor(100);
                          doc.text(`Período: ${exportFilter.startDate.split('-').reverse().join('/')} a ${exportFilter.endDate.split('-').reverse().join('/')}`, pageWidth / 2, 26, { align: 'center' });

                          const tableBody = filteredExport.map(ev => {
                             const inst = users.find(u => u.id === ev.instructorId);
                             const room = rooms.find(r => r.id === ev.roomId);
                             const dateObj = new Date(ev.date + 'T00:00:00');
                             const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
                             
                             let subjectInfo = ev.subject || '-';
                             // Calcula número da aula se for do tipo AULA
                             if (ev.type === 'AULA' && ev.classGroupId && ev.subject) {
                                 const subjectEvents = events
                                  .filter(e => e.classGroupId === ev.classGroupId && e.subject === ev.subject && e.type === 'AULA')
                                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                              
                                 const index = subjectEvents.findIndex(e => e.id === ev.id);
                                 if (index !== -1) {
                                     subjectInfo = `${ev.subject} (Aula ${index + 1}/${subjectEvents.length})`;
                                 }
                             }

                             return [
                                ev.date.split('-').reverse().join('/'),
                                weekDay.toUpperCase(),
                                ev.shift,
                                ev.title,
                                subjectInfo,
                                inst?.name || 'N/A',
                                room?.name || 'N/A'
                             ];
                          });

                          autoTable(doc, {
                             startY: 35,
                             head: [['Data', 'Dia', 'Turno', 'Turma / Evento', 'Unidade Curricular', 'Instrutor', 'Sala']],
                             body: tableBody,
                             headStyles: { fillColor: COLOR_PRIMARY, fontSize: 8, font: customFont ? 'CustomFont' : 'helvetica' },
                             bodyStyles: { fontSize: 7, font: customFont ? 'CustomFont' : 'helvetica' },
                             willDrawPage: (data) => {
                                  if (reportBackground && data.pageNumber > 1) {
                                      doc.addImage(reportBackground, 'PNG', 0, 0, 297, 210);
                                  }
                              }
                          });

                          doc.save(`Agenda_${exportFilter.startDate}.pdf`);
                          setIsExportModalOpen(false);
                       }} 
                       className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase hover:bg-indigo-700 shadow-md"
                     >
                       Gerar PDF
                     </button>
                  </div>
               </div>
            </div>
          )}

          {/* Calendar Header Controls - Unchanged */}
          <div className="flex flex-col xl:flex-row justify-between items-center gap-4 mb-6 flex-shrink-0">
             <div className="flex items-center gap-4">
                 <h2 className="text-2xl font-bold text-slate-800">Agenda</h2>
                 
                 {!isFormOpen && (
                    <div className="flex gap-2">
                        {!isInstructor && (
                            <button 
                            onClick={handleStartScheduling}
                            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2"
                            >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                            Agendar
                            </button>
                        )}
                        <button 
                          onClick={() => setIsExportModalOpen(true)}
                          className="bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm hover:bg-indigo-50 transition-all flex items-center gap-2"
                          title="Exportar PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Exportar
                        </button>
                    </div>
                 )}

                 <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-white rounded shadow-sm text-slate-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-3 text-xs font-bold text-slate-600 hover:text-indigo-600">Hoje</button>
                    <button onClick={() => navigateDate(1)} className="p-1 hover:bg-white rounded shadow-sm text-slate-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                 </div>
                 <span className="text-lg font-medium text-slate-600 min-w-[200px] text-center">{formattedCurrentDateRange}</span>
             </div>

             <div className="flex gap-4">
                 {/* Filters */}
                 <div className="flex gap-2">
                    <select 
                        className="border rounded-md text-xs py-1 px-2 outline-none focus:ring-1 focus:ring-indigo-500" 
                        value={filterInstructorId} 
                        onChange={e => setFilterInstructorId(e.target.value)}
                        disabled={isInstructor} // Bloqueia filtro se for instrutor
                    >
                        <option value="">Todos Instrutores</option>
                        {users.filter(u => u.role === 'INSTRUCTOR').map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                    <select className="border rounded-md text-xs py-1 px-2 outline-none focus:ring-1 focus:ring-indigo-500" value={filterClassGroupId} onChange={e => setFilterClassGroupId(e.target.value)}>
                        <option value="">Todas Turmas</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <select className="border rounded-md text-xs py-1 px-2 outline-none focus:ring-1 focus:ring-indigo-500" value={filterShift} onChange={e => setFilterShift(e.target.value)}>
                        <option value="">Todos Turnos</option>
                        {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="border rounded-md text-xs py-1 px-2 outline-none focus:ring-1 focus:ring-indigo-500" value={filterRoomId} onChange={e => setFilterRoomId(e.target.value)}>
                        <option value="">Todas Salas / Labs</option>
                        {rooms
                          .filter(r => r.isActive) 
                          .map(r => <option key={r.id} value={r.id}>{r.name} {r.type === 'LABORATORIO' ? '(Lab)' : ''}</option>)}
                    </select>
                 </div>

                 {/* View Toggles */}
                 <div className="flex bg-slate-200 p-1 rounded-lg">
                    {(['DAY', 'WEEK', 'MONTH'] as const).map(m => (
                        <button 
                          key={m} 
                          onClick={() => setViewMode(m)}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          {m === 'DAY' ? 'Dia' : m === 'WEEK' ? 'Semana' : 'Mês'}
                        </button>
                    ))}
                 </div>
             </div>
          </div>

          {/* Calendar Grid - Unchanged */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 rounded-lg border border-slate-200 p-1">
             {/* DAY VIEW */}
             {viewMode === 'DAY' && (
                <div className="space-y-2 p-2">
                    {filteredEvents.length === 0 ? (
                         <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                             <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                             <p className="italic font-medium">Nenhuma aula agendada para este dia.</p>
                         </div>
                    ) : (
                         filteredEvents.sort((a,b) => a.shift.localeCompare(b.shift)).map(ev => renderEventCard(ev))
                    )}
                </div>
             )}

             {/* WEEK VIEW */}
             {viewMode === 'WEEK' && (
                <div className="grid grid-cols-7 gap-2 min-w-[800px] h-full">
                    {getWeekDays(currentDate).map((day, idx) => {
                        const dayStr = day.toISOString().split('T')[0];
                        const dayEvents = filteredEvents.filter(e => e.date === dayStr).sort((a,b) => a.shift.localeCompare(b.shift));
                        const isToday = new Date().toISOString().split('T')[0] === dayStr;

                        return (
                            <div key={idx} className={`flex flex-col h-full rounded-lg ${isToday ? 'bg-indigo-50/50 border border-indigo-100' : 'bg-white border border-slate-100'}`}>
                                <div className={`p-2 text-center border-b ${isToday ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500'}`}>
                                    <span className="block text-[10px] font-bold uppercase">{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                                    <span className="block text-sm font-bold">{day.getDate()}</span>
                                </div>
                                <div className="p-1 flex-1 overflow-y-auto custom-scrollbar space-y-1">
                                    {dayEvents.map(ev => renderEventCard(ev, true))}
                                </div>
                            </div>
                        );
                    })}
                </div>
             )}

             {/* MONTH VIEW */}
             {viewMode === 'MONTH' && (
                <div className="grid grid-cols-7 gap-1 h-full auto-rows-fr">
                    {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                        <div key={d} className="bg-slate-100 p-1 text-center text-[10px] font-bold text-slate-500 uppercase">{d}</div>
                    ))}
                    {getDaysInMonth(currentDate).map((day, idx) => {
                        if (!day) return <div key={`empty-${idx}`} className="bg-slate-100/50" />;
                        
                        const dayStr = day.toISOString().split('T')[0];
                        const dayEvents = filteredEvents.filter(e => e.date === dayStr);
                        const isToday = new Date().toISOString().split('T')[0] === dayStr;

                        return (
                            <div key={dayStr} className={`bg-white border p-1 flex flex-col min-h-[100px] hover:bg-slate-50 transition-colors ${isToday ? 'ring-2 ring-inset ring-indigo-300' : 'border-slate-100'}`}>
                                <div className="text-right mb-1">
                                    <span className={`text-[10px] font-bold px-1.5 rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                                        {day.getDate()}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5">
                                    {dayEvents.slice(0, 4).map(ev => (
                                        <div key={ev.id} onClick={() => handleEdit(ev)} className="truncate text-[8px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 cursor-pointer hover:bg-indigo-100">
                                            {ev.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 4 && (
                                        <div className="text-[8px] text-center text-slate-400 font-bold">
                                            +{dayEvents.length - 4} mais
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
             )}
          </div>
      </div>
    </div>
  );
};

export default Schedule;
