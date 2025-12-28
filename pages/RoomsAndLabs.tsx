
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Room, ScheduleEvent, Shift } from '../types';

const RoomsAndLabs: React.FC = () => {
  const { rooms, setRooms, events, users, groups, courses } = useApp();
  const [activeTab, setActiveTab] = useState<'LIST' | 'OCCUPANCY'>('LIST');
  
  // State for List/CRUD View
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Room, 'id'>>({
    name: '',
    type: 'SALA',
    block: '',
    capacity: 30,
    pcCount: 0,
    hasTv: false,
    isActive: true
  });

  // State for Occupancy View
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [occupancyMode, setOccupancyMode] = useState<'REAL' | 'STANDARD'>('REAL');

  const handleSave = () => {
    if (!formData.name || !formData.block) {
      alert("Nome e Bloco são obrigatórios.");
      return;
    }

    if (editingId) {
      setRooms(rooms.map(r => r.id === editingId ? { ...formData, id: editingId } : r));
      alert("Local atualizado com sucesso!");
    } else {
      setRooms([...rooms, { ...formData, id: Math.random().toString(36).substr(2, 9) }]);
      alert("Local cadastrado com sucesso!");
    }

    resetForm();
  };

  const handleEdit = (room: Room) => {
    setFormData({
      name: room.name,
      type: room.type,
      block: room.block || '',
      capacity: room.capacity || 0,
      pcCount: room.pcCount || 0,
      hasTv: room.hasTv || false,
      isActive: room.isActive
    });
    setEditingId(room.id);
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Tem certeza que deseja remover este local?")) {
      setRooms(rooms.filter(r => r.id !== id));
    }
  };

  const resetForm = () => {
    setFormData({ name: '', type: 'SALA', block: '', capacity: 30, pcCount: 0, hasTv: false, isActive: true });
    setIsAdding(false);
    setEditingId(null);
  };

  const changeDate = (days: number) => {
    const d = new Date(filterDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setFilterDate(d.toISOString().split('T')[0]);
  };

  // Helper function to render occupancy cell
  const renderOccupancyCell = (roomId: string, shift: Shift) => {
    // 1. Agenda Real: Verifica eventos específicos para a data selecionada
    if (occupancyMode === 'REAL') {
        const event = events.find(e => 
          e.roomId === roomId && 
          e.date === filterDate && 
          e.shift === shift
        );

        if (event) {
            const instructor = users.find(u => u.id === event.instructorId);
            return (
                <div className="bg-indigo-50 border border-indigo-200 rounded p-1.5 h-full flex flex-col justify-center min-h-[60px]">
                   <p className="text-[10px] font-bold text-indigo-700 leading-tight line-clamp-2" title={event.title}>{event.title}</p>
                   <p className="text-[9px] text-slate-500 mt-1 truncate">{instructor?.name || 'Sem Instrutor'}</p>
                   {event.type !== 'AULA' && <span className="text-[8px] text-indigo-400 uppercase font-bold">{event.type}</span>}
                </div>
            );
        }
        
        // Se não tem evento específico, mas é modo REAL, mostra "Livre". 
        // Não faz fallback para turma padrão para não confundir dias sem aula.
    }

    // 2. Estrutura Padrão (Turmas): 
    // Verifica apenas se existe turma ATIVA configurada para esta sala/turno.
    // IGNORA a data (filterDate) para mostrar o planejamento estrutural fixo.
    if (occupancyMode === 'STANDARD') {
        const activeGroup = groups.find(g => 
            g.roomId === roomId && 
            g.shift === shift &&
            (g.status === 'ACTIVE' || !g.status) // Considera turmas sem status (legado) como ativas
        );

        if (activeGroup) {
            const course = courses.find(c => c.id === activeGroup.courseId);
            return (
                <div className="bg-white border border-slate-200 shadow-sm rounded p-1.5 h-full flex flex-col justify-center min-h-[60px] relative group">
                   <p className="text-[10px] font-bold text-slate-700 leading-tight line-clamp-2">{activeGroup.name}</p>
                   <p className="text-[9px] text-slate-500 mt-1 truncate">{course?.name || 'Curso'}</p>
                   <span className="text-[7px] text-slate-400 uppercase font-bold mt-0.5 px-1 rounded w-fit bg-slate-100">Sala Padrão</span>
                   
                   {/* Tooltip com período */}
                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity w-32 z-10 mb-1">
                      Período: {activeGroup.startDate.split('-').reverse().join('/')} até {activeGroup.estimatedEndDate ? activeGroup.estimatedEndDate.split('-').reverse().join('/') : '?'}
                   </div>
                </div>
            );
        }
    }

    return <div className="h-full min-h-[60px] flex items-center justify-center text-[10px] text-slate-300 italic font-medium">Livre</div>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Salas e Laboratórios</h2>
          <p className="text-sm text-slate-500">Gestão de infraestrutura física da instituição.</p>
        </div>
        
        <div className="flex bg-slate-200 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('LIST')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeTab === 'LIST' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
            >
                Gerenciamento
            </button>
            <button 
                onClick={() => setActiveTab('OCCUPANCY')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeTab === 'OCCUPANCY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
            >
                Mapa de Ocupação
            </button>
        </div>
      </div>

      {activeTab === 'LIST' && (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-end">
                {!isAdding && (
                <button 
                    onClick={() => setIsAdding(true)} 
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    Novo Local
                </button>
                )}
            </div>

            {isAdding && (
                <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-xl max-w-4xl mx-auto animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">
                    {editingId ? 'Editar Local' : 'Cadastrar Local'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Local</label>
                        <input className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Sala 203 ou Lab 01" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
                        <select className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as 'SALA' | 'LABORATORIO'})}>
                            <option value="SALA">Sala de Aula</option>
                            <option value="LABORATORIO">Laboratório</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bloco / Prédio</label>
                        <input className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={formData.block} onChange={e => setFormData({...formData, block: e.target.value})} placeholder="Ex: Bloco A" />
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-6">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Recursos & Capacidade</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Capacidade (Alunos)</label>
                            <input type="number" className="w-full border p-2 rounded text-sm text-center font-bold text-slate-700" value={formData.capacity} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 0})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qtd. Computadores</label>
                            <input type="number" className="w-full border p-2 rounded text-sm text-center font-bold text-slate-700" value={formData.pcCount} onChange={e => setFormData({...formData, pcCount: parseInt(e.target.value) || 0})} disabled={formData.type === 'SALA' && false} />
                        </div>
                        <div className="flex items-center gap-2 h-10">
                            <input type="checkbox" id="tvCheck" className="w-5 h-5 text-indigo-600 rounded" checked={formData.hasTv} onChange={e => setFormData({...formData, hasTv: e.target.checked})} />
                            <label htmlFor="tvCheck" className="text-sm font-bold text-slate-600 cursor-pointer">Possui TV / Projetor?</label>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="activeCheck" className="w-5 h-5 text-emerald-600 rounded" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
                        <label htmlFor="activeCheck" className="text-sm font-bold text-slate-600 cursor-pointer">Habilitado para Agendamento</label>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={resetForm} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded">Cancelar</button>
                        <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-md">Salvar Local</button>
                    </div>
                </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Lista de Salas */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                    Salas de Aula
                    </h3>
                    <div className="space-y-3">
                    {rooms.filter(r => r.type === 'SALA').map(r => (
                        <div key={r.id} className={`bg-white p-4 rounded-xl border flex flex-col gap-2 relative group transition-all ${!r.isActive ? 'opacity-60 grayscale bg-slate-50' : 'border-slate-200 hover:border-blue-300'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                <h4 className="font-bold text-slate-800">{r.name}</h4>
                                <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">{r.block}</span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(r)} className="p-1 text-indigo-500 hover:bg-indigo-50 rounded">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => handleDelete(r.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                <span className="flex items-center gap-1" title="Capacidade"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> {r.capacity}</span>
                                {r.hasTv && <span className="flex items-center gap-1 text-blue-600 font-bold bg-blue-50 px-1.5 rounded" title="Possui TV">TV</span>}
                                {!r.isActive && <span className="text-[9px] font-bold text-red-500 uppercase border border-red-200 px-1 rounded">Desabilitado</span>}
                            </div>
                        </div>
                    ))}
                    </div>
                </div>

                {/* Lista de Laboratórios */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                    Laboratórios
                    </h3>
                    <div className="space-y-3">
                    {rooms.filter(r => r.type === 'LABORATORIO').map(r => (
                        <div key={r.id} className={`bg-white p-4 rounded-xl border flex flex-col gap-2 relative group transition-all ${!r.isActive ? 'opacity-60 grayscale bg-slate-50' : 'border-slate-200 hover:border-emerald-300'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                <h4 className="font-bold text-slate-800">{r.name}</h4>
                                <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">{r.block}</span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(r)} className="p-1 text-indigo-500 hover:bg-indigo-50 rounded">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => handleDelete(r.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                <span className="flex items-center gap-1" title="Capacidade"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> {r.capacity}</span>
                                {(r.pcCount || 0) > 0 && <span className="flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded" title="Computadores"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> {r.pcCount} PCs</span>}
                                {r.hasTv && <span className="flex items-center gap-1 text-blue-600 font-bold bg-blue-50 px-1.5 rounded" title="Possui TV">TV</span>}
                                {!r.isActive && <span className="text-[9px] font-bold text-red-500 uppercase border border-red-200 px-1 rounded">Desabilitado</span>}
                            </div>
                        </div>
                    ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'OCCUPANCY' && (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row items-center justify-between gap-4">
               {/* Date Picker - Only relevant for 'REAL' mode */}
               <div className={`flex items-center gap-2 transition-opacity ${occupancyMode === 'STANDARD' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <input 
                    type="date" 
                    className="border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-600"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                  />
                  <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </button>
               </div>

               {/* View Mode Toggle */}
               <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setOccupancyMode('REAL')} 
                    className={`px-4 py-2 rounded-md text-xs font-bold uppercase transition-all flex items-center gap-2 ${occupancyMode === 'REAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Agenda Real
                  </button>
                  <button 
                    onClick={() => setOccupancyMode('STANDARD')} 
                    className={`px-4 py-2 rounded-md text-xs font-bold uppercase transition-all flex items-center gap-2 ${occupancyMode === 'STANDARD' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Estrutura Padrão
                  </button>
               </div>
            </div>

            {/* Occupancy Grid */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b tracking-wider">
                                <th className="p-4 w-1/4">Local / Sala</th>
                                <th className="p-4 w-1/4 text-center border-l bg-blue-50/30 text-blue-400">Manhã</th>
                                <th className="p-4 w-1/4 text-center border-l bg-orange-50/30 text-orange-400">Tarde</th>
                                <th className="p-4 w-1/4 text-center border-l bg-indigo-50/30 text-indigo-400">Noite</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {rooms.filter(r => r.isActive).sort((a,b) => a.name.localeCompare(b.name)).map(room => (
                                <tr key={room.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-8 rounded-full ${room.type === 'SALA' ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-xs">{room.name}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold bg-slate-100 px-1.5 rounded w-fit mt-0.5">{room.block}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-2 border-l h-20 align-top">
                                        {renderOccupancyCell(room.id, Shift.MANHA)}
                                    </td>
                                    <td className="p-2 border-l h-20 align-top">
                                        {renderOccupancyCell(room.id, Shift.TARDE)}
                                    </td>
                                    <td className="p-2 border-l h-20 align-top">
                                        {renderOccupancyCell(room.id, Shift.NOITE)}
                                    </td>
                                </tr>
                            ))}
                            {rooms.filter(r => r.isActive).length === 0 && (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Nenhum local ativo cadastrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default RoomsAndLabs;
