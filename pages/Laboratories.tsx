
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Shift, Room, ScheduleEvent } from '../types';

type LabViewMode = 'DAY' | 'WEEK' | 'MONTH';
type RecurrenceMode = 'CONSECUTIVE' | 'SPECIFIC_DAYS';

const Laboratories: React.FC = () => {
  const { rooms, users, addEvent, events, deleteEvent, currentUser, getCalendarEvent, groups, courses, labBookingLimit, setLabBookingLimit } = useApp();
  // Filtro Atualizado: Apenas labs ativos
  const labs = rooms.filter(r => r.type === 'LABORATORIO' && r.isActive);
  
  const availableInstructors = useMemo(() => {
    return users.filter(u => u.competencyIds && u.competencyIds.length > 0);
  }, [users]);

  const isAdmin = currentUser?.role === 'SUPERVISION';
  const isInstructor = currentUser?.role === 'INSTRUCTOR';
  
  const [viewMode, setViewMode] = useState<LabViewMode>('DAY');
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- FILTROS ---
  const [filterInstructor, setFilterInstructor] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterRoom, setFilterRoom] = useState('');

  // Recurrence States
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('CONSECUTIVE');
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([]); // 0=Dom...
  const [durationDays, setDurationDays] = useState(1);
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [skippedHolidays, setSkippedHolidays] = useState<{date: string, title: string}[]>([]);

  const [formData, setFormData] = useState({
    roomId: '',
    instructorId: isInstructor && currentUser ? currentUser.id : '',
    classGroupId: '', // Novo campo para Turma
    startDate: new Date().toISOString().split('T')[0],
    shift: Shift.MANHA
  });

  const weekDaysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Identifica quais dias são permitidos com base na turma selecionada
  const allowedWeekDays = useMemo(() => {
      if (formData.classGroupId) {
          const group = groups.find(g => g.id === formData.classGroupId);
          // Se a turma tem dias definidos, retorna eles.
          if (group && group.weekDays && group.weekDays.length > 0) {
              return group.weekDays;
          }
      }
      return null; // Null significa "todos permitidos"
  }, [formData.classGroupId, groups]);

  // Limite Dinâmico baseado no Perfil
  const limitPerBatch = useMemo(() => {
      // Se for instrutor, usa o limite configurado globalmente. Se for admin, usa um limite alto (ex: 60).
      return isInstructor ? labBookingLimit : 60;
  }, [isInstructor, labBookingLimit]);

  // Efeito para auto-selecionar os dias quando a turma muda
  useEffect(() => {
      if (allowedWeekDays !== null) {
          setRecurrenceMode('SPECIFIC_DAYS');
          setSelectedWeekDays(allowedWeekDays);
      }
  }, [allowedWeekDays]);

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

  // Generate Date Preview (Com Pulo de Feriados)
  useEffect(() => {
    if (durationDays <= 0) {
        setPreviewDates([]);
        setSkippedHolidays([]);
        return;
    }

    const generated: string[] = [];
    const skipped: {date: string, title: string}[] = [];
    
    const start = new Date(formData.startDate + 'T00:00:00');
    let current = new Date(start);
    let count = 0;
    
    let loops = 0; 
    while (count < durationDays && loops < 365) {
        loops++;
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        
        let isValidDay = true;
        
        // Verifica padrão de dias (Específico ou Consecutivo)
        if (recurrenceMode === 'SPECIFIC_DAYS') {
            if (selectedWeekDays.length > 0 && !selectedWeekDays.includes(dayOfWeek)) {
                isValidDay = false;
            }
        }

        if (isValidDay) {
            // Check holiday
            const holiday = getCalendarEvent(dateStr);
            if (holiday && holiday.isDayOff) {
                skipped.push({ date: dateStr, title: holiday.title });
            } else {
                generated.push(dateStr);
                count++;
            }
        }
        current.setDate(current.getDate() + 1);
    }
    setPreviewDates(generated);
    setSkippedHolidays(skipped);
  }, [formData.startDate, durationDays, recurrenceMode, selectedWeekDays, getCalendarEvent]);

  // Holiday Check for Labs (Apenas para exibir aviso)
  const holidayCheck = useMemo(() => {
    if (skippedHolidays.length > 0) {
        return { 
            hasConflict: true, 
            isBlocking: false,
            title: 'Recesso/Feriado',
            dates: skippedHolidays.map(c => c.date),
            details: skippedHolidays
        };
    }
    return { hasConflict: false, isBlocking: false, title: '', dates: [] };
  }, [skippedHolidays]);

  const handleBookLab = () => {
    if (!formData.roomId || !formData.instructorId) return alert("Preencha todos os campos obrigatórios.");
    
    // Validação de Segurança com Limite Configurável
    if (durationDays > limitPerBatch) {
        return alert(`O limite permitido para seu perfil é de ${limitPerBatch} ocorrências por vez.`);
    }
    
    if (previewDates.length === 0) {
        alert("Nenhuma data válida disponível.");
        return;
    }

    // Regra de crédito acumulado para instrutor
    if (isInstructor && currentUser) {
        // Conta agendamentos futuros neste turno
        const today = new Date().toISOString().split('T')[0];
        const activeBookings = events.filter(e => 
            e.type === 'LAB_USO' &&
            e.instructorId === currentUser.id &&
            e.shift === formData.shift &&
            e.date >= today
        );

        // O limite global se aplica à soma dos agendamentos ativos + novos
        if (activeBookings.length + previewDates.length > labBookingLimit) {
            alert(`Limite de agendamento excedido!\n\nVocê já possui ${activeBookings.length} agendamentos ativos no turno ${formData.shift} e está tentando agendar mais ${previewDates.length}.\n\nO limite configurado pela supervisão é de ${labBookingLimit} dias por turno.`);
            return;
        }
    }

    let successCount = 0;
    
    // Recupera o nome da turma para usar no título se disponível
    const group = groups.find(g => g.id === formData.classGroupId);
    const title = group ? group.name : 'Uso de Laboratório';

    previewDates.forEach(dateStr => {
        const ok = addEvent({
            type: 'LAB_USO',
            title: title,
            date: dateStr,
            shift: formData.shift,
            instructorId: formData.instructorId,
            roomId: formData.roomId,
            classGroupId: formData.classGroupId || undefined
        });
        if (ok) successCount++;
    });

    if (successCount > 0) {
        const msg = `${successCount} reserva(s) realizada(s)!` + (skippedHolidays.length > 0 ? `\n(Nota: ${skippedHolidays.length} feriados foram pulados automaticamente).` : '');
        alert(msg);
        setDurationDays(1);
        setRecurrenceMode('CONSECUTIVE');
        setSelectedWeekDays([]);
    }
  };

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

  const navigateDate = (direction: number) => {
      const newDate = new Date(currentDate);
      if (viewMode === 'DAY') newDate.setDate(newDate.getDate() + direction);
      if (viewMode === 'WEEK') newDate.setDate(newDate.getDate() + (direction * 7));
      if (viewMode === 'MONTH') newDate.setMonth(newDate.getMonth() + direction);
      setCurrentDate(newDate);
  };

  const formattedDateRange = useMemo(() => {
      const d = currentDate;
      if (viewMode === 'DAY') return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (viewMode === 'MONTH') return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const week = getWeekDays(d);
      return `${week[0].getDate()}/${week[0].getMonth()+1} a ${week[6].getDate()}/${week[6].getMonth()+1}`;
  }, [currentDate, viewMode]);

  // --- FILTRAGEM DOS EVENTOS DE LABORATÓRIO ---
  const filteredLabEvents = useMemo(() => {
      return events.filter(e => {
          if (e.type !== 'LAB_USO') return false;
          if (filterInstructor && e.instructorId !== filterInstructor) return false;
          if (filterShift && e.shift !== filterShift) return false;
          if (filterGroup && e.classGroupId !== filterGroup) return false;
          if (filterRoom && e.roomId !== filterRoom) return false;
          return true;
      });
  }, [events, filterInstructor, filterShift, filterGroup, filterRoom]);

  const renderBookingCard = (event: ScheduleEvent, minimal = false) => {
    const inst = users.find(u => u.id === event.instructorId);
    // Permite que instrutor remova SEUS PRÓPRIOS agendamentos
    const canDelete = isAdmin || (isInstructor && currentUser && event.instructorId === currentUser.id);
    
    return (
      <div key={event.id} className={`group bg-emerald-50/50 border border-emerald-200 rounded p-1 hover:bg-white hover:shadow-md transition-all relative ${minimal ? 'text-[8px]' : 'text-xs'}`}>
        <p className="font-bold text-emerald-800 truncate" title={event.title}>{event.title}</p>
        <p className="text-[9px] text-slate-500 truncate">{inst?.name.split(' ')[0]}</p>
        {!minimal && <p className="text-[8px] text-slate-400 uppercase">{event.shift}</p>}
        {canDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); if(window.confirm("Remover esta reserva?")) deleteEvent(event.id); }}
              className="absolute top-0.5 right-0.5 text-red-300 hover:text-red-500"
            >
              ×
            </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reserva de Laboratórios</h2>
          <p className="text-sm text-slate-500">Controle de ocupação e agendamentos técnicos</p>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white border p-1 rounded-lg">
                <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-500">◀</button>
                <span className="text-xs font-bold text-slate-700 min-w-[150px] text-center">{formattedDateRange}</span>
                <button onClick={() => navigateDate(1)} className="p-1 hover:bg-slate-100 rounded text-slate-500">▶</button>
            </div>

            <div className="flex bg-slate-200 p-1 rounded-lg">
                {(['DAY', 'WEEK', 'MONTH'] as const).map(m => (
                    <button 
                    key={m} 
                    onClick={() => setViewMode(m)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === m ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'}`}
                    >
                    {m === 'DAY' ? 'Dia' : m === 'WEEK' ? 'Semana' : 'Mês'}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* FORMULÁRIO */}
        <div className="w-full lg:w-[320px] bg-white p-5 rounded-xl border border-slate-200 shadow-sm overflow-y-auto flex-shrink-0">
            <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider flex items-center border-b pb-2">
              <svg className="w-4 h-4 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Nova Reserva
            </h3>
            <div className="space-y-4">
              <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Laboratório</label>
                  <select className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-emerald-500" value={formData.roomId} onChange={e => setFormData({...formData, roomId: e.target.value})}>
                      <option value="">Selecione o Lab</option>
                      {labs.map(l => <option key={l.id} value={l.id}>{l.name} {l.block ? `(${l.block})` : ''}</option>)}
                  </select>
              </div>
              
              <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Turma (Opcional)</label>
                  <select 
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-emerald-500" 
                    value={formData.classGroupId} 
                    onChange={e => {
                        const grp = groups.find(g => g.id === e.target.value);
                        setFormData(prev => ({
                            ...prev, 
                            classGroupId: e.target.value,
                            shift: grp ? grp.shift : prev.shift
                        }));
                    }}
                  >
                      <option value="">Uso Avulso / Sem Turma</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
              </div>

              <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Responsável</label>
                  <select 
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-emerald-500" 
                    value={formData.instructorId} 
                    onChange={e => setFormData({...formData, instructorId: e.target.value})}
                    disabled={isInstructor} // Bloqueia para instrutor
                  >
                      <option value="">Selecione o Instrutor</option>
                      {availableInstructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Início</label>
                  <input type="date" className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-emerald-500" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              </div>
              <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Turno</label>
                  <select className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:ring-emerald-500" value={formData.shift} onChange={e => setFormData({...formData, shift: e.target.value as Shift})}>
                    {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              </div>

              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                 <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[9px] font-bold text-slate-500 uppercase">Recorrência</h4>
                    {allowedWeekDays !== null && (
                        <span className="text-[8px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 font-bold uppercase flex items-center gap-1">
                            <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Grade Fixa
                        </span>
                    )}
                 </div>
                 
                 <div className="flex gap-1 mb-2">
                    <button type="button" disabled={allowedWeekDays !== null} onClick={() => setRecurrenceMode('CONSECUTIVE')} className={`flex-1 py-1 text-[9px] font-bold rounded border ${recurrenceMode === 'CONSECUTIVE' ? 'bg-white border-emerald-300 text-emerald-700' : 'border-transparent text-slate-400'} ${allowedWeekDays !== null ? 'opacity-50 cursor-not-allowed' : ''}`}>Consecutivo</button>
                    <button type="button" disabled={allowedWeekDays !== null} onClick={() => setRecurrenceMode('SPECIFIC_DAYS')} className={`flex-1 py-1 text-[9px] font-bold rounded border ${recurrenceMode === 'SPECIFIC_DAYS' ? 'bg-white border-emerald-300 text-emerald-700' : 'border-transparent text-slate-400'} ${allowedWeekDays !== null ? 'opacity-50 cursor-not-allowed' : ''}`}>Dias Semana</button>
                 </div>

                 {recurrenceMode === 'SPECIFIC_DAYS' && (
                    <div className="flex justify-between mb-2">
                        {weekDaysMap.map((day, idx) => {
                            const isAllowed = allowedWeekDays === null || allowedWeekDays.includes(idx);
                            return (
                                <button 
                                key={idx} 
                                type="button"
                                onClick={() => toggleWeekDay(idx)}
                                disabled={!isAllowed}
                                className={`
                                    w-5 h-5 rounded-full text-[8px] font-bold flex items-center justify-center transition-all 
                                    ${!isAllowed ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' : ''}
                                    ${isAllowed && selectedWeekDays.includes(idx) ? 'bg-emerald-600 text-white' : ''}
                                    ${isAllowed && !selectedWeekDays.includes(idx) ? 'bg-white text-slate-400 border hover:bg-slate-50' : ''}
                                `}
                                >
                                    {day.charAt(0)}
                                </button>
                            );
                        })}
                    </div>
                 )}

                 <div className="flex items-center gap-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Qtd. Dias:</label>
                    <input 
                      type="number" min="1" max={limitPerBatch} 
                      className="w-12 border p-1 rounded text-center text-xs font-bold text-emerald-600 outline-none" 
                      value={durationDays} 
                      onChange={e => {
                          let val = parseInt(e.target.value) || 1;
                          // Restrição em Tempo Real do Input
                          if (val > limitPerBatch) val = limitPerBatch;
                          setDurationDays(val);
                      }} 
                    />
                    {isInstructor && <span className="text-[9px] text-red-400 font-bold">(Máx: {limitPerBatch})</span>}
                 </div>
                 {previewDates.length > 0 && <p className="text-[8px] text-slate-400 mt-1 text-right">{previewDates.length} dias selecionados</p>}
                 
                 {/* Opção de Configuração do Limite Máximo (Apenas Admin) */}
                 {isAdmin && (
                    <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center group">
                        <label className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1 cursor-help" title="Configurar o limite máximo de dias por agendamento para Instrutores">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Limite (Instrutores)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="365"
                            className="w-10 border p-0.5 rounded text-center text-[9px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                            value={labBookingLimit}
                            onChange={e => setLabBookingLimit(parseInt(e.target.value) || 1)}
                        />
                    </div>
                 )}
              </div>

              {holidayCheck.hasConflict && (
                <div className={`border rounded p-2 animate-pulse ${holidayCheck.isBlocking ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-center gap-1 mb-1">
                        <svg className={`w-3 h-3 ${holidayCheck.isBlocking ? 'text-red-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span className={`text-[9px] font-bold uppercase ${holidayCheck.isBlocking ? 'text-red-700' : 'text-blue-700'}`}>
                            {holidayCheck.isBlocking ? 'Bloqueio Total' : 'Ajuste de Feriados'}
                        </span>
                    </div>
                    <p className={`text-[9px] leading-tight ${holidayCheck.isBlocking ? 'text-red-600' : 'text-blue-600'}`}>
                        {holidayCheck.isBlocking ? (
                            <>Todas datas são inválidas.</>
                        ) : (
                            <>Feriados detectados e pulados automaticamente ({holidayCheck.dates.length} dias).</>
                        )}
                    </p>
                </div>
              )}

              <button 
                onClick={handleBookLab} 
                disabled={holidayCheck.isBlocking}
                className={`w-full py-2 rounded text-xs font-bold transition-colors shadow-md uppercase ${holidayCheck.isBlocking ? 'bg-slate-400 cursor-not-allowed text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                  Confirmar Reserva
              </button>
            </div>
        </div>

        {/* VISUALIZAÇÃO */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-hidden flex flex-col">
            {/* Barra de Filtros */}
            <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100 items-center">
                <div className="flex items-center gap-1 mr-2">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Filtros:</span>
                </div>
                
                <select className="border rounded text-[10px] py-1 px-2 outline-none focus:ring-1 focus:ring-emerald-500" value={filterInstructor} onChange={e => setFilterInstructor(e.target.value)}>
                    <option value="">Instrutor</option>
                    {users.filter(u => u.role === 'INSTRUCTOR').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>

                <select className="border rounded text-[10px] py-1 px-2 outline-none focus:ring-1 focus:ring-emerald-500" value={filterShift} onChange={e => setFilterShift(e.target.value)}>
                    <option value="">Turno</option>
                    {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select className="border rounded text-[10px] py-1 px-2 outline-none focus:ring-1 focus:ring-emerald-500" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
                    <option value="">Turma</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>

                <select className="border rounded text-[10px] py-1 px-2 outline-none focus:ring-1 focus:ring-emerald-500" value={filterRoom} onChange={e => setFilterRoom(e.target.value)}>
                    <option value="">Laboratório</option>
                    {labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>

                {(filterInstructor || filterShift || filterGroup || filterRoom) && (
                    <button onClick={() => { setFilterInstructor(''); setFilterShift(''); setFilterGroup(''); setFilterRoom(''); }} className="text-[10px] text-red-500 font-bold hover:underline ml-auto">
                        Limpar
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* DAY VIEW (Cross Table: Labs x Shifts) */}
                {viewMode === 'DAY' && (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="p-2 text-[10px] font-bold text-slate-400 uppercase w-1/4">Laboratório</th>
                                <th className="p-2 text-[10px] font-bold text-slate-400 uppercase w-1/4 bg-blue-50/50">Manhã</th>
                                <th className="p-2 text-[10px] font-bold text-slate-400 uppercase w-1/4 bg-orange-50/50">Tarde</th>
                                <th className="p-2 text-[10px] font-bold text-slate-400 uppercase w-1/4 bg-indigo-50/50">Noite</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {labs.map(lab => {
                                const dayDateStr = currentDate.toISOString().split('T')[0];
                                const eventsToday = filteredLabEvents.filter(e => e.roomId === lab.id && e.date === dayDateStr);
                                
                                return (
                                    <tr key={lab.id} className="hover:bg-slate-50">
                                        <td className="p-3 text-xs font-bold text-slate-700 border-r">{lab.name}</td>
                                        {[Shift.MANHA, Shift.TARDE, Shift.NOITE].map(shift => {
                                            const ev = eventsToday.find(e => e.shift === shift);
                                            return (
                                                <td key={shift} className="p-2 border-r align-top h-16">
                                                    {ev ? renderBookingCard(ev) : <span className="text-[9px] text-slate-300 italic block text-center mt-4">-</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {/* WEEK VIEW (Cols: Days, Rows: Labs) */}
                {viewMode === 'WEEK' && (
                    <div className="grid grid-cols-8 gap-1 min-w-[800px]">
                        <div className="sticky left-0 bg-white z-10 p-2 text-[10px] font-bold text-slate-400 uppercase border-b">Laboratório</div>
                        {getWeekDays(currentDate).map((day, i) => (
                            <div key={i} className={`p-2 text-center border-b ${day.toISOString().split('T')[0] === new Date().toISOString().split('T')[0] ? 'bg-emerald-50' : ''}`}>
                                <p className="text-[10px] font-bold uppercase text-slate-400">{weekDaysMap[day.getDay()]}</p>
                                <p className="text-xs font-bold text-slate-700">{day.getDate()}</p>
                            </div>
                        ))}

                        {labs.map(lab => (
                            <React.Fragment key={lab.id}>
                                <div className="p-2 text-xs font-bold text-slate-700 border-b flex items-center sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{lab.name}</div>
                                {getWeekDays(currentDate).map((day, i) => {
                                    const dateStr = day.toISOString().split('T')[0];
                                    const eventsDay = filteredLabEvents.filter(e => e.roomId === lab.id && e.date === dateStr);
                                    return (
                                        <div key={i} className="p-1 border-b border-l border-slate-50 min-h-[60px] space-y-1">
                                            {eventsDay.map(ev => renderBookingCard(ev, false))}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {/* MONTH VIEW */}
                {viewMode === 'MONTH' && (
                    <div className="grid grid-cols-7 gap-1 auto-rows-fr h-full">
                        {weekDaysMap.map(d => (
                            <div key={d} className="bg-slate-100 p-1 text-center text-[10px] font-bold text-slate-500 uppercase">{d}</div>
                        ))}
                        {getDaysInMonth(currentDate).map((day, idx) => {
                            if (!day) return <div key={`empty-${idx}`} className="bg-slate-50/50" />;
                            
                            const dayStr = day.toISOString().split('T')[0];
                            const dayEvents = filteredLabEvents.filter(e => e.date === dayStr);
                            const isToday = new Date().toISOString().split('T')[0] === dayStr;

                            return (
                                <div key={dayStr} className={`bg-white border p-1 flex flex-col min-h-[80px] hover:bg-slate-50 transition-colors ${isToday ? 'ring-2 ring-emerald-200' : 'border-slate-100'}`}>
                                    <span className={`text-[10px] font-bold ml-auto px-1.5 rounded-full ${isToday ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>
                                        {day.getDate()}
                                    </span>
                                    <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar mt-1">
                                        {dayEvents.slice(0, 3).map(ev => {
                                            const l = labs.find(x => x.id === ev.roomId);
                                            return (
                                                <div key={ev.id} className="text-[7px] bg-emerald-50 text-emerald-800 px-1 rounded truncate border border-emerald-100">
                                                    {l?.name.substring(0,10)}.. ({ev.shift.substring(0,1)})
                                                </div>
                                            )
                                        })}
                                        {dayEvents.length > 3 && <span className="text-[8px] text-center text-slate-400 font-bold">+{dayEvents.length - 3}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Laboratories;
