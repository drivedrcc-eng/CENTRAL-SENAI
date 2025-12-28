
import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../AppContext';
import { User, Role } from '../types';
import { supabase } from '../supabaseClient';

const Users: React.FC = () => {
  const {
    users, setUsers, currentUser,
    technicalCompetencies, setTechnicalCompetencies,
    areas, workloads, setWorkloads,
    activityCategories, setActivityCategories,
    customLoginBg, setCustomLoginBg,
    appBackground, setAppBackground,
    customLogo, setCustomLogo,
    customFont, setCustomFont,
    reportBackground, setReportBackground,
    backupSettings, setBackupSettings, exportData, importData
  } = useApp();

  // Novo estado para navegação entre seções
  const [currentView, setCurrentView] = useState<'USERS' | 'COMPETENCIES' | 'WORKLOADS' | 'ACTIVITIES' | 'SYSTEM' | 'BACKUP'>('USERS');

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'PENDING'>('ACTIVE');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estado para Modal de Senha
  const [passwordModal, setPasswordModal] = useState<{ open: boolean, userId: string | null, userName: string }>({
    open: false, userId: null, userName: ''
  });
  const [newPassword, setNewPassword] = useState('');

  const [formData, setFormData] = useState<Omit<User, 'id'>>({
    name: '',
    username: '',
    role: 'INSTRUCTOR',
    status: 'ACTIVE',
    photoUrl: '',
    email: '',
    phone: '',
    competencyIds: [],
    areaId: '',
    workloadId: '',
    re: '', // Alterado de ra para re
    googleEmail: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const appBgInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const reportBgInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === 'SUPERVISION';

  const pendingUsers = useMemo(() => users.filter(u => u.status === 'PENDING'), [users]);
  const activeUsers = useMemo(() => users.filter(u => u.status === 'ACTIVE' || !u.status), [users]);

  // --- HELPER GOOGLE DRIVE LINK ---
  const processUrl = (url: string) => {
    if (!url) return '';
    // Verifica se é link do Google Drive e converte para link direto de visualização
    if (url.includes('drive.google.com') && url.includes('/d/')) {
      try {
        const id = url.split('/d/')[1].split('/')[0];
        return `https://drive.google.com/uc?export=view&id=${id}`;
      } catch (e) {
        return url;
      }
    }
    return url;
  };

  // --- IMAGE UPLOAD HANDLERS (WITH SIZE LIMIT) ---
  // --- IMAGE UPLOAD HANDLERS (WITH SUPABASE STORAGE) ---
  const uploadToSupabase = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { error } = await supabase.storage.from('assets').upload(filePath, file);
      if (error) throw error;

      const { data } = supabase.storage.from('assets').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      alert('Erro ao fazer upload: ' + err.message);
      return null;
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB check
        alert("A imagem é muito grande. Máximo 5MB.");
        return;
      }
      const publicUrl = await uploadToSupabase(file, 'photos');
      if (publicUrl) {
        setFormData({ ...formData, photoUrl: publicUrl });
      }
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return alert("Máximo 5MB.");
      const publicUrl = await uploadToSupabase(file, 'backgrounds');
      if (publicUrl) {
        setCustomLoginBg(publicUrl);
        alert("Imagem de fundo atualizada com sucesso!");
      }
    }
  };

  const handleAppBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return alert("Máximo 5MB.");
      const publicUrl = await uploadToSupabase(file, 'backgrounds');
      if (publicUrl) {
        setAppBackground(publicUrl);
        alert("Fundo da aplicação atualizado!");
      }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return alert("Máximo 5MB.");
      const publicUrl = await uploadToSupabase(file, 'branding');
      if (publicUrl) {
        setCustomLogo(publicUrl);
        alert("Logo atualizada com sucesso!");
      }
    }
  };

  const handleReportBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return alert("Máximo 5MB.");
      const publicUrl = await uploadToSupabase(file, 'reports');
      if (publicUrl) {
        setReportBackground(publicUrl);
        alert("Fundo dos relatórios atualizado!");
      }
    }
  };

  // --- FONT HANDLER ---
  // --- FONT HANDLER ---
  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.ttf')) {
        alert("Por favor, envie um arquivo .ttf");
        return;
      }
      const publicUrl = await uploadToSupabase(file, 'fonts');
      if (publicUrl) {
        setCustomFont(publicUrl);
        alert("Fonte personalizada carregada com sucesso! Ela será usada nos próximos relatórios.");
      }
    }
  };

  const handleFontUrlBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    let url = e.target.value;
    if (!url) return;

    // Processa link do Drive se necessário
    url = processUrl(url);

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove header for pure base64
        const base64 = result.split(',')[1];
        setCustomFont(base64);
        alert("Fonte carregada via Link com sucesso!");
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error(err);
      alert("Erro ao baixar fonte. Verifique se o link é direto/público e permite acesso (CORS).");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          importData(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSaveUser = () => {
    if (!formData.name || !formData.username) {
      alert("Nome e Usuário são obrigatórios.");
      return;
    }

    if (editingId) {
      setUsers(users.map(u => u.id === editingId ? { ...formData, id: editingId } : u));
      alert("Usuário atualizado com sucesso!");
    } else {
      const id = Math.random().toString(36).substr(2, 9);
      setUsers([...users, { ...formData, id, password: formData.username }]);
      alert("Usuário cadastrado com sucesso! A senha inicial é igual ao nome de usuário.");
    }

    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  const handleApprove = (user: User) => {
    setUsers(users.map(u => u.id === user.id ? { ...u, status: 'ACTIVE' } : u));
    alert(`Usuário ${user.name} aprovado com sucesso!`);
  };

  const handleReject = (id: string) => {
    if (window.confirm("Deseja realmente rejeitar esta solicitação?")) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  const handleEditClick = (user: User) => {
    setFormData({
      name: user.name,
      username: user.username,
      role: user.role,
      status: user.status || 'ACTIVE',
      photoUrl: user.photoUrl || '',
      email: user.email || '',
      phone: user.phone || '',
      competencyIds: user.competencyIds || [],
      areaId: user.areaId || '',
      workloadId: user.workloadId || '',
      re: user.re || '',
      googleEmail: user.googleEmail || ''
    });
    setEditingId(user.id);
    setIsAdding(true);
  };

  const handleOpenPasswordModal = (user: User) => {
    setPasswordModal({ open: true, userId: user.id, userName: user.name });
    setNewPassword('');
  };

  const handleSavePassword = () => {
    if (!newPassword || newPassword.length < 3) {
      alert("A senha deve ter pelo menos 3 caracteres.");
      return;
    }
    if (passwordModal.userId) {
      setUsers(users.map(u => u.id === passwordModal.userId ? { ...u, password: newPassword } : u));
      alert(`Senha de ${passwordModal.userName} alterada com sucesso!`);
      setPasswordModal({ open: false, userId: null, userName: '' });
      setNewPassword('');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', username: '', role: 'INSTRUCTOR', status: 'ACTIVE',
      photoUrl: '', email: '', phone: '', competencyIds: [],
      areaId: '', workloadId: '', re: '', googleEmail: ''
    });
  };

  const toggleCompetency = (id: string) => {
    const currentIds = formData.competencyIds || [];
    if (currentIds.includes(id)) {
      setFormData({ ...formData, competencyIds: currentIds.filter(c => c !== id) });
    } else {
      setFormData({ ...formData, competencyIds: [...currentIds, id] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Ajustes do Sistema</h2>
          <p className="text-sm text-slate-500">Gestão de acessos, parâmetros e personalização.</p>
        </div>

        {isAdmin && (
          <div className="flex bg-slate-200 p-1 rounded-lg overflow-x-auto max-w-full custom-scrollbar">
            <button onClick={() => setCurrentView('USERS')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all whitespace-nowrap ${currentView === 'USERS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>Usuários</button>
            <div className="w-px bg-slate-300 mx-1"></div>
            {['COMPETENCIES', 'WORKLOADS', 'ACTIVITIES', 'SYSTEM', 'BACKUP'].map(tab => (
              <button key={tab} onClick={() => setCurrentView(tab as any)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${currentView === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab === 'COMPETENCIES' ? 'Competências' : tab === 'WORKLOADS' ? 'Cargas' : tab === 'ACTIVITIES' ? 'Ativ. Extras' : tab === 'BACKUP' ? 'DADOS & BACKUP' : 'Sistema'}</button>
            ))}
          </div>
        )}
      </div>

      {currentView === 'USERS' && (
        <>
          {/* ... (Conteúdo da aba Usuários mantido igual) ... */}
          <div className="flex justify-end items-center gap-2">
            {isAdmin && (
              <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
                <button onClick={() => setActiveTab('ACTIVE')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${activeTab === 'ACTIVE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>Ativos ({activeUsers.length})</button>
                <button onClick={() => setActiveTab('PENDING')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all relative ${activeTab === 'PENDING' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>Pendentes ({pendingUsers.length}){pendingUsers.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>}</button>
              </div>
            )}
            {isAdmin && !isAdding && activeTab === 'ACTIVE' && (
              <button onClick={() => { resetForm(); setEditingId(null); setIsAdding(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>Nova Pessoa</button>
            )}
          </div>

          {isAdding && (
            <div className="bg-white p-8 rounded-2xl border border-indigo-100 shadow-xl max-w-4xl mx-auto animate-in zoom-in-95 duration-200">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex flex-col items-center gap-4">
                  <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-full border-4 border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-200 transition-all group relative">
                    {formData.photoUrl ? <img src={formData.photoUrl} className="w-full h-full object-cover" alt="Preview" /> : <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold text-center p-2">TROCAR FOTO</div>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{editingId ? 'Editando Perfil' : 'Novo Perfil'}</p>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                      <input className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Carlos Oliveira" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RE / Colaborador</label>
                      <input className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.re} onChange={e => setFormData({ ...formData, re: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Área do Instrutor</label>
                      <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.areaId} onChange={e => setFormData({ ...formData, areaId: e.target.value })}>
                        <option value="">Selecione a Área Principal</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Carga Horária de Trabalho</label>
                      <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.workloadId} onChange={e => setFormData({ ...formData, workloadId: e.target.value })}>
                        <option value="">Selecione a Carga</option>
                        {workloads.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nível de Acesso</label>
                      <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as Role })}>
                        <option value="INSTRUCTOR">Instrutor</option>
                        <option value="SUPERVISION">Supervisão</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail Corporativo</label>
                      <input type="email" className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail Google</label>
                      <input type="email" className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.googleEmail} onChange={e => setFormData({ ...formData, googleEmail: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp</label>
                      <input type="tel" className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Login (Username)</label>
                      <input className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Habilidades Técnicas / Competências (Clique para ativar)</label>
                    <div className="flex flex-wrap gap-2">
                      {technicalCompetencies.map(comp => {
                        const isSelected = formData.competencyIds?.includes(comp.id);
                        return (
                          <button
                            key={comp.id}
                            type="button"
                            onClick={() => toggleCompetency(comp.id)}
                            className={`
                                px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5
                                ${isSelected
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm ring-2 ring-emerald-500/20'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }
                              `}
                          >
                            {isSelected ? (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <span className="w-3 h-3 rounded-full border border-slate-300"></span>
                            )}
                            {comp.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-3 pt-6 border-t">
                    <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg font-medium">Cancelar</button>
                    <button onClick={handleSaveUser} className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition-all">
                      {editingId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR PESSOA'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* User Table (Keep existing) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* ... Table implementation ... */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Colaborador</th>
                    <th className="px-6 py-4">RE</th>
                    <th className="px-6 py-4">Área / Carga</th>
                    <th className="px-6 py-4">Acesso / Status</th>
                    <th className="px-6 py-4">Habilidades</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {(activeTab === 'ACTIVE' ? activeUsers : pendingUsers).map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 flex items-center space-x-3">
                        <img src={u.photoUrl || 'https://picsum.photos/40/40'} className="w-10 h-10 rounded-full border border-slate-200 object-cover" alt={u.name} />
                        <div>
                          <p className="font-bold text-slate-900 leading-none mb-1">{u.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">@{u.username}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-slate-500">{u.re || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-bold text-slate-600">
                            {areas.find(a => a.id === u.areaId)?.name || 'N/A'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {workloads.find(w => w.id === u.workloadId)?.name || 'Carga não definida'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold w-fit ${u.role === 'SUPERVISION' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {u.role === 'SUPERVISION' ? 'SUPERVISÃO' : 'INSTRUTOR'}
                          </span>
                          {u.status === 'PENDING' && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 w-fit">PENDENTE</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {u.competencyIds?.map(compId => {
                            const comp = technicalCompetencies.find(c => c.id === compId);
                            return (
                              <span key={compId} className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 uppercase font-bold">{comp?.name}</span>
                            );
                          })}
                          {u.competencyIds?.length === 0 && <span className="text-[8px] italic text-slate-400">Nenhuma vinculada</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {u.status === 'PENDING' ? (
                            <>
                              <button onClick={() => handleApprove(u)} className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-md text-[10px] font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors">APROVAR</button>
                              <button onClick={() => handleReject(u.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-md text-[10px] font-bold border border-red-100 hover:bg-red-100 transition-colors">REJEITAR</button>
                            </>
                          ) : (
                            isAdmin && (
                              <>
                                <button onClick={() => handleOpenPasswordModal(u)} className="text-amber-400 hover:text-amber-600 p-1" title="Alterar Senha"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg></button>
                                <button onClick={() => handleEditClick(u)} className="text-indigo-400 hover:text-indigo-600 p-1" title="Editar Perfil"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                {u.username !== 'admin' && (
                                  <button onClick={() => { if (window.confirm(`Deseja realmente excluir ${u.name}?`)) setUsers(users.filter(x => x.id !== u.id)); }} className="text-red-400 hover:text-red-600 p-1" title="Excluir"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                )}
                              </>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MODAL DE ALTERAÇÃO DE SENHA */}
          {/* ... (Modal de Senha mantido igual) ... */}
          {passwordModal.open && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Alterar Senha</h3>
                    <p className="text-xs text-slate-500">Definindo nova senha para: <strong className="text-indigo-600">{passwordModal.userName}</strong></p>
                  </div>
                  <button onClick={() => setPasswordModal({ open: false, userId: null, userName: '' })} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Senha</label>
                    <input
                      type="text"
                      className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="Digite a nova senha"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-xs text-amber-700 italic">
                    Atenção: A alteração é imediata e o usuário precisará usar esta nova senha no próximo login.
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setPasswordModal({ open: false, userId: null, userName: '' })}
                      className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 font-bold text-xs uppercase hover:bg-slate-200 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSavePassword}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold text-xs uppercase hover:bg-indigo-700 rounded-lg shadow-md"
                    >
                      Salvar Senha
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ... Other Views (Competencies, Workloads, Activities) - Keep existing code ... */}

      {currentView === 'SYSTEM' && (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-300 space-y-8">
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-4">Personalização do Sistema</h3>
            <p className="text-sm text-slate-500 mb-6">Configure a aparência e elementos visuais da plataforma.</p>
          </div>

          {/* LOGO UPLOAD */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start gap-6">
            <div className="flex-1 w-full">
              <h4 className="font-bold text-indigo-900 mb-1">Logomarca do Sistema</h4>
              <div className="flex items-center gap-4">
                <button onClick={() => logoInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors">Carregar Arquivo</button>
                {customLogo && <button onClick={() => { if (window.confirm('Restaurar padrão?')) setCustomLogo(null); }} className="text-red-500 text-xs font-bold hover:underline">Restaurar Padrão</button>}
              </div>
              <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/*" />

              <div className="mt-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Link do Google Drive ou URL</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                  placeholder="https://drive.google.com/file/d/..."
                  value={customLogo && !customLogo.startsWith('data:') ? customLogo : ''}
                  onChange={(e) => setCustomLogo(processUrl(e.target.value))}
                />
              </div>
            </div>
            <div className="w-full md:w-48 h-32 bg-slate-950 rounded-lg flex items-center justify-center p-4 border border-slate-800">
              <img src={customLogo || "logo.png"} className="max-w-full max-h-full object-contain" alt="Logo Preview" />
            </div>
          </div>

          {/* LOGIN BACKGROUND UPLOAD */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start gap-6">
            <div className="flex-1 w-full">
              <h4 className="font-bold text-indigo-900 mb-1">Imagem de Fundo do Login</h4>
              <div className="flex items-center gap-4">
                <button onClick={() => bgInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors">Carregar Arquivo</button>
                {customLoginBg && <button onClick={() => { if (window.confirm('Remover fundo?')) setCustomLoginBg(null); }} className="text-red-500 text-xs font-bold hover:underline">Restaurar Padrão</button>}
              </div>
              <input type="file" ref={bgInputRef} onChange={handleBgUpload} className="hidden" accept="image/*" />

              <div className="mt-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Link do Google Drive ou URL</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                  placeholder="https://drive.google.com/file/d/..."
                  value={customLoginBg && !customLoginBg.startsWith('data:') ? customLoginBg : ''}
                  onChange={(e) => setCustomLoginBg(processUrl(e.target.value))}
                />
              </div>
            </div>
            <div className="w-full md:w-64 h-36 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative group">
              {customLoginBg ? <img src={customLoginBg} className="w-full h-full object-cover" alt="Preview Login" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-400"><span className="text-[10px] font-bold uppercase">Padrão do Sistema</span></div>}
            </div>
          </div>

          {/* APP BACKGROUND UPLOAD */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start gap-6">
            <div className="flex-1 w-full">
              <h4 className="font-bold text-indigo-900 mb-1">Fundo Geral da Aplicação</h4>
              <div className="flex items-center gap-4">
                <button onClick={() => appBgInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors">Carregar Arquivo</button>
                {appBackground && <button onClick={() => { if (window.confirm('Remover fundo?')) setAppBackground(null); }} className="text-red-500 text-xs font-bold hover:underline">Remover</button>}
              </div>
              <input type="file" ref={appBgInputRef} onChange={handleAppBgUpload} className="hidden" accept="image/*" />

              <div className="mt-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Link do Google Drive ou URL</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                  placeholder="https://drive.google.com/file/d/..."
                  value={appBackground && !appBackground.startsWith('data:') ? appBackground : ''}
                  onChange={(e) => setAppBackground(processUrl(e.target.value))}
                />
              </div>
            </div>
            <div className="w-full md:w-64 h-36 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative group">
              {appBackground ? <img src={appBackground} className="w-full h-full object-cover" alt="Preview App Background" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-400"><span className="text-[10px] font-bold uppercase">Sem Fundo (Padrão)</span></div>}
            </div>
          </div>

          {/* REPORT SETTINGS */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h4 className="font-bold text-indigo-900 mb-1 border-b pb-2">Personalização de Relatórios (PDF)</h4>

            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-1 w-full">
                <p className="font-bold text-slate-700 text-sm mb-1">Fonte Personalizada (.ttf)</p>
                <div className="flex items-center gap-4">
                  <button onClick={() => fontInputRef.current?.click()} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors">Carregar Fonte</button>
                  {customFont && <button onClick={() => { if (window.confirm('Remover fonte?')) setCustomFont(null); }} className="text-red-500 text-xs font-bold hover:underline">Remover Fonte</button>}
                </div>
                <input type="file" ref={fontInputRef} onChange={handleFontUpload} className="hidden" accept=".ttf" />

                <div className="mt-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Link do Google Drive ou URL (.ttf)</label>
                  <input
                    type="text"
                    className="w-full border p-2 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                    placeholder="https://drive.google.com/file/d/..."
                    onBlur={handleFontUrlBlur}
                  />
                  <p className="text-[9px] text-slate-400 mt-1 italic">Cole o link e clique fora para carregar. Requer arquivo .ttf com permissão pública.</p>
                </div>
              </div>
              <div className="w-full md:w-64 p-4 bg-slate-50 rounded-lg text-center border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">Estado da Fonte:</p>
                {customFont ? <span className="text-emerald-600 font-bold text-xs uppercase">Ativa</span> : <span className="text-slate-400 font-bold text-xs uppercase">Padrão (Helvetica)</span>}
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start gap-6 border-t pt-6">
              <div className="flex-1 w-full">
                <p className="font-bold text-slate-700 text-sm mb-1">Fundo dos Relatórios (Imagem)</p>
                <div className="flex items-center gap-4">
                  <button onClick={() => reportBgInputRef.current?.click()} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors">Carregar Fundo</button>
                  {reportBackground && <button onClick={() => { if (window.confirm('Remover fundo?')) setReportBackground(null); }} className="text-red-500 text-xs font-bold hover:underline">Remover Fundo</button>}
                </div>
                <input type="file" ref={reportBgInputRef} onChange={handleReportBgUpload} className="hidden" accept="image/*" />

                <div className="mt-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Link do Google Drive ou URL</label>
                  <input
                    type="text"
                    className="w-full border p-2 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600"
                    placeholder="https://drive.google.com/file/d/..."
                    value={reportBackground && !reportBackground.startsWith('data:') ? reportBackground : ''}
                    onChange={(e) => setReportBackground(processUrl(e.target.value))}
                  />
                </div>
              </div>
              <div className="w-full md:w-64 h-36 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative group">
                {reportBackground ? <img src={reportBackground} className="w-full h-full object-cover" alt="Report Bg Preview" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-400"><span className="text-[10px] font-bold uppercase">Sem Fundo</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {currentView === 'BACKUP' && (
        // ... (Backup View mantido igual) ...
        <div className="max-w-4xl mx-auto animate-in fade-in duration-300 space-y-8">
          <div className="text-center mb-8">
            <h3 className="text-xl font-bold text-slate-800">Cópia de Segurança e Dados</h3>
            <p className="text-sm text-slate-500">Exporte seus dados para segurança ou importe de um arquivo existente.</p>
          </div>
          {/* ... Backup cards ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-24 h-24 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </div>
              <h4 className="text-lg font-bold text-indigo-900 mb-2">Fazer Backup (Exportar)</h4>
              <p className="text-sm text-slate-500 mb-6">Baixe um arquivo JSON contendo todos os dados do sistema (usuários, agenda, configurações, etc).</p>
              <button onClick={exportData} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Baixar Arquivo de Dados
              </button>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-24 h-24 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              </div>
              <h4 className="text-lg font-bold text-amber-900 mb-2">Restaurar Dados (Importar)</h4>
              <p className="text-sm text-slate-500 mb-6">Carregue um arquivo JSON de backup. <strong className="text-red-500">Atenção: Isso substituirá todos os dados atuais!</strong></p>
              <button onClick={() => importInputRef.current?.click()} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                Selecionar Arquivo
              </button>
              <input type="file" ref={importInputRef} onChange={handleImport} className="hidden" accept=".json" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
