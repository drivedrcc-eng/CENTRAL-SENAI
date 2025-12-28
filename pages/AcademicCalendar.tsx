
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { CalendarEvent, CalendarEventType, ScheduleEvent } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const PRESET_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Slate
  '#14b8a6', // Teal
  '#f97316', // Orange
];

const AcademicCalendar: React.FC = () => {
  const { 
    calendarEvents, setCalendarEvents, 
    calendarCategories, setCalendarCategories, 
    customFont, reportBackground,
    events, setEvents, groups 
  } = useApp();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'LIST' | 'TYPES'>('CALENDAR');
  const [calendarViewMode, setCalendarViewMode] = useState<'MONTH' | 'YEAR'>('MONTH');

  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<{title: string, type: CalendarEventType, isDayOff: boolean, color: string}>({
    title: '', type: 'HOLIDAY', isDayOff: true, color: '#ef4444'
  });

  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listForm, setListForm] = useState<{
    date: string, title: string, type: CalendarEventType, isDayOff: boolean
  }>({
    date: '', title: '', type: 'HOLIDAY', isDayOff: true
  });

  const [typeForm, setTypeForm] = useState<{name: string, color: string}>({ name: '', color: '#3b82f6' });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // --- LÓGICA DE REAGENDAMENTO AUTOMÁTICO ---
  const reallocateClassEvents = (blockedDates: string[]) => {
    // 1. Identificar conflitos (Apenas AULAS em datas bloqueadas)
    const conflicts = events.filter(e => blockedDates.includes(e.date) && e.type === 'AULA');
    
    if (conflicts.length === 0) return 0;

    let updatedEvents = [...events];
    let movedCount = 0;

    // Remove os eventos conflitantes da lista temporária para não atrapalhar a busca do "último dia"
    updatedEvents = updatedEvents.filter(e => !(blockedDates.includes(e.date) && e.type === 'AULA'));

    conflicts.forEach(conflict => {
        const group = groups.find(g => g.id === conflict.classGroupId);
        if (!group) return; // Se não achar a turma, não é possível reagendar corretamente

        // Encontrar o último dia de aula agendado para esta turma e esta matéria
        // Usamos updatedEvents para considerar o estado atual da fila (inclusive se já movemos outra aula da mesma turma)
        const subjectEvents = updatedEvents.filter(e => 
            e.classGroupId === group.id && 
            e.subject === conflict.subject && 
            e.type === 'AULA'
        );

        // Ordenar por data
        subjectEvents.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const lastEvent = subjectEvents[subjectEvents.length - 1];
        
        // Data base para procurar o próximo slot:
        // Começa a procurar DEPOIS da última aula existente.
        // Se for a única aula, começa depois da data bloqueada.
        const baseDate = lastEvent ? new Date(lastEvent.date) : new Date(conflict.date);
        
        let nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + 1); // Avança 1 dia
        
        let found = false;
        let safety = 0;

        while (!found && safety < 365) {
            safety++;
            const dateStr = nextDate.toISOString().split('T')[0];
            const dayOfWeek = nextDate.getDay(); // 0=Dom, 1=Seg...

            // 1. Verifica Dia da Semana permitido pela turma (se não tiver weekDays, assume Seg-Sex)
            const allowedDays = group.weekDays && group.weekDays.length > 0 ? group.weekDays : [1,2,3,4,5];
            const isAllowedDay = allowedDays.includes(dayOfWeek);

            // 2. Verifica se é feriado (Existente OU Novo que está sendo inserido agora)
            const isHoliday = calendarEvents.some(c => c.date === dateStr && c.isDayOff) || blockedDates.includes(dateStr);

            if (isAllowedDay && !isHoliday) {
                found = true;
                // Cria o evento na nova data mantendo os dados originais
                updatedEvents.push({
                    ...conflict,
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    date: dateStr
                });
                movedCount++;
            } else {
                nextDate.setDate(nextDate.getDate() + 1);
            }
        }
    });

    if (movedCount > 0) {
        setEvents(updatedEvents);
    }
    
    return movedCount;
  };
  // ------------------------------------------

  const generateMonthGrid = (year: number, monthIndex: number) => {
    const days = [];
    const firstDayOfMonth = new Date(year, monthIndex, 1).getDay();
    const daysInCurrentMonth = new Date(year, monthIndex + 1, 0).getDate();
    
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push(new Date(year, monthIndex, i));
    }
    return days;
  };

  const currentMonthGrid = useMemo(() => generateMonthGrid(year, month), [year, month]);

  const calculateEaster = (y: number) => {
    const f = Math.floor,
        G = y % 19,
        C = f(y / 100),
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        J = (y + f(y / 4) + I + 2 - C + f(C / 4)) % 7,
        L = I - J,
        month = 3 + f((L + 40) / 44),
        day = L + 28 - 31 * f(month / 4);
    return new Date(y, month - 1, day);
  };

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const handleImportHolidays = () => {
    if(!window.confirm(`Deseja importar os feriados nacionais para o ano de ${year}? Eventos existentes nessas datas não serão sobrescritos.`)) return;

    const easter = calculateEaster(year);
    const carnival = addDays(easter, -47);
    const goodFriday = addDays(easter, -2);
    const corpusChristi = addDays(easter, 60);

    const holidays = [
      { date: `${year}-01-01`, title: 'Confraternização Universal' },
      { date: carnival.toISOString().split('T')[0], title: 'Carnaval' },
      { date: goodFriday.toISOString().split('T')[0], title: 'Sexta-feira Santa' },
      { date: `${year}-04-21`, title: 'Tiradentes' },
      { date: `${year}-05-01`, title: 'Dia do Trabalho' },
      { date: corpusChristi.toISOString().split('T')[0], title: 'Corpus Christi' },
      { date: `${year}-09-07`, title: 'Independência do Brasil' },
      { date: `${year}-10-12`, title: 'Nossa Sr.ª Aparecida' },
      { date: `${year}-11-02`, title: 'Finados' },
      { date: `${year}-11-15`, title: 'Proclamação da República' },
      { date: `${year}-12-25`, title: 'Natal' },
    ];

    const newEvents: CalendarEvent[] = [];
    const newDayOffDates: string[] = []; // Para reagendamento
    let addedCount = 0;

    holidays.forEach(h => {
       const exists = calendarEvents.some(e => e.date === h.date);
       if (!exists) {
         newEvents.push({
           id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
           date: h.date,
           title: h.title,
           type: 'HOLIDAY',
           isDayOff: true,
           color: '#ef4444'
         });
         newDayOffDates.push(h.date);
         addedCount++;
       }
    });

    if (addedCount > 0) {
      setCalendarEvents(prev => [...prev, ...newEvents]);
      
      // Aciona reagendamento
      const movedCount = reallocateClassEvents(newDayOffDates);
      
      let msg = `${addedCount} feriados importados com sucesso para ${year}!`;
      if (movedCount > 0) {
          msg += `\n\nALERTA: ${movedCount} aulas coincidiam com estes feriados e foram reagendadas automaticamente para o final do cronograma das respectivas turmas.`;
      }
      alert(msg);
    } else {
      alert(`Nenhum feriado novo adicionado. As datas para ${year} já podem estar cadastradas.`);
    }
  };

  const handleExportPDF = () => {
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

    const title = calendarViewMode === 'MONTH' 
        ? `Calendário Acadêmico - ${MONTHS[month]} ${year}`
        : `Calendário Acadêmico - Ano ${year}`;

    doc.setFontSize(16);
    doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]); 
    doc.text(title, pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 26, { align: 'center' });

    let finalY = 35;

    const renderTableForMonth = (mIndex: number) => {
        const mName = MONTHS[mIndex];
        const eventsInMonth = calendarEvents.filter(e => {
            const d = new Date(e.date + 'T00:00:00');
            return d.getMonth() === mIndex && d.getFullYear() === year;
        }).sort((a,b) => a.date.localeCompare(b.date));

        if (eventsInMonth.length === 0 && calendarViewMode === 'MONTH') {
            doc.text("Nenhum evento registrado.", 14, finalY);
            return;
        }
        if (eventsInMonth.length === 0) return;

        if (calendarViewMode === 'YEAR') {
            if (finalY > 250) {
                doc.addPage();
                finalY = 20;
            }
            doc.setFontSize(12);
            doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
            doc.text(mName, 14, finalY);
            finalY += 5;
        }

        const tableBody = eventsInMonth.map(ev => {
            const cat = calendarCategories.find(c => c.id === ev.type);
            const dateObj = new Date(ev.date + 'T00:00:00');
            const dayWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
            return [
                ev.date.split('-').reverse().join('/'),
                dayWeek.toUpperCase(),
                ev.title,
                cat?.name || ev.type,
                ev.isDayOff ? 'NÃO' : 'SIM'
            ];
        });

        autoTable(doc, {
            startY: finalY,
            head: [['Data', 'Dia', 'Evento', 'Tipo', 'Letivo?']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: [80, 80, 80], fontSize: 8, font: customFont ? 'CustomFont' : 'helvetica' },
            bodyStyles: { fontSize: 8, font: customFont ? 'CustomFont' : 'helvetica' },
            margin: { left: 14, right: 14 },
            willDrawPage: (data) => {
                if (reportBackground && data.pageNumber > 1) {
                    doc.addImage(reportBackground, 'PNG', 0, 0, 297, 210);
                }
            }
        });

        // @ts-ignore
        finalY = doc.lastAutoTable.finalY + 10;
    };

    if (calendarViewMode === 'MONTH') {
        renderTableForMonth(month);
    } else {
        for(let i=0; i<12; i++) {
            renderTableForMonth(i);
        }
    }

    doc.save(`Calendario_${calendarViewMode === 'MONTH' ? `${month+1}_${year}` : year}.pdf`);
  };

  const handleDayClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const existing = calendarEvents.find(e => e.date === dateStr);
    
    setSelectedDateStr(dateStr);
    if (existing) {
      setFormData({
        title: existing.title,
        type: existing.type,
        isDayOff: existing.isDayOff,
        color: existing.color || '#ef4444'
      });
    } else {
      const defaultType = calendarCategories[0];
      setFormData({ title: '', type: defaultType?.id || 'HOLIDAY', isDayOff: true, color: defaultType?.color || '#ef4444' });
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = () => {
    if (!selectedDateStr || !formData.title) return;
    
    const newEvent: CalendarEvent = {
      id: calendarEvents.find(e => e.date === selectedDateStr)?.id || Date.now().toString(),
      date: selectedDateStr,
      ...formData
    };

    const others = calendarEvents.filter(e => e.date !== selectedDateStr);
    setCalendarEvents([...others, newEvent]);
    setIsModalOpen(false);

    // Se o evento criado for um dia não letivo, verifica conflitos e reagenda
    if (formData.isDayOff) {
        const movedCount = reallocateClassEvents([selectedDateStr]);
        if (movedCount > 0) {
            alert(`Aviso: ${movedCount} aula(s) coincidia(m) com este novo evento e foi(ram) movida(s) automaticamente para o final do cronograma.`);
        }
    }
  };

  const handleDeleteModal = () => {
    if (!selectedDateStr) return;
    if (window.confirm('Remover este evento do calendário?')) {
      setCalendarEvents(calendarEvents.filter(e => e.date !== selectedDateStr));
      setIsModalOpen(false);
    }
  };

  const handleSaveListEvent = () => {
    if (!listForm.date || !listForm.title) return alert("Preencha data e título.");
    
    const category = calendarCategories.find(c => c.id === listForm.type);
    const color = category?.color || '#64748b';

    if (editingListId) {
      // Edição
      setCalendarEvents(calendarEvents.map(e => e.id === editingListId ? {
        ...e,
        date: listForm.date,
        title: listForm.title,
        type: listForm.type,
        isDayOff: listForm.isDayOff,
        color: color 
      } : e));
      setEditingListId(null);
      alert('Evento atualizado com sucesso!');
      
      // Reagendamento se tornou não letivo
      if (listForm.isDayOff) {
          const movedCount = reallocateClassEvents([listForm.date]);
          if (movedCount > 0) {
              alert(`Aviso: ${movedCount} aula(s) movida(s) automaticamente devido ao bloqueio da data.`);
          }
      }

    } else {
      // Novo
      const newEvent: CalendarEvent = {
          id: Date.now().toString(),
          date: listForm.date,
          title: listForm.title,
          type: listForm.type,
          isDayOff: listForm.isDayOff,
          color: color
      };
      setCalendarEvents([...calendarEvents, newEvent]);
      
      // Reagendamento se for não letivo
      if (listForm.isDayOff) {
          const movedCount = reallocateClassEvents([listForm.date]);
          if (movedCount > 0) {
              alert(`Aviso: ${movedCount} aula(s) coincidia(m) com a data e foi(ram) reagendada(s).`);
          }
      }
    }

    setListForm({ date: '', title: '', type: 'HOLIDAY', isDayOff: true });
  };

  const handleEditListEvent = (ev: CalendarEvent) => {
    setListForm({
      date: ev.date,
      title: ev.title,
      type: ev.type,
      isDayOff: ev.isDayOff
    });
    setEditingListId(ev.id);
  };

  const handleCancelListEdit = () => {
    setEditingListId(null);
    setListForm({ date: '', title: '', type: 'HOLIDAY', isDayOff: true });
  };

  const handleAddType = () => {
    if(!typeForm.name) return alert("Digite o nome do tipo.");
    const id = typeForm.name.toUpperCase().replace(/\s+/g, '_');
    
    if(calendarCategories.some(c => c.id === id)) return alert("Já existe um tipo com este código/nome.");

    setCalendarCategories([...calendarCategories, { id, name: typeForm.name, color: typeForm.color, isSystem: false }]);
    setTypeForm({ name: '', color: '#3b82f6' });
  };

  const handleDeleteType = (id: string) => {
    if(window.confirm("Excluir este tipo de evento? Eventos já criados com este tipo podem perder a referência de cor/nome.")) {
        setCalendarCategories(calendarCategories.filter(c => c.id !== id));
    }
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(year, month + offset, 1));
  };

  const changeYear = (offset: number) => {
    setCurrentDate(new Date(year + offset, month, 1));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Calendário Acadêmico</h2>
          <p className="text-sm text-slate-500">Gerencie feriados, recessos e eventos escolares que impactam a agenda.</p>
        </div>
        <div className="flex items-center gap-3">
          {viewMode === 'CALENDAR' && (
             <>
               <button 
                 onClick={handleExportPDF}
                 className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1"
                 title="Exportar em PDF"
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 PDF
               </button>
               <button 
                 onClick={handleImportHolidays}
                 className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors flex items-center gap-1"
                 title={`Importar feriados nacionais para ${year}`}
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 Importar Feriados ({year})
               </button>
             </>
          )}
          <div className="flex bg-slate-200 p-1 rounded-lg">
             <button 
               onClick={() => setViewMode('CALENDAR')} 
               className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'CALENDAR' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
             >
               Calendário
             </button>
             <button 
               onClick={() => setViewMode('LIST')} 
               className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'LIST' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
             >
               Lista
             </button>
             <button 
               onClick={() => setViewMode('TYPES')} 
               className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'TYPES' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
             >
               Tipos
             </button>
          </div>
        </div>
      </div>

      {viewMode === 'CALENDAR' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-6xl mx-auto animate-in fade-in duration-300">
          
          <div className="flex items-center justify-between mb-6">
             <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setCalendarViewMode('MONTH')} 
                  className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition-all ${calendarViewMode === 'MONTH' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Mensal
                </button>
                <button 
                  onClick={() => setCalendarViewMode('YEAR')} 
                  className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition-all ${calendarViewMode === 'YEAR' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Anual
                </button>
             </div>

             <div className="flex items-center gap-4">
                <button onClick={() => calendarViewMode === 'MONTH' ? changeMonth(-1) : changeYear(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="text-center min-w-[150px]">
                  {calendarViewMode === 'MONTH' ? (
                      <>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest leading-none">{MONTHS[month]}</h3>
                        <span className="text-indigo-600 font-bold">{year}</span>
                      </>
                  ) : (
                      <h3 className="text-2xl font-black text-indigo-600 tracking-widest">{year}</h3>
                  )}
                </div>
                <button onClick={() => calendarViewMode === 'MONTH' ? changeMonth(1) : changeYear(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </button>
             </div>
             <div className="w-[100px]"></div>
          </div>

          {calendarViewMode === 'MONTH' ? (
            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                {WEEKDAYS.map(d => (
                <div key={d} className="bg-slate-50 p-3 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
                    {d}
                </div>
                ))}
                
                {currentMonthGrid.map((date, idx) => {
                if (!date) return <div key={`empty-${idx}`} className="bg-white min-h-[100px]" />;
                
                const dateStr = date.toISOString().split('T')[0];
                const isToday = new Date().toISOString().split('T')[0] === dateStr;

                return (
                    <div 
                    key={dateStr} 
                    onClick={() => handleDayClick(date)}
                    className={`bg-white min-h-[100px] p-2 cursor-pointer transition-colors hover:bg-slate-50 relative group ${isToday ? 'bg-indigo-50/30' : ''}`}
                    >
                    <span className={`text-sm font-bold ${isToday ? 'text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full' : 'text-slate-500'}`}>
                        {date.getDate()}
                    </span>
                    <div className="mt-2 space-y-1">
                        {calendarEvents.filter(e => e.date === dateStr).map(ev => (
                            <div key={ev.id} className="text-[10px] truncate px-1.5 py-0.5 rounded font-bold text-white shadow-sm" style={{ backgroundColor: ev.color || '#ef4444' }}>
                                {ev.title}
                            </div>
                        ))}
                    </div>
                    </div>
                );
                })}
            </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
               {Array.from({ length: 12 }).map((_, mIndex) => {
                 const mGrid = generateMonthGrid(year, mIndex);
                 return (
                   <div key={mIndex} className="bg-white border rounded-lg p-2 flex flex-col h-full">
                     <h4 className="text-center font-bold text-slate-700 uppercase text-xs mb-2 bg-slate-50 py-1 rounded">{MONTHS[mIndex]}</h4>
                     <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 flex-1">
                       {WEEKDAYS.map(d => <div key={d} className="text-[8px] text-center text-slate-400 font-bold bg-white">{d.charAt(0)}</div>)}
                       {mGrid.map((d, i) => {
                          if(!d) return <div key={i} className="bg-white"></div>;
                          const dateStr = d.toISOString().split('T')[0];
                          const hasEvent = calendarEvents.some(e => e.date === dateStr);
                          const isDayOff = calendarEvents.some(e => e.date === dateStr && e.isDayOff);
                          return (
                            <div 
                              key={i} 
                              className={`bg-white h-6 flex items-center justify-center text-[9px] relative ${hasEvent ? (isDayOff ? 'text-red-500 font-bold' : 'text-blue-500 font-bold') : 'text-slate-600'}`}
                              title={calendarEvents.filter(e => e.date === dateStr).map(e => e.title).join(', ')}
                            >
                               {d.getDate()}
                               {hasEvent && <div className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isDayOff ? 'bg-red-500' : 'bg-blue-500'}`}></div>}
                            </div>
                          )
                       })}
                     </div>
                   </div>
                 )
               })}
             </div>
          )}
        </div>
      )}

      {viewMode === 'LIST' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
               <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b">{editingListId ? 'Editar Evento' : 'Novo Evento'}</h3>
               <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                    <input type="date" className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={listForm.date} onChange={e => setListForm({...listForm, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
                    <input className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={listForm.title} onChange={e => setListForm({...listForm, title: e.target.value})} placeholder="Ex: Dia do Professor" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                    <select className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={listForm.type} onChange={e => setListForm({...listForm, type: e.target.value})}>
                      {calendarCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="dayOffList" className="w-4 h-4 text-indigo-600 rounded" checked={listForm.isDayOff} onChange={e => setListForm({...listForm, isDayOff: e.target.checked})} />
                    <label htmlFor="dayOffList" className="text-sm font-bold text-slate-600">Dia Não Letivo / Feriado</label>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    {editingListId && <button onClick={handleCancelListEdit} className="flex-1 bg-slate-100 text-slate-500 py-2 rounded-lg font-bold text-xs uppercase hover:bg-slate-200">Cancelar</button>}
                    <button onClick={handleSaveListEvent} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold text-xs uppercase hover:bg-indigo-700 shadow">{editingListId ? 'Salvar' : 'Adicionar'}</button>
                  </div>
               </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
               <div className="p-4 bg-slate-50 border-b font-bold text-slate-500 text-xs uppercase flex justify-between">
                  <span>Eventos Cadastrados ({calendarEvents.length})</span>
               </div>
               <div className="overflow-y-auto flex-1 custom-scrollbar p-2 space-y-2">
                  {calendarEvents.sort((a,b) => a.date.localeCompare(b.date)).map(ev => {
                    const cat = calendarCategories.find(c => c.id === ev.type);
                    return (
                      <div key={ev.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-indigo-200 transition-colors shadow-sm">
                         <div className="flex items-center gap-3">
                            <div className="bg-slate-100 p-2 rounded text-center min-w-[50px]">
                               <span className="block text-[10px] font-bold text-slate-400 uppercase">{new Date(ev.date + 'T00:00:00').toLocaleString('pt-BR', { month: 'short' })}</span>
                               <span className="block text-lg font-bold text-slate-800 leading-none">{ev.date.split('-')[2]}</span>
                            </div>
                            <div>
                               <h4 className="font-bold text-slate-800">{ev.title}</h4>
                               <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded uppercase" style={{ backgroundColor: cat?.color || '#94a3b8' }}>{cat?.name}</span>
                                  {ev.isDayOff && <span className="text-[9px] font-bold text-red-500 border border-red-200 bg-red-50 px-1.5 py-0.5 rounded uppercase">Não Letivo</span>}
                               </div>
                            </div>
                         </div>
                         <div className="flex gap-1">
                            <button onClick={() => handleEditListEvent(ev)} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                            <button onClick={() => { if(window.confirm("Excluir evento?")) setCalendarEvents(calendarEvents.filter(e => e.id !== ev.id)); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                         </div>
                      </div>
                    );
                  })}
               </div>
            </div>
         </div>
      )}

      {viewMode === 'TYPES' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
               <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b">Gerenciar Categorias</h3>
               <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Categoria</label>
                    <input className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={typeForm.name} onChange={e => setTypeForm({...typeForm, name: e.target.value})} placeholder="Ex: Evento Escolar" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cor</label>
                     <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map(c => (
                           <button 
                             key={c}
                             onClick={() => setTypeForm({...typeForm, color: c})}
                             className={`w-6 h-6 rounded-full border-2 transition-all ${typeForm.color === c ? 'border-slate-600 scale-110' : 'border-transparent'}`}
                             style={{ backgroundColor: c }}
                           />
                        ))}
                     </div>
                  </div>
                  <button onClick={handleAddType} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold text-xs uppercase hover:bg-indigo-700 shadow mt-2">Adicionar Tipo</button>
               </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <ul className="divide-y divide-slate-100">
                  {calendarCategories.map(cat => (
                     <li key={cat.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                           <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: cat.color }}></div>
                           <span className="font-bold text-slate-700 text-sm">{cat.name}</span>
                           {cat.isSystem && <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold border">Sistema</span>}
                        </div>
                        {!cat.isSystem && (
                           <button onClick={() => handleDeleteType(cat.id)} className="text-red-400 hover:text-red-600 text-xs font-bold uppercase">Remover</button>
                        )}
                     </li>
                  ))}
               </ul>
            </div>
         </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">
                 {selectedDateStr?.split('-').reverse().join('/')}
              </h3>
              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título do Evento</label>
                    <input 
                      className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      autoFocus
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                    <select 
                      className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.type}
                      onChange={e => {
                         const cat = calendarCategories.find(c => c.id === e.target.value);
                         setFormData({...formData, type: e.target.value, color: cat?.color || '#ef4444'});
                      }}
                    >
                       {calendarCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="dayOffModal" 
                      className="w-4 h-4 text-indigo-600 rounded" 
                      checked={formData.isDayOff}
                      onChange={e => setFormData({...formData, isDayOff: e.target.checked})}
                    />
                    <label htmlFor="dayOffModal" className="text-sm font-bold text-slate-600">Dia Não Letivo / Feriado</label>
                 </div>
              </div>
              <div className="flex gap-2 mt-6 pt-2 border-t">
                 {calendarEvents.some(e => e.date === selectedDateStr) && (
                    <button onClick={handleDeleteModal} className="px-3 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-xs uppercase hover:bg-red-100">Excluir</button>
                 )}
                 <button onClick={() => setIsModalOpen(false)} className="flex-1 px-3 py-2 bg-slate-100 text-slate-500 rounded-lg font-bold text-xs uppercase hover:bg-slate-200">Cancelar</button>
                 <button onClick={handleSaveModal} className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase hover:bg-indigo-700 shadow">Salvar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;
