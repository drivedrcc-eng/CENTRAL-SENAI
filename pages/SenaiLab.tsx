
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { SenaiLabLog, SenaiLabResource, SenaiLabUsageType, Shift } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type HistoryViewMode = 'DAY' | 'WEEK' | 'MONTH';

const SenaiLab: React.FC = () => {
  const { 
    senaiLabLogs, setSenaiLabLogs,
    senaiLabResources, setSenaiLabResources,
    senaiLabUsageTypes, setSenaiLabUsageTypes,
    senaiLabModelUrl, setSenaiLabModelUrl,
    users, customLogo, customFont, reportBackground, currentUser
  } = useApp();

  const isInstructor = currentUser?.role === 'INSTRUCTOR';

  const [activeTab, setActiveTab] = useState<'LOGS' | 'SETTINGS'>('LOGS');

  // Estado para controle de edição
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // --- EXPORT MODAL STATE ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // --- LOG FORM STATE ---
  const [logForm, setLogForm] = useState<{
    date: string;
    shift: Shift;
    instructorId: string;
    resourceId: string;
    usageTypeId: string;
    quantity: number;
    description: string;
    authorizedBy: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    shift: Shift.MANHA,
    instructorId: isInstructor && currentUser ? currentUser.id : '',
    resourceId: '',
    usageTypeId: '',
    quantity: 1,
    description: '',
    authorizedBy: ''
  });

  // --- HISTORY VIEW STATE ---
  const [viewMode, setViewMode] = useState<HistoryViewMode>('WEEK');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterInstructorId, setFilterInstructorId] = useState('');

  // --- SETTINGS FORMS ---
  const [resourceForm, setResourceForm] = useState({ name: '', unit: '' });
  const [typeForm, setTypeForm] = useState({ name: '' });

  // Lista de instrutores disponíveis (excluindo admin e sem competências)
  const availableInstructors = useMemo(() => {
    return users.filter(u => 
        u.role !== 'SUPERVISION' && // Remove admin/supervisão da lista de agendamento
        u.username !== 'admin' && 
        u.competencyIds && 
        u.competencyIds.length > 0
    );
  }, [users]);

  // Lista de instrutores para o Filtro do Histórico (inclui todos que já fizeram registros)
  const filterInstructorsList = useMemo(() => {
      const ids = Array.from(new Set(senaiLabLogs.map(l => l.instructorId)));
      return users.filter(u => ids.includes(u.id));
  }, [senaiLabLogs, users]);

  // --- DATE HELPERS ---
  const getWeekRange = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  };

  const navigateDate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'DAY') newDate.setDate(newDate.getDate() + direction);
    if (viewMode === 'WEEK') newDate.setDate(newDate.getDate() + (direction * 7));
    if (viewMode === 'MONTH') newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const formattedDateLabel = useMemo(() => {
      if (viewMode === 'DAY') return currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      if (viewMode === 'MONTH') return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const { start, end } = getWeekRange(currentDate);
      return `${start.getDate()}/${start.getMonth()+1} a ${end.getDate()}/${end.getMonth()+1}`;
  }, [currentDate, viewMode]);

  // --- FILTER LOGIC ---
  const filteredLogs = useMemo(() => {
    return senaiLabLogs.filter(log => {
        // Filtro por Instrutor
        if (filterInstructorId && log.instructorId !== filterInstructorId) return false;

        // Filtro por Data (ViewMode)
        const logDate = new Date(log.date + 'T00:00:00');
        
        if (viewMode === 'DAY') {
            return log.date === currentDate.toISOString().split('T')[0];
        }
        if (viewMode === 'WEEK') {
            const { start, end } = getWeekRange(currentDate);
            // Ajustar horas para comparação correta
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
            return logDate >= start && logDate <= end;
        }
        if (viewMode === 'MONTH') {
            return logDate.getMonth() === currentDate.getMonth() && logDate.getFullYear() === currentDate.getFullYear();
        }
        return true;
    }).sort((a,b) => b.date.localeCompare(a.date) || a.shift.localeCompare(b.shift)); // Sort by Date desc, then Shift
  }, [senaiLabLogs, viewMode, currentDate, filterInstructorId]);


  // --- HANDLERS ---

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.resourceId || !logForm.instructorId || !logForm.usageTypeId || logForm.quantity <= 0 || !logForm.authorizedBy) {
      alert("Preencha todos os campos obrigatórios corretamente, incluindo quem autorizou.");
      return;
    }

    // Validação de Conflito (Ignora o próprio registro se estiver editando)
    const conflict = senaiLabLogs.find(l => 
        l.id !== editingLogId && // Importante: não conflitar consigo mesmo na edição
        l.date === logForm.date && 
        l.shift === logForm.shift && 
        l.resourceId === logForm.resourceId
    );

    if (conflict) {
        const resName = senaiLabResources.find(r => r.id === logForm.resourceId)?.name;
        alert(`CONFLITO DE AGENDAMENTO:\nO recurso "${resName}" já está reservado para a data ${logForm.date.split('-').reverse().join('/')} no turno ${logForm.shift}.`);
        return;
    }

    if (editingLogId) {
        // Atualizar existente
        setSenaiLabLogs(senaiLabLogs.map(l => l.id === editingLogId ? { ...l, ...logForm } : l));
        alert("Agendamento atualizado com sucesso!");
        handleCancelEdit();
    } else {
        // Criar novo
        const newLog: SenaiLabLog = {
          id: Date.now().toString(),
          ...logForm,
          createdAt: new Date().toISOString()
        };

        setSenaiLabLogs([newLog, ...senaiLabLogs]);
        // Reset parcial para facilitar múltiplos lançamentos
        setLogForm(prev => ({ 
            ...prev, 
            quantity: 1, 
            description: '', 
            resourceId: '', 
            usageTypeId: '',
            authorizedBy: ''
        }));
        alert("Uso registrado com sucesso!");
    }
  };

  const handleEditLog = (log: SenaiLabLog) => {
    setLogForm({
        date: log.date,
        shift: log.shift,
        instructorId: log.instructorId,
        resourceId: log.resourceId,
        usageTypeId: log.usageTypeId,
        quantity: log.quantity,
        description: log.description || '',
        authorizedBy: log.authorizedBy
    });
    setEditingLogId(log.id);
    // Move scroll para o topo se estiver em mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    setLogForm({
        date: new Date().toISOString().split('T')[0],
        shift: Shift.MANHA,
        instructorId: isInstructor && currentUser ? currentUser.id : '',
        resourceId: '',
        usageTypeId: '',
        quantity: 1,
        description: '',
        authorizedBy: ''
    });
  };

  const handleDeleteLog = (id: string) => {
    if (window.confirm("Deseja remover este registro de uso?")) {
      setSenaiLabLogs(senaiLabLogs.filter(l => l.id !== id));
      if (editingLogId === id) handleCancelEdit();
    }
  };

  const handleAddResource = () => {
    if (!resourceForm.name || !resourceForm.unit) return alert("Preencha nome e unidade.");
    const newRes: SenaiLabResource = {
      id: Date.now().toString(),
      name: resourceForm.name,
      unit: resourceForm.unit
    };
    setSenaiLabResources([...senaiLabResources, newRes]);
    setResourceForm({ name: '', unit: '' });
  };

  const handleRemoveResource = (id: string) => {
    if (window.confirm("Remover este recurso? O histórico de uso será mantido, mas o nome pode ser perdido se não tratado.")) {
      setSenaiLabResources(senaiLabResources.filter(r => r.id !== id));
    }
  };

  const handleAddType = () => {
    if (!typeForm.name) return alert("Preencha o nome do tipo de uso.");
    const newType: SenaiLabUsageType = {
      id: Date.now().toString(),
      name: typeForm.name
    };
    setSenaiLabUsageTypes([...senaiLabUsageTypes, newType]);
    setTypeForm({ name: '' });
  };

  const handleRemoveType = (id: string) => {
    if (window.confirm("Remover este tipo de uso?")) {
      setSenaiLabUsageTypes(senaiLabUsageTypes.filter(t => t.id !== id));
    }
  };

  // --- PDF GENERATION ---
  const handleGeneratePDF = () => {
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

    const exportData = senaiLabLogs.filter(l => 
        l.date >= exportFilter.startDate && l.date <= exportFilter.endDate
    ).sort((a,b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));

    if (exportData.length === 0) {
        alert("Nenhum registro encontrado no período selecionado.");
        return;
    }

    doc.setFontSize(16);
    doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]); 
    // Title Case applied
    doc.text("Relatório De Uso - SENAI Lab", pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${exportFilter.startDate.split('-').reverse().join('/')} a ${exportFilter.endDate.split('-').reverse().join('/')}`, pageWidth / 2, 26, { align: 'center' });

    const tableBody = exportData.map(log => {
        const res = senaiLabResources.find(r => r.id === log.resourceId);
        const user = users.find(u => u.id === log.instructorId);
        const type = senaiLabUsageTypes.find(t => t.id === log.usageTypeId);
        
        return [
            log.date.split('-').reverse().join('/'),
            log.shift,
            res?.name || 'N/A',
            user?.name || 'N/A',
            type?.name || 'N/A',
            `${log.quantity} ${res?.unit}`,
            log.authorizedBy || '-'
        ];
    });

    autoTable(doc, {
        startY: 35,
        head: [['Data', 'Turno', 'Recurso', 'Responsável', 'Tipo Uso', 'Qtd', 'Aut. Por']],
        body: tableBody,
        headStyles: { fillColor: COLOR_PRIMARY, fontSize: 8, font: customFont ? 'CustomFont' : 'helvetica' },
        bodyStyles: { fontSize: 7, font: customFont ? 'CustomFont' : 'helvetica' },
        willDrawPage: (data) => {
            if (reportBackground && data.pageNumber > 1) {
                doc.addImage(reportBackground, 'PNG', 0, 0, 297, 210);
            }
        }
    });

    doc.save(`SenaiLab_Report_${exportFilter.startDate}_${exportFilter.endDate}.pdf`);
    setIsExportModalOpen(false);
  };

  const handleOpenModelLink = () => {
      if (!senaiLabModelUrl) {
          alert('URL de modelos não configurada. Vá em "Cadastros" para configurar.');
          return;
      }
      window.open(senaiLabModelUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">SENAI Lab</h2>
          <p className="text-sm text-slate-500">Gestão de uso de recursos maker e equipamentos.</p>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={handleOpenModelLink}
                className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold uppercase hover:bg-indigo-100 transition-colors flex items-center gap-2"
                title={senaiLabModelUrl || 'Link não configurado'}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.594 15.12a2 2 0 00-1.022.547l-2.387 2.387a2 2 0 000 2.828l.172.172a2 2 0 002.828 0l2.387-2.387a2 2 0 011.022-.547l2.387-.477a6 6 0 013.86-.517l.318.158a6 6 0 003.86-.517l2.387 2.477a2 2 0 011.022.547l2.387 2.387a2 2 0 002.828 0l.172-.172a2 2 0 000-2.828l-2.387-2.387z" /></svg>
                Modelos 3D e Corte a Laser
            </button>

            <div className="flex bg-slate-200 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTab('LOGS')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeTab === 'LOGS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
                >
                    Registro de Uso
                </button>
                {!isInstructor && (
                    <button 
                        onClick={() => setActiveTab('SETTINGS')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeTab === 'SETTINGS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
                    >
                        Cadastros
                    </button>
                )}
            </div>
        </div>
      </div>

      {activeTab === 'LOGS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300 relative">
          {/* ... (Existing JSX - unchanged) ... */}
          {/* Modal de Exportação */}
          {isExportModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200 rounded-xl h-full">
               <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                     <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                     Exportar Relatório PDF
                  </h3>
                  
                  <div className="space-y-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Início</label>
                        <input 
                          type="date" 
                          className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-amber-500" 
                          value={exportFilter.startDate} 
                          onChange={e => setExportFilter({...exportFilter, startDate: e.target.value})} 
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Fim</label>
                        <input 
                          type="date" 
                          className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-amber-500" 
                          value={exportFilter.endDate} 
                          onChange={e => setExportFilter({...exportFilter, endDate: e.target.value})} 
                        />
                     </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                     <button 
                       onClick={() => setIsExportModalOpen(false)} 
                       className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-bold text-xs uppercase hover:bg-slate-200"
                     >
                       Cancelar
                     </button>
                     <button 
                       onClick={handleGeneratePDF} 
                       className="px-6 py-2 bg-amber-600 text-white rounded-lg font-bold text-xs uppercase hover:bg-amber-700 shadow-md"
                     >
                       Gerar
                     </button>
                  </div>
               </div>
            </div>
          )}

          {/* Form de Registro */}
          <div className={`bg-white p-6 rounded-xl border shadow-sm h-fit transition-all ${editingLogId ? 'border-amber-200 ring-2 ring-amber-50' : 'border-slate-200'}`}>
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
              <svg className={`w-5 h-5 ${editingLogId ? 'text-amber-500' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              {editingLogId ? 'Editar Agendamento' : 'Novo Agendamento'}
            </h3>
            <form onSubmit={handleSaveLog} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                    <input type="date" className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={logForm.date} onChange={e => setLogForm({...logForm, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Turno</label>
                    <select className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={logForm.shift} onChange={e => setLogForm({...logForm, shift: e.target.value as Shift})}>
                      {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Instrutor / Responsável</label>
                <select 
                    className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                    value={logForm.instructorId} 
                    onChange={e => setLogForm({...logForm, instructorId: e.target.value})}
                    disabled={isInstructor} // Bloqueia para instrutor
                >
                  <option value="">Selecione...</option>
                  {availableInstructors.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Recurso Utilizado</label>
                <select className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={logForm.resourceId} onChange={e => setLogForm({...logForm, resourceId: e.target.value})}>
                  <option value="">Selecione...</option>
                  {senaiLabResources.map(r => <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Uso</label>
                    <select className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={logForm.usageTypeId} onChange={e => setLogForm({...logForm, usageTypeId: e.target.value})}>
                      <option value="">Selecione...</option>
                      {senaiLabUsageTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantidade</label>
                    <input type="number" step="0.1" className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={logForm.quantity} onChange={e => setLogForm({...logForm, quantity: parseFloat(e.target.value) || 0})} />
                 </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Autorizado Por</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                  value={logForm.authorizedBy} 
                  onChange={e => setLogForm({...logForm, authorizedBy: e.target.value})} 
                  placeholder="Nome do Responsável pela Autorização"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição / Projeto (Opcional)</label>
                <textarea rows={2} className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Impressão de peças para TCC" value={logForm.description} onChange={e => setLogForm({...logForm, description: e.target.value})}></textarea>
              </div>

              <div className="flex gap-2 pt-2">
                {editingLogId && (
                    <button 
                        type="button" 
                        onClick={handleCancelEdit}
                        className="flex-1 bg-slate-100 text-slate-500 py-2 rounded-lg font-bold hover:bg-slate-200 transition-all uppercase text-xs"
                    >
                        Cancelar
                    </button>
                )}
                <button 
                    type="submit" 
                    className={`flex-1 py-2 rounded-lg font-bold shadow transition-all uppercase text-xs text-white ${editingLogId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                    {editingLogId ? 'Salvar Alterações' : 'Registrar Uso'}
                </button>
              </div>
            </form>
          </div>

          {/* Histórico de Logs */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
             {/* Toolbar do Histórico */}
             <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex bg-white border p-1 rounded-lg">
                        <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-500">◀</button>
                        <span className="text-xs font-bold text-slate-700 min-w-[140px] text-center flex items-center justify-center">{formattedDateLabel}</span>
                        <button onClick={() => navigateDate(1)} className="p-1 hover:bg-slate-100 rounded text-slate-500">▶</button>
                    </div>
                    <div className="flex bg-slate-200 p-1 rounded-lg">
                        {(['DAY', 'WEEK', 'MONTH'] as const).map(m => (
                            <button 
                            key={m} 
                            onClick={() => setViewMode(m)}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
                            >
                            {m === 'DAY' ? 'Dia' : m === 'WEEK' ? 'Semana' : 'Mês'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <select 
                        className="border rounded-md text-xs py-1.5 px-2 outline-none focus:ring-1 focus:ring-indigo-500 flex-1 sm:flex-none"
                        value={filterInstructorId}
                        onChange={(e) => setFilterInstructorId(e.target.value)}
                        disabled={isInstructor}
                    >
                        <option value="">Todos Instrutores</option>
                        {filterInstructorsList.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                    
                    <button 
                      onClick={() => setIsExportModalOpen(true)}
                      className="bg-white border border-amber-200 text-amber-600 px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm hover:bg-amber-50 transition-all flex items-center gap-2"
                      title="Exportar PDF"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      PDF
                    </button>
                </div>
             </div>

             <div className="overflow-y-auto flex-1 custom-scrollbar relative">
               {filteredLogs.length === 0 ? (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-sm">Nenhum registro encontrado para este período.</p>
                 </div>
               ) : (
                 <table className="w-full text-left">
                   <thead className="text-[10px] uppercase font-bold text-slate-500 bg-white sticky top-0 shadow-sm z-10">
                     <tr>
                       <th className="p-3">Data / Turno</th>
                       <th className="p-3">Recurso</th>
                       <th className="p-3">Responsável / Autorização</th>
                       <th className="p-3">Finalidade</th>
                       <th className="p-3 text-right">Ação</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 text-sm">
                     {filteredLogs.map(log => {
                       const res = senaiLabResources.find(r => r.id === log.resourceId);
                       const user = users.find(u => u.id === log.instructorId);
                       const type = senaiLabUsageTypes.find(t => t.id === log.usageTypeId);
                       const isEditing = editingLogId === log.id;
                       
                       return (
                         <tr key={log.id} className={`transition-colors ${isEditing ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                           <td className="p-3">
                               <div className="font-mono text-xs font-bold text-slate-600">{log.date.split('-').reverse().join('/')}</div>
                               <span className="text-[9px] font-bold uppercase text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block mt-1">
                                   {log.shift}
                               </span>
                           </td>
                           <td className="p-3">
                             <div className="font-bold text-indigo-700">{res?.name || 'Recurso Removido'}</div>
                             <div className="text-xs text-slate-500 font-bold bg-slate-100 w-fit px-1.5 rounded mt-0.5">{log.quantity} {res?.unit}</div>
                           </td>
                           <td className="p-3">
                             <div className="text-slate-800 font-medium text-xs">{user?.name || 'Usuário Removido'}</div>
                             {log.authorizedBy && (
                                <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Aut: {log.authorizedBy}
                                </div>
                             )}
                           </td>
                           <td className="p-3">
                             <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{type?.name || 'Tipo Removido'}</span>
                             {log.description && <div className="text-[10px] text-slate-400 mt-1 italic truncate max-w-[150px]" title={log.description}>{log.description}</div>}
                           </td>
                           <td className="p-3 text-right">
                             <div className="flex justify-end gap-1">
                                <button onClick={() => handleEditLog(log)} className="text-indigo-400 hover:text-indigo-600 p-1 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors" title="Editar">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => handleDeleteLog(log.id)} className="text-red-400 hover:text-red-600 p-1 bg-red-50 rounded-full hover:bg-red-100 transition-colors" title="Excluir">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                             </div>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               )}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'SETTINGS' && !isInstructor && (
        <div className="space-y-8 animate-in fade-in duration-300">
           {/* CONFIGURAÇÃO DO LINK DE MODELOS */}
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                Configuração Link de Modelos
              </h3>
              <div className="flex gap-2">
                 <input 
                    className="flex-1 border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                    placeholder="Cole a URL externa aqui (Ex: https://...)" 
                    value={senaiLabModelUrl} 
                    onChange={e => setSenaiLabModelUrl(e.target.value)} 
                 />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 italic">Este link será acessado pelo botão "Modelos 3D e Corte a Laser" no topo da página.</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Gerenciar Recursos */}
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
                    Recursos Disponíveis
                  </h3>
                  <div className="flex gap-2 mb-4">
                     <input className="flex-1 border p-2 rounded text-sm outline-none" placeholder="Nome (ex: Filamento)" value={resourceForm.name} onChange={e => setResourceForm({...resourceForm, name: e.target.value})} />
                     <input className="w-24 border p-2 rounded text-sm outline-none" placeholder="Unid." value={resourceForm.unit} onChange={e => setResourceForm({...resourceForm, unit: e.target.value})} />
                     <button onClick={handleAddResource} className="bg-indigo-600 text-white px-4 rounded font-bold hover:bg-indigo-700">+</button>
                  </div>
                  <ul className="divide-y border rounded-lg overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                     {senaiLabResources.map(r => (
                       <li key={r.id} className="p-3 hover:bg-slate-50 flex justify-between items-center text-sm">
                          <div>
                            <span className="font-bold text-slate-700">{r.name}</span>
                            <span className="text-xs text-slate-400 ml-2">({r.unit})</span>
                          </div>
                          <button onClick={() => handleRemoveResource(r.id)} className="text-red-400 hover:text-red-600 text-xs font-bold uppercase">Remover</button>
                       </li>
                     ))}
                  </ul>
               </div>

               {/* Gerenciar Tipos de Uso */}
               <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                    Tipos de Uso
                  </h3>
                  <div className="flex gap-2 mb-4">
                     <input className="flex-1 border p-2 rounded text-sm outline-none" placeholder="Nome (ex: Hackathon)" value={typeForm.name} onChange={e => setTypeForm({...typeForm, name: e.target.value})} />
                     <button onClick={handleAddType} className="bg-indigo-600 text-white px-4 rounded font-bold hover:bg-indigo-700">+</button>
                  </div>
                  <ul className="divide-y border rounded-lg overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                     {senaiLabUsageTypes.map(t => (
                       <li key={t.id} className="p-3 hover:bg-slate-50 flex justify-between items-center text-sm">
                          <span className="font-bold text-slate-700">{t.name}</span>
                          <button onClick={() => handleRemoveType(t.id)} className="text-red-400 hover:text-red-600 text-xs font-bold uppercase">Remover</button>
                       </li>
                     ))}
                  </ul>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SenaiLab;
