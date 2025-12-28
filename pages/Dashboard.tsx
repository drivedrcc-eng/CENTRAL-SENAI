import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ScheduleEvent } from '../types';

type StatusViewMode = 'DAY' | 'WEEK' | 'MONTH';

const Dashboard: React.FC = () => {
  const { 
    currentUser, 
    events, 
    users, 
    rooms, 
    groups
  } = useApp();
  
  const navigate = useNavigate();
  const location = useLocation();
  const isInstructor = currentUser?.role === 'INSTRUCTOR';

  // --- LÓGICA DE NOTIFICAÇÃO DE NOVOS AGENDAMENTOS ---
  // Alterado de number para array de eventos para mostrar detalhes
  const [newAllocations, setNewAllocations] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    if (isInstructor && currentUser) {
        // Tenta obter a data do login anterior passada pelo Login.tsx
        // Se não existir (refresh da página), usa uma janela de 24h atrás como fallback para "recente"
        const state = location.state as { previousLogin?: string } | null;
        const previousLogin = state?.previousLogin || new Date(Date.now() - 86400000).toISOString();
        
        const newEvents = events.filter(e => 
            e.instructorId === currentUser.id &&
            e.type === 'AULA' &&
            e.createdBy === 'SUPERVISION' &&
            e.createdAt && e.createdAt > previousLogin
        ).sort((a, b) => a.date.localeCompare(b.date)); // Ordena por data

        setNewAllocations(newEvents);
    }
  }, [events, currentUser, isInstructor, location.state]);

  const handleConfirmRead = () => {
      if (window.confirm("Confirmar ciência dos novos agendamentos? O aviso será removido da tela.")) {
          setNewAllocations([]);
      }
  };

  // --- LÓGICA DO QUADRO DE STATUS (MIGRADA) ---
  const [statusDate, setStatusDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusViewMode, setStatusViewMode] = useState<StatusViewMode>('DAY');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Stats dinâmicos baseados no perfil (Admin vs Instrutor)
  const stats = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];

      if (isInstructor && currentUser) {
          // --- ESTATÍSTICAS PARA INSTRUTOR ---
          const myEventsToday = events.filter(e => e.date === today && e.instructorId === currentUser.id).length;
          
          // Conta turmas únicas que o instrutor tem vínculo em eventos futuros ou passados
          const myGroupsIds = new Set(events.filter(e => e.instructorId === currentUser.id && e.classGroupId).map(e => e.classGroupId));
          const myActiveGroups = groups.filter(g => myGroupsIds.has(g.id) && g.status !== 'CONCLUDED').length;
          
          const mySkills = currentUser.competencyIds?.length || 0;
          const pendingAlerts = newAllocations.length;

          return {
              card1: { label: 'Minhas Aulas Hoje', value: myEventsToday, iconColor: 'text-blue-600', bg: 'bg-blue-50' },
              card2: { label: 'Minhas Turmas', value: myActiveGroups, iconColor: 'text-emerald-600', bg: 'bg-emerald-50' },
              card3: { label: 'Competências', value: mySkills, iconColor: 'text-indigo-600', bg: 'bg-indigo-50' },
              card4: { label: 'Avisos Pendentes', value: pendingAlerts, iconColor: 'text-amber-600', bg: 'bg-amber-50' }
          };
      } else {
          // --- ESTATÍSTICAS PARA ADMIN ---
          const activeInstructors = users.filter(u => u.role === 'INSTRUCTOR' && u.status === 'ACTIVE').length;
          const activeGroups = groups.filter(g => g.status !== 'CONCLUDED').length;
          const totalRooms = rooms.filter(r => r.isActive).length;
          const todayEvents = events.filter(e => e.date === today).length;
          
          return {
              card1: { label: 'Instrutores', value: activeInstructors, iconColor: 'text-blue-600', bg: 'bg-blue-50' },
              card2: { label: 'Turmas Ativas', value: activeGroups, iconColor: 'text-emerald-600', bg: 'bg-emerald-50' },
              card3: { label: 'Locais', value: totalRooms, iconColor: 'text-indigo-600', bg: 'bg-indigo-50' },
              card4: { label: 'Eventos Hoje', value: todayEvents, iconColor: 'text-amber-600', bg: 'bg-amber-50' }
          };
      }
  }, [users, groups, rooms, events, isInstructor, currentUser, newAllocations]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Olá, {currentUser?.name.split(' ')[0]}!
          </h2>
          <p className="text-slate-500 text-sm">
            {isInstructor ? 'Aqui está o resumo das suas atividades.' : 'Bem-vindo ao painel de controle.'}
          </p>
        </div>
        <div className="text-right hidden sm:block">
           <p className="text-xs font-bold text-slate-400 uppercase">Hoje</p>
           <p className="text-sm font-mono font-bold text-slate-600">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      {/* BANNER DE NOTIFICAÇÃO DE AGENDAMENTOS COM DETALHES */}
      {newAllocations.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg shadow-sm animate-in slide-in-from-top duration-500">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center">
                    <div className="bg-amber-100 p-2 rounded-full text-amber-600 mr-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-amber-800">Atenção! Atualizações na Escala</h3>
                        <p className="text-sm text-amber-700">A supervisão realizou <strong>{newAllocations.length}</strong> novo(s) agendamento(s) de aula para você recentemente.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => navigate('/schedule')}
                        className="bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-amber-700 transition-colors shadow-sm whitespace-nowrap"
                    >
                        Ver na Agenda
                    </button>
                    <button 
                        onClick={handleConfirmRead}
                        className="bg-white text-amber-600 border border-amber-200 px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-amber-50 transition-colors shadow-sm whitespace-nowrap flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        Confirmar Leitura
                    </button>
                </div>
            </div>

            {/* TABELA DE DETALHES DAS NOVAS AULAS */}
            <div className="mt-2 bg-white/60 rounded-lg border border-amber-100/50 p-2 max-h-60 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="text-amber-800/60 uppercase">
                            <th className="p-2">Data</th>
                            <th className="p-2">Turno</th>
                            <th className="p-2">Turma / Atividade</th>
                            <th className="p-2">Local</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100/50">
                        {newAllocations.map(ev => {
                            const room = rooms.find(r => r.id === ev.roomId);
                            return (
                                <tr key={ev.id}>
                                    <td className="p-2 font-bold text-amber-900">{ev.date.split('-').reverse().join('/')}</td>
                                    <td className="p-2 text-amber-800">{ev.shift}</td>
                                    <td className="p-2 text-amber-800">{ev.title} {ev.subject ? `(${ev.subject})` : ''}</td>
                                    <td className="p-2 text-amber-800">{room?.name || 'Local N/A'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* STAT CARDS - DINÂMICOS BASEADOS NO PERFIL */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-slate-400 uppercase">{stats.card1.label}</p>
               <p className="text-2xl font-black text-slate-800">{stats.card1.value}</p>
            </div>
            <div className={`p-3 rounded-full ${stats.card1.bg} ${stats.card1.iconColor}`}>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-slate-400 uppercase">{stats.card2.label}</p>
               <p className="text-2xl font-black text-slate-800">{stats.card2.value}</p>
            </div>
            <div className={`p-3 rounded-full ${stats.card2.bg} ${stats.card2.iconColor}`}>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" /></svg>
            </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-slate-400 uppercase">{stats.card3.label}</p>
               <p className="text-2xl font-black text-slate-800">{stats.card3.value}</p>
            </div>
            <div className={`p-3 rounded-full ${stats.card3.bg} ${stats.card3.iconColor}`}>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" /></svg>
            </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-xs font-bold text-slate-400 uppercase">{stats.card4.label}</p>
               <p className="text-2xl font-black text-slate-800">{stats.card4.value}</p>
            </div>
            <div className={`p-3 rounded-full ${stats.card4.bg} ${stats.card4.iconColor}`}>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
            </div>
         </div>
      </div>

      {/* QUICK LINKS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* AGENDA HOJE - FILTRADA PARA O USUÁRIO LOGADO */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
               <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               {isInstructor ? 'Minha Agenda de Hoje' : 'Agenda de Hoje (Geral)'}
            </h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                {events
                  .filter(e => e.date === new Date().toISOString().split('T')[0])
                  // Filtra apenas eventos do instrutor se for instrutor
                  .filter(e => !isInstructor || e.instructorId === currentUser?.id)
                  .sort((a,b) => a.shift.localeCompare(b.shift))
                  .map(ev => {
                      const room = rooms.find(r => r.id === ev.roomId);
                      const inst = users.find(u => u.id === ev.instructorId);
                      return (
                          <div key={ev.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <div>
                                  <p className="font-bold text-slate-800 text-sm">{ev.title}</p>
                                  <p className="text-xs text-slate-500">
                                      {isInstructor ? room?.name : `${inst?.name} • ${room?.name}`}
                                  </p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${ev.shift === 'NOITE' ? 'bg-indigo-100 text-indigo-700' : (ev.shift === 'TARDE' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}`}>
                                  {ev.shift}
                              </span>
                          </div>
                      )
                  })
                }
                {events.filter(e => e.date === new Date().toISOString().split('T')[0] && (!isInstructor || e.instructorId === currentUser?.id)).length === 0 && (
                    <p className="text-slate-400 text-center text-sm py-4 italic">Sem eventos agendados para hoje.</p>
                )}
            </div>
         </div>

         {/* SHORTCUTS / INFO */}
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <h3 className="text-lg font-bold text-slate-800 mb-4">Acesso Rápido</h3>
             <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => navigate('/schedule')} className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-700 hover:bg-indigo-100 transition-colors flex flex-col items-center justify-center gap-2">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                    <span className="font-bold text-sm">Ver Agenda</span>
                 </button>
                 <button onClick={() => navigate('/labs')} className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-colors flex flex-col items-center justify-center gap-2">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.594 15.12a2 2 0 00-1.022.547l-2.387 2.387a2 2 0 000 2.828l.172.172a2 2 0 002.828 0l2.387-2.387a2 2 0 011.022-.547l2.387-.477a6 6 0 013.86-.517l.318.158a6 6 0 003.86-.517l2.387 2.477a2 2 0 011.022.547l2.387 2.387a2 2 0 002.828 0l.172-.172a2 2 0 000-2.828l-2.387-2.387z" /></svg>
                    <span className="font-bold text-sm">Laboratórios</span>
                 </button>
                 <button onClick={() => navigate('/reports')} className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-blue-700 hover:bg-blue-100 transition-colors flex flex-col items-center justify-center gap-2">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span className="font-bold text-sm">Relatórios</span>
                 </button>
                 <button onClick={() => navigate('/senailab')} className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-amber-700 hover:bg-amber-100 transition-colors flex flex-col items-center justify-center gap-2">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>
                    <span className="font-bold text-sm">SENAI Lab</span>
                 </button>
             </div>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;