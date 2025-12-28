import React, { useMemo, useEffect, useState } from 'react';
import { createHashRouter, RouterProvider, useNavigate, Outlet, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './AppContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Instructors from './pages/Instructors';
import Courses from './pages/Courses';
import Classes from './pages/Classes';
import Schedule from './pages/Schedule';
import Laboratories from './pages/Laboratories';
import Reports from './pages/Reports';
import Users from './pages/Users';
import AcademicCalendar from './pages/AcademicCalendar';
import RoomsAndLabs from './pages/RoomsAndLabs';
import SenaiLab from './pages/SenaiLab';
import InfoBoard from './pages/InfoBoard';

/**
 * ProtectedRoute atua como um gate de autorização.
 */
const ProtectedRoute: React.FC<{ adminOnly?: boolean }> = ({ adminOnly }) => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { replace: true });
      setIsAuthorized(false);
    } else if (adminOnly && currentUser.role !== 'SUPERVISION') {
      navigate('/', { replace: true });
      setIsAuthorized(false);
    } else {
      setIsAuthorized(true);
    }
  }, [currentUser, adminOnly, navigate]);

  if (!isAuthorized) return null;

  return <Outlet />;
};

const App = () => {
  const router = useMemo(() => createHashRouter([
    {
      path: "/login",
      element: <Login />,
    },
    {
      path: "/",
      element: <ProtectedRoute />, 
      children: [
        {
          element: <Layout />, 
          children: [
            { index: true, element: <Dashboard /> },
            { path: "schedule", element: <Schedule /> },
            { path: "labs", element: <Laboratories /> },
            { path: "senailab", element: <SenaiLab /> },
            { path: "reports", element: <Reports /> },
            { 
              path: "saga", 
              element: <InfoBoard category="SAGA_SENAI" title="SAGA SENAI" description="Metodologia e diretrizes do Sistema de Aprendizagem." colorTheme="#004587" /> 
            },
            { 
              path: "saga-partner", 
              element: <InfoBoard category="SAGA_PARTNER" title="SAGA SENAI Indústria Parceira" description="Materiais e links para indústrias parceiras." colorTheme="#F37021" /> 
            },
            { 
              path: "saep", 
              element: <InfoBoard category="SAEP" title="SAEP" description="Sistema de Avaliação da Educação Profissional." colorTheme="#10b981" /> 
            },
            { 
              path: "docs", 
              element: <InfoBoard category="DOCUMENTS" title="Documentos Gerais" description="Modelos, formulários e normativas institucionais." colorTheme="#64748b" /> 
            },
            { 
              path: "links", 
              element: <InfoBoard category="LINKS" title="Link's Úteis" description="Acesso rápido a sistemas e portais externos." colorTheme="#3b82f6" /> 
            },
            {
              element: <ProtectedRoute adminOnly />,
              children: [
                { path: "calendar", element: <AcademicCalendar /> },
                { path: "rooms", element: <RoomsAndLabs /> },
                { path: "instructors", element: <Instructors /> },
                { path: "courses", element: <Courses /> },
                { path: "classes", element: <Classes /> },
                { path: "settings", element: <Users /> }, 
              ]
            }
          ]
        }
      ]
    },
    {
      path: "*",
      element: <div className="p-8 text-center text-slate-500 font-medium">Página não encontrada. Redirecionando...</div>
    }
  ], {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  }), []);

  return (
    <AppProvider>
      <RouterProvider 
        router={router} 
      />
    </AppProvider>
  );
};

export default App;