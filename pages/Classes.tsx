
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Shift, ClassGroup, ShiftTimes, LessonSlot } from '../types';

const Classes: React.FC = () => {
  const { groups, setGroups, courses, rooms, projects, areas, events } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Filtros
  const [filterProject, setFilterProject] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [formData, setFormData] = useState<Omit<ClassGroup, 'id'>>({
    name: '', 
    courseId: '', 
    projectId: '',
    shift: Shift.MANHA, 
    roomId: '', 
    classesPerDay: 5,
    startDate: new Date().toISOString().split('T')[0],
    estimatedEndDate: '',
    weekDays: [1, 2, 3, 4, 5], // Padrão: Seg-Sex
    status: 'ACTIVE',
    lessonSlots: [],
    classCalendar: ''
  });

  const calendarInputRef = useRef<HTMLInputElement>(null);
  const weekDaysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Helper para determinar a duração de 1 aula em horas, baseado na qtd de aulas/dia
  const getHourUnit = (classesPerDay: number) => {
    if (classesPerDay === 4) return 1.0; // 4 aulas = 4h
    if (classesPerDay === 6) return 5.0 / 6.0; // 6 aulas = 5h (~0.83h)
    return 0.75; // Padrão (ex: 5 aulas = 3.75h)
  };

  // Helper para determinar horas totais por dia
  const getHoursPerDay = (classesPerDay: number) => {
    if (classesPerDay === 4) return 4.0;
    if (classesPerDay === 6) return 5.0;
    return classesPerDay * 0.75; // 5 * 0.75 = 3.75
  };

  // Valores calculados dinamicamente para o formulário
  const currentHourUnit = useMemo(() => getHourUnit(formData.classesPerDay), [formData.classesPerDay]);
  const currentHoursPerDay = useMemo(() => getHoursPerDay(formData.classesPerDay), [formData.classesPerDay]);

  // Busca o curso selecionado para exibir as matérias no formulário
  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id === formData.courseId);
  }, [formData.courseId, courses]);

  // Filtra as turmas com base nos selects
  const filteredGroups = useMemo(() => {
    return groups.filter(group => {
      if (filterProject && group.projectId !== filterProject) return false;
      if (filterCourse && group.courseId !== filterCourse) return false;
      if (filterShift && group.shift !== filterShift) return false;
      
      const currentStatus = group.status || 'ACTIVE'; // Compatibilidade com dados antigos
      if (filterStatus && currentStatus !== filterStatus) return false;
      
      return true;
    });
  }, [groups, filterProject, filterCourse, filterShift, filterStatus]);

  // Função para gerar slots de aula baseados no turno e quantidade
  const generateDefaultSlots = useCallback((numClasses: number, shift: Shift): LessonSlot[] => {
    // Definição exata de horários
    
    // Configuração para 6 Aulas
    if (numClasses === 6) {
        if (shift === Shift.MANHA) {
            return [
                { index: 1, startTime: '07:00', endTime: '07:50' },
                { index: 2, startTime: '07:50', endTime: '08:40' },
                { index: 3, startTime: '08:40', endTime: '09:30' }, // Fim antes do intervalo
                { index: 4, startTime: '09:50', endTime: '10:40' }, // Início após intervalo
                { index: 5, startTime: '10:40', endTime: '11:30' },
                { index: 6, startTime: '11:30', endTime: '12:20' },
            ];
        }
    }

    if (numClasses === 5) {
        if (shift === Shift.MANHA) {
            return [
                { index: 1, startTime: '07:30', endTime: '08:15' },
                { index: 2, startTime: '08:15', endTime: '09:00' },
                { index: 3, startTime: '09:15', endTime: '10:00' }, // Intervalo de 15min antes
                { index: 4, startTime: '10:00', endTime: '10:45' },
                { index: 5, startTime: '10:45', endTime: '11:30' },
            ];
        }
        if (shift === Shift.TARDE) {
            return [
                { index: 1, startTime: '13:30', endTime: '14:15' },
                { index: 2, startTime: '14:15', endTime: '15:00' },
                { index: 3, startTime: '15:15', endTime: '16:00' }, // Intervalo de 15min antes
                { index: 4, startTime: '16:00', endTime: '16:45' },
                { index: 5, startTime: '16:45', endTime: '17:30' },
            ];
        }
        if (shift === Shift.NOITE) {
            return [
                { index: 1, startTime: '18:30', endTime: '19:15' },
                { index: 2, startTime: '19:15', endTime: '20:00' },
                { index: 3, startTime: '20:15', endTime: '21:00' }, // Intervalo de 15min antes
                { index: 4, startTime: '21:00', endTime: '21:45' },
                { index: 5, startTime: '21:45', endTime: '22:30' },
            ];
        }
    }

    if (numClasses === 4) {
        if (shift === Shift.MANHA) {
            return [
                { index: 1, startTime: '07:30', endTime: '08:30' },
                { index: 2, startTime: '08:30', endTime: '09:30' },
                { index: 3, startTime: '09:30', endTime: '10:30' },
                { index: 4, startTime: '10:30', endTime: '11:30' },
            ];
        }
        if (shift === Shift.TARDE) {
            return [
                { index: 1, startTime: '13:30', endTime: '14:30' },
                { index: 2, startTime: '14:30', endTime: '15:30' },
                { index: 3, startTime: '15:30', endTime: '16:30' },
                { index: 4, startTime: '16:30', endTime: '17:30' },
            ];
        }
        if (shift === Shift.NOITE) {
            return [
                { index: 1, startTime: '18:30', endTime: '19:30' },
                { index: 2, startTime: '19:30', endTime: '20:30' },
                { index: 3, startTime: '20:30', endTime: '21:30' },
                { index: 4, startTime: '21:30', endTime: '22:30' },
            ];
        }
    }

    // Fallback genérico (calculado)
    const slots: LessonSlot[] = [];
    const startTimeStr = ShiftTimes[shift]?.start || '08:00';
    const [startH, startM] = startTimeStr.split(':').map(Number);
    let currentTotalMinutes = startH * 60 + startM;
    const lessonDuration = 45; 

    for (let i = 1; i <= numClasses; i++) {
      const hStart = Math.floor(currentTotalMinutes / 60);
      const mStart = currentTotalMinutes % 60;
      
      const endTotalMinutes = currentTotalMinutes + lessonDuration; 
      const hEnd = Math.floor(endTotalMinutes / 60);
      const mEnd = endTotalMinutes % 60;

      slots.push({
        index: i,
        startTime: `${hStart.toString().padStart(2, '0')}:${mStart.toString().padStart(2, '0')}`,
        endTime: `${hEnd.toString().padStart(2, '0')}:${mEnd.toString().padStart(2, '0')}`
      });

      currentTotalMinutes = endTotalMinutes;
    }
    return slots;
  }, []);

  // Monitora mudanças para preencher slots padrão APENAS se não estivermos editando
  useEffect(() => {
    if (isAdding && !editingId && formData.lessonSlots.length === 0) {
      const initialSlots = generateDefaultSlots(formData.classesPerDay, formData.shift);
      setFormData(prev => ({ ...prev, lessonSlots: initialSlots }));
    }
  }, [isAdding, editingId, formData.classesPerDay, formData.shift, generateDefaultSlots]);

  const handleClassesPerDayChange = (val: number) => {
    const num = Math.max(1, Math.min(12, val));
    // Se mudou a quantidade de aulas, regeneramos os slots (mesmo na edição, para manter consistência com o padrão)
    const newSlots = generateDefaultSlots(num, formData.shift);
    setFormData({ ...formData, classesPerDay: num, lessonSlots: newSlots });
  };

  const updateSlotTime = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const updatedSlots = [...formData.lessonSlots];
    updatedSlots[index] = { ...updatedSlots[index], [field]: value };
    setFormData({ ...formData, lessonSlots: updatedSlots });
  };

  const toggleWeekDay = (dayIndex: number) => {
    const current = formData.weekDays || [];
    if (current.includes(dayIndex)) {
        setFormData({ ...formData, weekDays: current.filter(d => d !== dayIndex) });
    } else {
        setFormData({ ...formData, weekDays: [...current, dayIndex].sort() });
    }
  };

  const isDirty = isAdding && (formData.name.trim() !== '' || formData.courseId !== '');

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      const proceed = window.confirm("Você tem dados não salvos. Deseja sair?");
      if (proceed) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);

  const handleSave = () => {
    if (!formData.name || !formData.courseId || !formData.roomId || !formData.projectId || !formData.startDate) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    if (editingId) {
      // Modo Edição
      setGroups(groups.map(g => g.id === editingId ? { ...formData, id: editingId } : g));
      alert("Turma atualizada com sucesso!");
    } else {
      // Modo Cadastro
      setGroups([...groups, { ...formData, id: Math.random().toString(36).substr(2, 9) }]);
      alert("Turma cadastrada com sucesso!");
    }

    setIsAdding(false);
    setEditingId(null);
    setFormData({ 
      name: '', courseId: '', projectId: '', shift: Shift.MANHA, roomId: '', classesPerDay: 5, startDate: new Date().toISOString().split('T')[0], estimatedEndDate: '', weekDays: [1,2,3,4,5], status: 'ACTIVE', lessonSlots: [], classCalendar: ''
    });
  };

  const handleEditClick = (group: ClassGroup) => {
    setFormData({
      name: group.name,
      courseId: group.courseId,
      projectId: group.projectId || '',
      shift: group.shift,
      roomId: group.roomId,
      classesPerDay: group.classesPerDay,
      startDate: group.startDate,
      estimatedEndDate: group.estimatedEndDate,
      weekDays: group.weekDays || [1,2,3,4,5],
      status: group.status || 'ACTIVE',
      lessonSlots: group.lessonSlots,
      classCalendar: group.classCalendar || ''
    });
    setEditingId(group.id);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ 
      name: '', courseId: '', projectId: '', shift: Shift.MANHA, roomId: '', classesPerDay: 5, startDate: new Date().toISOString().split('T')[0], estimatedEndDate: '', weekDays: [1,2,3,4,5], status: 'ACTIVE', lessonSlots: [], classCalendar: ''
    });
  };

  const handleCalendarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert("Por favor, selecione apenas arquivos PDF.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert("O arquivo é muito grande. Tamanho máximo: 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, classCalendar: reader.result as string });
        alert("Calendário da turma carregado com sucesso!");
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestão de Turmas</h2>
          <p className="text-sm text-slate-500">Administre as turmas ativas e suas configurações de horário.</p>
        </div>
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Nova Turma
          </button>
        )}
      </div>

      {/* BARRA DE FILTROS */}
      {!isAdding && (
        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm items-center">
            <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                <span className="text-xs font-bold text-slate-500 uppercase">Filtrar por:</span>
            </div>
            
            <select 
                value={filterProject} 
                onChange={(e) => setFilterProject(e.target.value)}
                className="border border-slate-200 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 text-slate-700 font-medium"
            >
                <option value="">Todos os Projetos</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <select 
                value={filterCourse} 
                onChange={(e) => setFilterCourse(e.target.value)}
                className="border border-slate-200 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 text-slate-700 font-medium max-w-[200px]"
            >
                <option value="">Todos os Cursos</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select 
                value={filterShift} 
                onChange={(e) => setFilterShift(e.target.value)}
                className="border border-slate-200 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 text-slate-700 font-medium"
            >
                <option value="">Todos os Turnos</option>
                {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-slate-200 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 text-slate-700 font-medium"
            >
                <option value="">Todos os Status</option>
                <option value="ACTIVE">Em Andamento</option>
                <option value="CONCLUDED">Concluída</option>
            </select>

            {(filterProject || filterCourse || filterShift || filterStatus) && (
                <button 
                    onClick={() => { setFilterProject(''); setFilterCourse(''); setFilterShift(''); setFilterStatus(''); }}
                    className="text-xs text-red-500 font-bold hover:underline ml-auto"
                >
                    Limpar Filtros
                </button>
            )}
        </div>
      )}

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-xl space-y-6 relative max-w-5xl mx-auto animate-in zoom-in-95 duration-200">
          <div className="absolute top-4 right-4 text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            {editingId ? 'Editando Turma' : 'Modo de Cadastro'}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="lg:col-span-2">
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Turma</label>
               <input placeholder="Ex: INF-2024-1" className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Curso</label>
               <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.courseId} onChange={e => setFormData({...formData, courseId: e.target.value})}>
                  <option value="">Selecione o Curso</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo / Projeto</label>
               <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.projectId} onChange={e => setFormData({...formData, projectId: e.target.value})}>
                  <option value="">Selecione o Projeto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Turno</label>
               <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.shift} onChange={e => {
                  const newShift = e.target.value as Shift;
                  // Ao mudar o turno, regenera os slots
                  const newSlots = generateDefaultSlots(formData.classesPerDay, newShift);
                  setFormData({...formData, shift: newShift, lessonSlots: newSlots});
               }}>
                  {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
               </select>
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sala Padrão</label>
               <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.roomId} onChange={e => setFormData({...formData, roomId: e.target.value})}>
                  <option value="">Selecione a Sala</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
               </select>
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
               <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as 'ACTIVE' | 'CONCLUDED'})}>
                  <option value="ACTIVE">Em Andamento</option>
                  <option value="CONCLUDED">Concluída</option>
               </select>
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início</label>
               <input type="date" className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
             </div>
             <div>
               <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fim Previsto</label>
               <input type="date" className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.estimatedEndDate} onChange={e => setFormData({...formData, estimatedEndDate: e.target.value})} />
             </div>
             
             {/* Upload de Calendário */}
             <div className="lg:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Calendário da Turma (PDF)</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => calendarInputRef.current?.click()}
                    className={`flex-1 border p-2 rounded font-bold text-xs transition-colors flex items-center justify-center gap-2 ${formData.classCalendar ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-400'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                    {formData.classCalendar ? 'PDF Carregado' : 'Carregar PDF'}
                  </button>
                  {formData.classCalendar && (
                    <button 
                      onClick={() => setFormData({...formData, classCalendar: ''})}
                      className="bg-red-50 text-red-500 p-2 rounded border border-red-100 hover:bg-red-100"
                      title="Remover calendário"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                <input type="file" ref={calendarInputRef} className="hidden" accept="application/pdf" onChange={handleCalendarUpload} />
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t">
            {/* Configuração de Dias e Horários */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-500 uppercase">Configuração das Aulas</label>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] text-slate-400">Qtde:</span>
                   <select 
                    className="w-16 border p-1 rounded text-center font-bold text-indigo-600 outline-none" 
                    value={formData.classesPerDay} 
                    onChange={e => handleClassesPerDayChange(parseInt(e.target.value) || 5)} 
                  >
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                  </select>
                </div>
              </div>

              {/* Seletor de Dias da Semana */}
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                 <span className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Dias de Aula</span>
                 <div className="flex justify-between">
                    {weekDaysMap.map((day, idx) => (
                        <button
                            key={idx}
                            onClick={() => toggleWeekDay(idx)}
                            className={`w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center transition-all ${
                                (formData.weekDays || []).includes(idx) 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            {day.charAt(0)}
                        </button>
                    ))}
                 </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {formData.lessonSlots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 w-8">{idx + 1}ª</span>
                    <input type="time" className="flex-1 bg-white border rounded text-xs p-1" value={slot.startTime} onChange={e => updateSlotTime(idx, 'startTime', e.target.value)} />
                    <span className="text-slate-300">-</span>
                    <input type="time" className="flex-1 bg-white border rounded text-xs p-1" value={slot.endTime} onChange={e => updateSlotTime(idx, 'endTime', e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Visualização da Grade do Curso Selecionado */}
            <div className="lg:col-span-2 space-y-4 border-l pl-6">
              <label className="block text-xs font-bold text-slate-500 uppercase">Grade Curricular Herda do Curso</label>
              
              {!selectedCourse ? (
                <div className="h-40 flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <p className="text-sm text-slate-400">Selecione um curso para ver a grade e o cálculo de dias letivos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-800 uppercase mb-1">Informações de Carga Horária</p>
                    <p className="text-[11px] text-indigo-600">Considerando {formData.classesPerDay} aulas por dia ({currentHoursPerDay.toFixed(2)}h/dia)</p>
                  </div>
                  <table className="w-full text-left">
                    <thead className="text-[10px] font-bold text-slate-400 uppercase border-b">
                      <tr>
                        <th className="pb-2">Unidade</th>
                        <th className="pb-2 text-center">Horas</th>
                        <th className="pb-2 text-center">Aulas</th>
                        <th className="pb-2 text-center">Dias Letivos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedCourse.subjects.map((sub, idx) => {
                        const days = (sub.hours / currentHoursPerDay).toFixed(1);
                        const classesCount = Math.ceil(sub.hours / currentHourUnit);
                        return (
                          <tr key={idx} className="text-xs">
                            <td className="py-2 font-medium text-slate-700">{sub.name}</td>
                            <td className="py-2 text-center text-slate-600 font-mono">{sub.hours}h</td>
                            <td className="py-2 text-center text-slate-500 font-bold">{classesCount}</td>
                            <td className="py-2 text-center">
                              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">{days} dias</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold text-xs">
                      <tr>
                        <td className="py-2 px-2">Total Estimado</td>
                        <td className="text-center">{selectedCourse.subjects.reduce((a,b) => a+b.hours, 0)}h</td>
                        <td className="text-center text-slate-500">
                            {Math.ceil(selectedCourse.subjects.reduce((a,b) => a+b.hours, 0) / currentHourUnit)}
                        </td>
                        <td className="text-center text-indigo-600">
                          {(selectedCourse.subjects.reduce((a,b) => a+b.hours, 0) / currentHoursPerDay).toFixed(0)} dias
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
             <button onClick={handleCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Descartar</button>
             <button onClick={handleSave} className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
                {editingId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR TURMA'}
             </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGroups.map(group => {
          const course = courses.find(c => c.id === group.courseId);
          const room = rooms.find(r => r.id === group.roomId);
          const project = projects.find(p => p.id === group.projectId);
          const area = areas.find(a => a.id === course?.areaId);
          const totalHours = course?.subjects.reduce((acc, curr) => acc + curr.hours, 0) || 0;
          const isConcluded = group.status === 'CONCLUDED';
          
          // Helper local para cards (se não houver recarregamento do componente)
          const getLocalHourUnit = (c: number) => c === 4 ? 1.0 : (c === 6 ? 5.0/6.0 : 0.75);
          const groupHourUnit = getLocalHourUnit(group.classesPerDay);

          // NOVOS CÁLCULOS SOLICITADOS
          const totalClassesCalc = Math.ceil(totalHours / groupHourUnit); // Aulas Totais Ajustadas
          const duration4h = Math.ceil(totalHours / 4); // Duração Est. (4h/dia) - Referência fixa
          
          // Cálculo de Dias Corridos (Baseado no calendário)
          let calendarDaysStr = '-';
          if (group.startDate && group.estimatedEndDate) {
             const start = new Date(group.startDate);
             const end = new Date(group.estimatedEndDate);
             const diffTime = Math.abs(end.getTime() - start.getTime());
             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
             calendarDaysStr = `${diffDays}`;
          }
          
          // Cálculo de Aulas (Comparativo Previsto vs Agendado)
          const expectedClasses = course?.totalClasses || totalClassesCalc; // Usa o calculado se não houver no curso
          const scheduledEventsCount = events.filter(e => e.classGroupId === group.id && e.type === 'AULA').length;
          const scheduledClasses = scheduledEventsCount * group.classesPerDay;
          
          const progressPercent = expectedClasses > 0 ? Math.min((scheduledClasses / expectedClasses) * 100, 100) : 0;
          
          // Determina cor do status
          let statusColor = 'text-emerald-500';
          let progressColor = 'bg-emerald-400';
          let statusLabel = 'Completo';

          if (scheduledClasses < expectedClasses) {
             statusColor = 'text-amber-500';
             progressColor = 'bg-amber-400';
             statusLabel = 'Pendente';
          } else if (scheduledClasses > expectedClasses) {
             statusColor = 'text-red-500';
             progressColor = 'bg-red-400';
             statusLabel = 'Excedido';
          }

          // Dias da Semana formatados
          const weekDaysDisplay = (group.weekDays || [1,2,3,4,5]).map(d => weekDaysMap[d].charAt(0)).join(', ');

          return (
            <div key={group.id} className={`bg-white p-5 rounded-xl border shadow-sm flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group ${isConcluded ? 'opacity-70 border-slate-200 bg-slate-50' : 'border-slate-200'}`}>
               
               {isConcluded && (
                 <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                    <span className="text-3xl font-black text-slate-300 uppercase -rotate-12 border-4 border-slate-300 px-4 py-2 rounded-xl opacity-50">Concluída</span>
                 </div>
               )}

               <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 transition-opacity z-20">
                 <span className="text-[10px] font-bold bg-slate-100 px-2 py-1 rounded">{group.classesPerDay} aulas/dia</span>
               </div>
               
               <div className="mb-2 flex items-center gap-2">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${isConcluded ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                    {project?.name || 'Projeto não definido'}
                  </span>
                  {group.status === 'CONCLUDED' && <span className="text-[9px] bg-slate-800 text-white px-2 py-0.5 rounded-full font-bold uppercase">Concluída</span>}
               </div>
               <h4 className="text-xl font-bold text-slate-800 mb-1">{group.name}</h4>
               <p 
                 className="text-sm font-medium mb-4" 
                 style={{ color: isConcluded ? '#94a3b8' : (area?.color || '#4f46e5') }}
               >
                 {course?.name}
               </p>
               
               <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Sala Padrão</span>
                    <span className="text-slate-600">{room?.name}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Turno / Dias</span>
                    <div className="flex flex-col items-end">
                       <span className="text-slate-600">{group.shift}</span>
                       <span className="text-[8px] bg-slate-100 px-1 rounded">{weekDaysDisplay}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Período</span>
                    <span className="text-indigo-600 text-[9px]">{group.startDate.split('-').reverse().join('/')} - {group.estimatedEndDate ? group.estimatedEndDate.split('-').reverse().join('/') : 'A definir'}</span>
                  </div>
                  
                  {/* NOVOS CAMPOS ADICIONADOS */}
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 border-t border-slate-100 pt-1 mt-1">
                    <span>Aulas Totais</span>
                    <span className="text-slate-600">{totalClassesCalc}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Duração Est. (4h/dia)</span>
                    <span className="text-emerald-600">{duration4h} dias</span>
                  </div>
                  
                  <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>Duração (Calendário)</span>
                    <span className="text-slate-600">{calendarDaysStr} dias</span>
                  </div>
               </div>

               {/* Comparativo de Aulas (Previsto vs Agendado) */}
               <div className="mt-2 pt-3 border-t border-slate-50 mb-4">
                   <div className="flex justify-between items-center text-[10px] uppercase font-bold mb-1">
                      <span className="text-slate-400">Agendamento</span>
                      <span className={statusColor}>
                         {scheduledClasses} / {expectedClasses} aulas
                      </span>
                   </div>
                   <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${isConcluded ? 'bg-slate-400' : progressColor}`}
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                   </div>
                   {!isConcluded && scheduledClasses < expectedClasses && (
                      <p className="text-[9px] text-amber-600 mt-1 font-medium text-right">
                         Faltam {Math.ceil((expectedClasses - scheduledClasses) / group.classesPerDay)} dias na agenda.
                      </p>
                   )}
                   {!isConcluded && scheduledClasses > expectedClasses && (
                      <p className="text-[9px] text-red-500 mt-1 font-medium text-right">
                         {scheduledClasses - expectedClasses} aulas além do previsto.
                      </p>
                   )}
               </div>

               <div className="mt-auto pt-4 border-t flex justify-between items-center z-20 relative">
                  <div className="flex -space-x-2 items-center">
                    {course?.subjects.slice(0, 3).map((s, i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[8px] font-bold text-slate-400 uppercase" title={s.name}>
                        {s.name.charAt(0)}
                      </div>
                    ))}
                    {group.classCalendar && (
                        <a 
                          href={group.classCalendar} 
                          download={`Calendario_${group.name.replace(/\s+/g, '_')}.pdf`}
                          className="w-6 h-6 rounded-full bg-amber-500 border border-white flex items-center justify-center text-white shadow-sm hover:bg-amber-600 transition-colors ml-1 z-30"
                          title="Baixar Calendário da Turma (PDF)"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                        </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEditClick(group)}
                      className="text-indigo-600 text-xs font-bold hover:bg-indigo-50 px-2 py-1 rounded transition-colors uppercase"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => {
                        if(window.confirm("Deseja realmente remover esta turma?")) {
                          setGroups(groups.filter(x => x.id !== group.id));
                        }
                      }} 
                      className="text-red-500 text-xs font-bold hover:bg-red-50 px-2 py-1 rounded transition-colors uppercase"
                    >
                      Remover
                    </button>
                  </div>
               </div>
            </div>
          );
        })}
        {filteredGroups.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400">
                <p>Nenhuma turma encontrada com os filtros selecionados.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Classes;
