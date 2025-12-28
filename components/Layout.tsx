
import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Icons } from '../constants';

const SidebarItem: React.FC<{ to: string, icon: React.ReactNode, label: string, active: boolean }> = ({ to, icon, label, active }) => (
  <Link
    to={to}
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </Link>
);

const Layout: React.FC = () => {
  const { currentUser, setCurrentUser, customLogo, appBackground } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    setCurrentUser(null);
    navigate('/login');
  };

  const isAdmin = currentUser?.role === 'SUPERVISION';

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transition-transform lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo Container */}
          <div className="p-4 bg-slate-950">
            <div className="bg-white p-3 rounded-xl shadow-inner flex flex-col items-center justify-center h-[80px]">
              <img src={customLogo || "logo.png"} alt="SENAI Logo" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="mt-3 text-center">
              <h1 className="text-[10px] font-black text-indigo-400 tracking-[0.3em] uppercase opacity-80">Central Senai</h1>
            </div>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <SidebarItem to="/" icon={<Icons.Dashboard />} label="Dashboard" active={location.pathname === '/'} />
            <SidebarItem to="/schedule" icon={<Icons.Calendar />} label="Agenda" active={location.pathname === '/schedule'} />
            <SidebarItem to="/labs" icon={<Icons.Labs />} label="Laboratórios" active={location.pathname === '/labs'} />
            <SidebarItem to="/senailab" icon={<Icons.SenaiLab />} label="SENAI Lab" active={location.pathname === '/senailab'} />
            <SidebarItem to="/reports" icon={<Icons.Reports />} label="Relatórios" active={location.pathname === '/reports'} />
            
            <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Institucional</div>
            <SidebarItem to="/saga" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="SAGA SENAI" active={location.pathname === '/saga'} />
            <SidebarItem to="/saga-partner" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" /></svg>} label="SAGA Indústria" active={location.pathname === '/saga-partner'} />
            <SidebarItem to="/saep" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="SAEP" active={location.pathname === '/saep'} />
            <SidebarItem to="/docs" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>} label="Documentos" active={location.pathname === '/docs'} />
            <SidebarItem to="/links" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>} label="Link's" active={location.pathname === '/links'} />

            {isAdmin && (
              <>
                <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Administração</div>
                <SidebarItem 
                    to="/calendar" 
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>} 
                    label="Calendário Acadêmico" 
                    active={location.pathname === '/calendar'} 
                />
                <SidebarItem 
                    to="/rooms" 
                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" /></svg>} 
                    label="Salas e Labs" 
                    active={location.pathname === '/rooms'} 
                />
                <SidebarItem to="/instructors" icon={<Icons.Users />} label="Pessoas" active={location.pathname === '/instructors'} />
                <SidebarItem to="/courses" icon={<Icons.Book />} label="Cursos" active={location.pathname === '/courses'} />
                <SidebarItem to="/classes" icon={<Icons.Book />} label="Turmas" active={location.pathname === '/classes'} />
                <SidebarItem to="/settings" icon={<Icons.Settings />} label="Ajustes" active={location.pathname === '/settings'} />
              </>
            )}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center space-x-3 mb-4">
              <img src={currentUser?.photoUrl || 'https://picsum.photos/40/40'} alt="Profile" className="w-10 h-10 rounded-full border-2 border-indigo-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{currentUser?.name}</p>
                <p className="text-xs text-slate-500 truncate">{currentUser?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-md hover:bg-red-900 hover:text-white transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div 
        className="flex-1 lg:ml-64 flex flex-col transition-all duration-500"
        style={{
          backgroundImage: appBackground ? `url(${appBackground})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        {/* Header */}
        <header className={`h-16 border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 ${appBackground ? 'bg-white shadow-sm' : 'bg-white'}`}>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-slate-600">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="text-slate-500 text-sm font-medium">
            {location.pathname === '/' ? 'Boas-vindas ao painel' : `Painel > ${location.pathname.substring(1)}`}
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-indigo-500 border-2 border-white"></span>
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
