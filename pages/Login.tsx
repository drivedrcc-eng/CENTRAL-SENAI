
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { User } from '../types';
import { supabase } from '../supabaseClient';

const Login: React.FC = () => {
  const { areas, workloads, customLoginBg, customLogo } = useApp();
  const [username, setUsername] = useState(''); // Treating as email if it has @, otherwise username lookup needed? Supabase Login is by Email.
  // We will force Email Login or we need to map username to email.
  // For simplicity and standard auth, we will ask for Email.
  // But the UI says "Usuário". I will change it to "E-mail".

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL padrão se não houver customização
  const DEFAULT_BG = "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2070&auto=format&fit=crop";

  // Estado para o formulário de pré-registro
  const [regData, setRegData] = useState({
    name: '',
    username: '', // Still keeping username as display unique ID?
    password: '',
    emailPrefix: '',
    phone: '',
    areaId: '',
    workloadId: '',
    photoUrl: '',
    re: '', // Alterado de ra para re
    googleEmail: ''
  });

  // Sincroniza o email google com o RE
  useEffect(() => {
    if (regData.re) {
      setRegData(prev => ({ ...prev, googleEmail: `${prev.re}@senaimgdocente.com.br` }));
    } else {
      setRegData(prev => ({ ...prev, googleEmail: '' }));
    }
  }, [regData.re]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Try to sign in with Supabase
      // If user entered a username instead of email, this might fail unless we assume email = username@fiemg.com.br?
      // Old app logic: email = username + '@fiemg.com.br' ?
      // Line 106 in old code: const fullEmail = `${regData.emailPrefix}@fiemg.com.br`;
      // So username in old app was basically the email prefix.

      // Let's deduce email from input
      let loginEmail = email;
      if (!email.includes('@')) {
        // Assume it's the corporate user/prefix
        loginEmail = `${email}@fiemg.com.br`;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password
      });

      if (error) {
        alert('Falha no login: ' + error.message);
        return;
      }

      navigate('/');
    } catch (err: any) {
      alert('Erro inesperado: ' + err.message);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRegData({ ...regData, photoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !regData.name ||
      !regData.username ||
      !regData.password ||
      !regData.emailPrefix ||
      !regData.areaId ||
      !regData.phone ||
      !regData.workloadId ||
      !regData.photoUrl ||
      !regData.re
    ) {
      alert('Preencha todos os campos obrigatórios, incluindo a foto de perfil e o RE.');
      return;
    }

    const fullEmail = `${regData.emailPrefix}@fiemg.com.br`;
    const googleEmailFull = `${regData.re}@senaimgdocente.com.br`;

    try {
      const { error } = await supabase.auth.signUp({
        email: fullEmail,
        password: regData.password,
        options: {
          data: {
            name: regData.name,
            username: regData.username,
            phone: regData.phone,
            areaId: regData.areaId,
            workloadId: regData.workloadId,
            photoUrl: regData.photoUrl,
            re: regData.re,
            googleEmail: googleEmailFull,
            role: 'INSTRUCTOR', // Default role
          }
        }
      });

      if (error) throw error;

      alert('Solicitação de cadastro enviada! Verifique seu e-mail para confirmar (se necessário).');
      setIsRegistering(false);
      setRegData({ name: '', username: '', password: '', emailPrefix: '', phone: '', areaId: '', workloadId: '', photoUrl: '', re: '', googleEmail: '' });

    } catch (err: any) {
      alert('Erro ao registrar: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-4 py-12 overflow-hidden">
      {/* Imagem de Fundo Dinâmica sem Overlay */}
      <div
        className="absolute inset-0 z-0 transition-opacity duration-1000"
        style={{
          backgroundImage: `url('${customLoginBg || DEFAULT_BG}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Container do Formulário */}
      <div className="max-w-md w-full bg-white rounded-2xl p-8 space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center">
          <img src={customLogo || "logo.png"} alt="SENAI Logo" className="max-w-full h-auto mx-auto mb-6 px-4" style={{ maxHeight: '80px' }} />
          <h1 className="text-2xl font-black text-[#004587] tracking-tight uppercase pt-2 border-t border-slate-100">Central SENAI</h1>
          <p className="mt-1 text-xs font-bold text-[#F37021] uppercase tracking-widest">
            {isRegistering ? 'Cadastro de Instrutor' : 'Gestão Educacional'}
          </p>
        </div>

        {!isRegistering ? (
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Usuário ou E-mail</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-[#004587] focus:border-[#004587]"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@fiemg.com.br ou apenas usuario"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Senha</label>
                <input
                  type="password"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-[#004587] focus:border-[#004587]"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-[#004587] hover:bg-[#003366] transition-colors uppercase tracking-wide"
              >
                ENTRAR NO SISTEMA
              </button>
              <button
                type="button"
                onClick={() => setIsRegistering(true)}
                className="w-full flex justify-center py-3 px-4 border-2 border-[#F37021] rounded-md shadow-sm text-sm font-bold text-[#F37021] bg-white hover:bg-[#F37021] hover:text-white transition-colors uppercase tracking-wide"
              >
                Cadastro
              </button>
            </div>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="flex flex-col items-center gap-3 pb-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`w-24 h-24 rounded-full border-2 border-dashed ${!regData.photoUrl ? 'border-red-300' : 'border-slate-200'} bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#004587] transition-all relative group`}
              >
                {regData.photoUrl ? (
                  <img src={regData.photoUrl} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <div className="text-center p-2">
                    <svg className="w-8 h-8 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Foto *</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-white text-[8px] font-bold uppercase">Alterar</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              {!regData.photoUrl && <p className="text-[8px] text-red-500 font-bold uppercase">Foto obrigatória</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo *</label>
              <input className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-[#004587]" value={regData.name} onChange={e => setRegData({ ...regData, name: e.target.value })} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RE / Colaborador *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-[#004587]"
                  value={regData.re}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setRegData({ ...regData, re: val });
                  }}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone / WhatsApp *</label>
                <input className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-[#004587]" value={regData.phone} onChange={e => setRegData({ ...regData, phone: e.target.value })} required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail Corporativo *</label>
              <div className="flex">
                <input
                  type="text"
                  className="flex-1 border p-2 rounded-l text-sm outline-none focus:ring-2 focus:ring-[#004587] border-r-0"
                  placeholder="usuario"
                  value={regData.emailPrefix}
                  onChange={e => {
                    const prefix = e.target.value.split('@')[0];
                    setRegData({ ...regData, emailPrefix: prefix, username: prefix });
                  }}
                  required
                />
                <div className="bg-slate-100 border border-l-0 border-slate-300 px-3 flex items-center rounded-r text-sm text-slate-500 font-medium whitespace-nowrap">
                  @fiemg.com.br
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail Google (Institucional) *</label>
              <div className="flex">
                <input
                  type="text"
                  readOnly
                  className="flex-1 border p-2 rounded-l text-sm outline-none bg-slate-50 text-slate-500 border-r-0 cursor-not-allowed"
                  placeholder="Digite o RE acima"
                  value={regData.re}
                />
                <div className="bg-slate-100 border border-l-0 border-slate-300 px-3 flex items-center rounded-r text-sm text-slate-500 font-medium whitespace-nowrap">
                  @senaimgdocente.com.br
                </div>
              </div>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Gerado automaticamente a partir do RE.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuário</label>
                <input
                  className="w-full border p-2 rounded text-sm outline-none bg-slate-50 text-slate-500 cursor-not-allowed"
                  value={regData.username}
                  readOnly
                  placeholder="Automático"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha *</label>
                <input type="password" placeholder="Mín 6 caracteres" className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-[#004587]" value={regData.password} onChange={e => setRegData({ ...regData, password: e.target.value })} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Área *</label>
                <select className="w-full border p-2 rounded text-xs outline-none focus:ring-2 focus:ring-[#004587]" value={regData.areaId} onChange={e => setRegData({ ...regData, areaId: e.target.value })} required>
                  <option value="">Selecione</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Carga Horária *</label>
                <select className="w-full border p-2 rounded text-xs outline-none focus:ring-2 focus:ring-[#004587]" value={regData.workloadId} onChange={e => setRegData({ ...regData, workloadId: e.target.value })} required>
                  <option value="">Selecione</option>
                  {workloads.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <button type="submit" className="w-full bg-[#F37021] text-white py-3 rounded-md font-bold text-sm hover:bg-[#d95e16] shadow-md transition-all active:scale-95 uppercase tracking-wide">REGISTRAR</button>
              <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-slate-400 text-xs font-bold hover:underline">VOLTAR AO LOGIN</button>
            </div>
          </form>
        )}
      </div>

      {/* Botão de Reset de Dados (Emergência) */}
      <button
        onClick={() => {
          if (confirm('Isso apagará TODOS os dados locais (reset de fábrica) e corrigirá erros de quota. Deseja continuar?')) {
            localStorage.clear();
            window.location.reload();
          }
        }}
        className="absolute bottom-4 right-4 text-xs font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors z-20"
      >
        Resetar Dados Locais
      </button>
    </div>
  );
};

export default Login;
