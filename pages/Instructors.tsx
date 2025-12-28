
import React, { useMemo } from 'react';
import { useApp } from '../AppContext';
import { useNavigate } from 'react-router-dom';

const Instructors: React.FC = () => {
  const { users, technicalCompetencies, workloads } = useApp();
  const navigate = useNavigate();

  // Instrutores são usuários que possuem competências cadastradas
  const instructors = useMemo(() => {
    // Fix: Using correct property 'competencyIds' instead of 'competencies'
    return users.filter(u => u.competencyIds && u.competencyIds.length > 0);
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quadro de Instrutores</h2>
          <p className="text-sm text-slate-500">Visualização resumida dos colaboradores técnicos.</p>
        </div>
        <button 
          onClick={() => navigate('/settings')}
          className="bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-indigo-50 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          Gerenciar Pessoas
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instructors.map(inst => (
          <div key={inst.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-4 mb-4">
              <img src={inst.photoUrl || `https://picsum.photos/100/100?random=${inst.id}`} alt={inst.name} className="w-16 h-16 rounded-full border-2 border-indigo-100 object-cover" />
              <div>
                <h4 className="font-bold text-slate-800 text-lg leading-tight">{inst.name}</h4>
                <p className="text-sm text-slate-500">{inst.email}</p>
                <span className="text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded mt-1 inline-block">
                  {workloads.find(w => w.id === inst.workloadId)?.name || 'Carga N/A'}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Competências Ativas</p>
                <div className="flex flex-wrap gap-1">
                  {/* Fix: Resolve competency names using technicalCompetencies context and correct property 'competencyIds' */}
                  {inst.competencyIds?.map(compId => {
                    const comp = technicalCompetencies.find(tc => tc.id === compId);
                    return (
                      <span key={compId} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-bold uppercase">
                        {comp?.name || compId}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="pt-4 flex justify-between border-t border-slate-50">
                 <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2-2v14a2 2 0 002 2z" /></svg>
                    {inst.phone}
                 </div>
                 <span className="text-[10px] bg-slate-50 px-1.5 py-0.5 rounded text-slate-400 font-mono">ID: {inst.id}</span>
              </div>
            </div>
          </div>
        ))}
        {instructors.length === 0 && (
          <div className="col-span-full py-12 text-center bg-slate-50 border-2 border-dashed rounded-2xl border-slate-200">
             <p className="text-slate-400">Nenhum usuário com competências técnicas cadastradas.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Instructors;
