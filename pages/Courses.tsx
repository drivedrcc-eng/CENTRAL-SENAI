
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../AppContext';
import { Course } from '../types';

const Courses: React.FC = () => {
  const { 
    areas, setAreas, types, setTypes, courses, setCourses, 
    technicalCompetencies, 
    projects, setProjects,
    currentUser
  } = useApp();
  
  const isInstructor = currentUser?.role === 'INSTRUCTOR';

  // Organização das abas: Cursos, Áreas, Tipos, Projetos
  const [activeSubTab, setActiveSubTab] = useState<'COURSES' | 'AREAS' | 'TYPES' | 'PROJECTS'>('COURSES');
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  // Filtros
  const [filterArea, setFilterArea] = useState('');
  const [filterType, setFilterType] = useState('');

  // Planejamento do Curso (Metas)
  const [expectedPresential, setExpectedPresential] = useState<string>('');
  const [expectedEAD, setExpectedEAD] = useState<string>('');

  // Form de Matéria (UC)
  const [subjectName, setSubjectName] = useState('');
  const [subjectHoursPresential, setSubjectHoursPresential] = useState<string>('');
  const [subjectHoursEAD, setSubjectHoursEAD] = useState<string>('');
  const [subjectCompIds, setSubjectCompIds] = useState<string[]>([]);
  const [selectedCompId, setSelectedCompId] = useState('');
  
  // Controle de geração automática de EAD
  const [autoGenerateEad, setAutoGenerateEad] = useState(false);
  
  // State for new area color
  const [newAreaColor, setNewAreaColor] = useState('#3b82f6');
  
  const [refClassesPerDay, setRefClassesPerDay] = useState<number>(5);
  const HOUR_PER_CLASS = 0.75;

  // Ref para o input de arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Course Form State
  const [courseForm, setCourseForm] = useState<Omit<Course, 'id'>>({
    name: '', 
    areaId: '', 
    typeId: '', 
    presentialHours: 0, 
    eadHours: 0,
    totalClasses: 0, 
    subjects: [],
    coursePlan: '' // Novo campo para o PDF
  });

  // Filtra os cursos com base nos selects
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      // Filtro Direto
      if (filterArea && course.areaId !== filterArea) return false;
      if (filterType && course.typeId !== filterType) return false;

      return true;
    });
  }, [courses, filterArea, filterType]);

  // Cálculos de Totais Atuais (Soma das UCs)
  const currentPresentialSum = useMemo(() => {
    return courseForm.subjects
      .filter(s => !s.name.startsWith('EAD - '))
      .reduce((acc, s) => acc + s.hours, 0);
  }, [courseForm.subjects]);

  const currentEADSum = useMemo(() => {
    return courseForm.subjects
      .filter(s => s.name.startsWith('EAD - '))
      .reduce((acc, s) => acc + s.hours, 0);
  }, [courseForm.subjects]);

  const targetPresential = parseFloat(expectedPresential) || 0;
  const targetEAD = parseFloat(expectedEAD) || 0;

  const isPresentialMatch = currentPresentialSum === targetPresential;
  const isEADMatch = currentEADSum === targetEAD;
  const canSave = isPresentialMatch && isEADMatch && courseForm.name && targetPresential > 0;

  const addCompToSubject = () => {
    if (selectedCompId && !subjectCompIds.includes(selectedCompId)) {
      setSubjectCompIds([...subjectCompIds, selectedCompId]);
      setSelectedCompId('');
    }
  };

  const removeCompFromSubject = (id: string) => {
    setSubjectCompIds(subjectCompIds.filter(cid => cid !== id));
  };

  const addSubjectToForm = () => {
    const hPresencial = parseFloat(subjectHoursPresential);
    const hEAD = parseFloat(subjectHoursEAD);

    if (!subjectName.trim()) return alert("Digite o nome da Unidade Curricular.");
    if (isNaN(hPresencial) || hPresencial <= 0) return alert("Carga presencial inválida.");
    if (isNaN(hEAD) || hEAD < 0) return alert("Carga EAD inválida.");
    if (subjectCompIds.length === 0) return alert("Vincule pelo menos uma competência técnica.");

    if (currentPresentialSum + hPresencial > targetPresential) {
        if (!window.confirm("A soma das UCs ultrapassará a carga presencial planejada do curso. Deseja continuar?")) return;
    }

    const newSubjects = [...courseForm.subjects];
    
    // 1. Adiciona a UC Principal (Presencial)
    newSubjects.push({ 
      name: subjectName.trim(), 
      hours: hPresencial, 
      competencyIds: [...subjectCompIds] 
    });

    // 2. Adiciona a UC EAD (Condicionado ao Checkbox)
    if (autoGenerateEad && hEAD > 0) {
        newSubjects.push({ 
          name: `EAD - ${subjectName.trim()}`, 
          hours: hEAD, 
          competencyIds: [...subjectCompIds] 
        });
    }

    setCourseForm({ ...courseForm, subjects: newSubjects });
    setSubjectName('');
    setSubjectHoursPresential('');
    setSubjectHoursEAD('');
    setSubjectCompIds([]);
  };

  const removeSubjectFromForm = (index: number) => {
    const newSubjects = [...courseForm.subjects];
    newSubjects.splice(index, 1);
    setCourseForm({ ...courseForm, subjects: newSubjects });
  };

  const handleEditCourse = (course: Course) => {
    setCourseForm({
      name: course.name,
      areaId: course.areaId,
      typeId: course.typeId,
      presentialHours: course.presentialHours,
      eadHours: course.eadHours,
      totalClasses: course.totalClasses,
      subjects: course.subjects.map(s => ({...s, competencyIds: [...s.competencyIds]})),
      coursePlan: course.coursePlan || ''
    });
    
    setExpectedPresential(course.presentialHours.toString());
    setExpectedEAD(course.eadHours.toString());
    
    setEditingCourseId(course.id);
    setIsAddingCourse(true);
  };

  const handleSaveCourse = () => {
    if (!canSave) {
      alert("Erro: A soma das cargas horárias das UCs deve ser exatamente igual ao total planejado do curso.");
      return;
    }

    const totalHours = currentPresentialSum + currentEADSum;
    const calculatedClasses = Math.ceil(totalHours / HOUR_PER_CLASS);
    
    const courseData = {
        ...courseForm,
        presentialHours: currentPresentialSum,
        eadHours: currentEADSum,
        totalClasses: calculatedClasses
    };

    if (editingCourseId) {
       setCourses(courses.map(c => c.id === editingCourseId ? { ...courseData, id: editingCourseId } : c));
       alert("Curso atualizado com sucesso!");
    } else {
       setCourses([...courses, { ...courseData, id: Math.random().toString(36).substr(2, 9) }]);
       alert("Curso cadastrado com sucesso!");
    }

    resetAllForms();
  };

  const handlePlanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert("Por favor, selecione apenas arquivos PDF.");
        return;
      }
      // Limite de 2MB para evitar travar o localStorage
      if (file.size > 2 * 1024 * 1024) {
        alert("O arquivo é muito grande. Tamanho máximo: 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setCourseForm({ ...courseForm, coursePlan: reader.result as string });
        alert("Plano de curso carregado com sucesso!");
      };
      reader.readAsDataURL(file);
    }
  };

  const resetAllForms = () => {
    setCourseForm({ name: '', areaId: '', typeId: '', presentialHours: 0, eadHours: 0, totalClasses: 0, subjects: [], coursePlan: '' });
    setExpectedPresential('');
    setExpectedEAD('');
    setEditingCourseId(null);
    setIsAddingCourse(false);
    setAutoGenerateEad(false);
  };

  const calculateDays = (hours: number) => {
    if (hours === 0) return "0.0";
    return (hours / (refClassesPerDay * HOUR_PER_CLASS)).toFixed(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestão de Cursos</h2>
          <p className="text-sm text-slate-500">Cadastre cursos e gerencie os parâmetros acadêmicos da instituição.</p>
        </div>
        
        {!isInstructor && (
            <div className="flex bg-slate-200 p-1 rounded-lg overflow-x-auto max-w-full custom-scrollbar">
            <button 
                onClick={() => setActiveSubTab('COURSES')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all whitespace-nowrap ${activeSubTab === 'COURSES' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
            >
                Cursos
            </button>
            <div className="w-px bg-slate-300 mx-1"></div>
            {['AREAS', 'TYPES', 'PROJECTS'].map(tab => (
                <button 
                key={tab}
                onClick={() => setActiveSubTab(tab as any)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${activeSubTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                {tab === 'AREAS' ? 'Áreas' : tab === 'TYPES' ? 'Tipos' : 'Projetos'}
                </button>
            ))}
            </div>
        )}
      </div>

      {activeSubTab === 'COURSES' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <div className="text-sm text-slate-500 font-bold uppercase">
               Total: {filteredCourses.length} de {courses.length} Cursos
             </div>
             {!isAddingCourse && !isInstructor && (
              <button 
                onClick={() => { resetAllForms(); setIsAddingCourse(true); }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                Novo Curso
              </button>
            )}
          </div>

          {!isAddingCourse && (
            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm items-center">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    <span className="text-xs font-bold text-slate-500 uppercase">Filtrar:</span>
                </div>
                
                <select 
                    value={filterArea} 
                    onChange={(e) => setFilterArea(e.target.value)}
                    className="border border-slate-200 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 text-slate-700 font-medium"
                >
                    <option value="">Todas as Áreas</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>

                <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value)}
                    className="border border-slate-200 rounded-lg text-xs p-2 outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50 text-slate-700 font-medium"
                >
                    <option value="">Todos os Tipos</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                {(filterArea || filterType) && (
                    <button 
                        onClick={() => { setFilterArea(''); setFilterType(''); }}
                        className="text-xs text-red-500 font-bold hover:underline ml-auto"
                    >
                        Limpar Filtros
                    </button>
                )}
            </div>
          )}

          {isAddingCourse && (
            <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-xl space-y-6 animate-in zoom-in-95 duration-200 relative">
              <div className="absolute top-4 right-4 text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                {editingCourseId ? 'Editando Curso' : 'Novo Curso'}
              </div>

              <h3 className="text-lg font-bold text-slate-800 border-b pb-4">Dados Básicos do Curso</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome do Curso</label>
                  <input placeholder="Ex: Técnico em Informática" className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm" value={courseForm.name} onChange={e => setCourseForm({...courseForm, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Área</label>
                  <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm" value={courseForm.areaId} onChange={e => setCourseForm({...courseForm, areaId: e.target.value})}>
                    <option value="">Selecione a Área</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipo / Eixo</label>
                  <select className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm" value={courseForm.typeId} onChange={e => setCourseForm({...courseForm, typeId: e.target.value})}>
                    <option value="">Selecione o Tipo</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                <div>
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">Carga Horária Presencial Alvo (h)</label>
                  <input 
                    type="number" 
                    placeholder="Ex: 800" 
                    className="w-full border-2 border-indigo-100 p-2 rounded font-bold text-indigo-700 outline-none focus:border-indigo-400 transition-colors text-sm"
                    value={expectedPresential}
                    onChange={e => setExpectedPresential(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">Carga Horária EAD Alvo (h)</label>
                  <input 
                    type="number" 
                    placeholder="Ex: 200" 
                    className="w-full border-2 border-indigo-100 p-2 rounded font-bold text-indigo-700 outline-none focus:border-indigo-400 transition-colors text-sm"
                    value={expectedEAD}
                    onChange={e => setExpectedEAD(e.target.value)}
                  />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">Plano de Curso (PDF)</label>
                   <div className="flex gap-2">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full border-2 border-dashed p-2 rounded font-bold text-xs transition-colors flex items-center justify-center gap-2 ${courseForm.coursePlan ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-indigo-200 text-indigo-400 hover:bg-indigo-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        {courseForm.coursePlan ? 'PDF Anexado' : 'Carregar PDF'}
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handlePlanUpload} />
                   </div>
                </div>
              </div>

              {/* SUBJECTS MANAGEMENT */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                 <h4 className="font-bold text-slate-700 text-sm mb-2">Grade Curricular (Unidades Curriculares)</h4>
                 
                 {/* CHECKBOX GERAÇÃO AUTOMÁTICA EAD */}
                 <div className="flex items-center gap-2 mb-3 ml-1">
                    <input 
                        type="checkbox" 
                        id="chkAutoEad" 
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" 
                        checked={autoGenerateEad} 
                        onChange={e => setAutoGenerateEad(e.target.checked)} 
                    />
                    <label htmlFor="chkAutoEad" className="text-xs font-bold text-slate-500 cursor-pointer select-none">
                        Gerar UC "EAD" automaticamente
                    </label>
                 </div>

                 {/* Form UC */}
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 items-end border-t border-slate-200 pt-3">
                    <div className="md:col-span-4">
                       <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome da UC</label>
                       <input className="w-full border p-2 rounded text-sm outline-none" placeholder="Ex: Lógica de Programação" value={subjectName} onChange={e => setSubjectName(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                       <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Carga Presencial</label>
                       <input type="number" className="w-full border p-2 rounded text-sm outline-none" placeholder="Horas" value={subjectHoursPresential} onChange={e => setSubjectHoursPresential(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                       <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Carga EAD</label>
                       <input type="number" className="w-full border p-2 rounded text-sm outline-none" placeholder="Horas" value={subjectHoursEAD} onChange={e => setSubjectHoursEAD(e.target.value)} />
                    </div>
                    <div className="md:col-span-3">
                       <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Competência Exigida</label>
                       <div className="flex gap-1">
                          <select className="w-full border p-2 rounded text-sm outline-none" value={selectedCompId} onChange={e => setSelectedCompId(e.target.value)}>
                             <option value="">Selecione...</option>
                             {technicalCompetencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <button onClick={addCompToSubject} className="bg-slate-200 px-3 rounded text-slate-600 font-bold">+</button>
                       </div>
                    </div>
                    <div className="md:col-span-1">
                        <button onClick={addSubjectToForm} className="w-full bg-indigo-600 text-white p-2 rounded font-bold hover:bg-indigo-700">+</button>
                    </div>
                 </div>

                 {/* Tags de Competências Selecionadas para a UC atual */}
                 {subjectCompIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 bg-white p-2 rounded border border-slate-100">
                       <span className="text-[10px] font-bold text-slate-400 uppercase self-center">Competências:</span>
                       {subjectCompIds.map(cid => (
                          <span key={cid} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1">
                             {technicalCompetencies.find(tc => tc.id === cid)?.name}
                             <button onClick={() => removeCompFromSubject(cid)} className="text-red-400 hover:text-red-600 font-bold">×</button>
                          </span>
                       ))}
                    </div>
                 )}

                 {/* Lista de UCs Adicionadas */}
                 {courseForm.subjects.length > 0 ? (
                    <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm">
                          <thead className="bg-slate-200 text-slate-600 text-[10px] uppercase font-bold">
                             <tr>
                                <th className="p-2 rounded-l">UC</th>
                                <th className="p-2">Carga</th>
                                <th className="p-2">Competências</th>
                                <th className="p-2 text-right rounded-r">Ação</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                             {courseForm.subjects.map((sub, idx) => (
                                <tr key={idx}>
                                   <td className="p-2 font-medium">{sub.name}</td>
                                   <td className="p-2">{sub.hours}h</td>
                                   <td className="p-2 text-xs text-slate-500">
                                      {sub.competencyIds.map(cid => technicalCompetencies.find(tc => tc.id === cid)?.name).join(', ')}
                                   </td>
                                   <td className="p-2 text-right">
                                      <button onClick={() => removeSubjectFromForm(idx)} className="text-red-500 hover:text-red-700 font-bold text-xs uppercase">Remover</button>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 ) : (
                    <p className="text-center text-slate-400 text-sm py-4 italic">Nenhuma unidade curricular adicionada.</p>
                 )}
                 
                 {/* Totais */}
                 <div className="mt-4 flex justify-end gap-6 text-sm font-bold text-slate-700 border-t pt-2">
                    <div className={isPresentialMatch ? 'text-emerald-600' : 'text-amber-600'}>
                       Total Presencial: {currentPresentialSum} / {targetPresential}h
                    </div>
                    <div className={isEADMatch ? 'text-emerald-600' : 'text-amber-600'}>
                       Total EAD: {currentEADSum} / {targetEAD}h
                    </div>
                 </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                 <button onClick={resetAllForms} className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg font-medium">Cancelar</button>
                 <button 
                   onClick={handleSaveCourse} 
                   disabled={!canSave}
                   className={`px-6 py-2 text-white rounded-lg font-bold shadow-md transition-all ${canSave ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 cursor-not-allowed'}`}
                 >
                   {editingCourseId ? 'Salvar Alterações' : 'Cadastrar Curso'}
                 </button>
              </div>
            </div>
          )}

          {/* LISTA DE CURSOS */}
          {!isAddingCourse && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredCourses.map(course => {
                   const area = areas.find(a => a.id === course.areaId);
                   const type = types.find(t => t.id === course.typeId);
                   
                   return (
                      <div key={course.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                         <div className="flex justify-between items-start mb-2">
                            <div>
                               <h4 className="font-bold text-slate-800 text-lg leading-tight">{course.name}</h4>
                               <div className="flex gap-2 mt-1">
                                  <span className="text-[10px] uppercase font-bold text-white px-2 py-0.5 rounded" style={{ backgroundColor: area?.color || '#94a3b8' }}>
                                     {area?.name}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                     {type?.name}
                                  </span>
                               </div>
                            </div>
                            {!isInstructor && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => handleEditCourse(course)} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                   </button>
                                   <button onClick={() => { if(window.confirm('Excluir este curso?')) setCourses(courses.filter(c => c.id !== course.id)); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                   </button>
                                </div>
                            )}
                         </div>
                         
                         <div className="flex justify-between items-end text-xs text-slate-500 border-t pt-3 mt-3">
                            <div className="space-y-1">
                               <p>Presencial: <span className="font-bold text-slate-700">{course.presentialHours}h</span></p>
                               <p>EAD: <span className="font-bold text-slate-700">{course.eadHours}h</span></p>
                            </div>
                            <div className="text-right space-y-1">
                               <p>Total Aulas: <span className="font-bold text-slate-700">{course.totalClasses}</span></p>
                               <p>UCs: <span className="font-bold text-slate-700">{course.subjects.length}</span></p>
                            </div>
                         </div>
                         {course.coursePlan && (
                            <a 
                              href={course.coursePlan} 
                              download={`Plano_${course.name.replace(/\s+/g, '_')}.pdf`}
                              className="block mt-3 text-center bg-indigo-50 text-indigo-600 text-xs font-bold py-1.5 rounded hover:bg-indigo-100 transition-colors uppercase"
                            >
                               Baixar Plano de Curso
                            </a>
                         )}
                      </div>
                   );
                })}
                {filteredCourses.length === 0 && (
                   <div className="col-span-full py-12 text-center text-slate-400 italic">
                      Nenhum curso encontrado com os filtros selecionados.
                   </div>
                )}
             </div>
          )}
        </div>
      )}

      {/* OUTRAS ABAS */}
      {activeSubTab === 'AREAS' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
               <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b">Gerenciar Áreas</h3>
               <div className="space-y-4">
                  <input id="new-area" className="w-full border p-2 rounded text-sm outline-none" placeholder="Nome da Área (ex: Mecânica)" />
                  <div className="flex items-center gap-2">
                     <input type="color" className="h-8 w-16 p-0 border rounded" value={newAreaColor} onChange={e => setNewAreaColor(e.target.value)} />
                     <span className="text-xs text-slate-500">Cor da Etiqueta</span>
                  </div>
                  <button onClick={() => {
                     const input = document.getElementById('new-area') as HTMLInputElement;
                     if(input.value) {
                        setAreas([...areas, { id: Date.now().toString(), name: input.value, color: newAreaColor }]);
                        input.value = '';
                     }
                  }} className="w-full bg-indigo-600 text-white py-2 rounded font-bold text-sm uppercase hover:bg-indigo-700">Adicionar</button>
               </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <ul className="divide-y divide-slate-100">
                  {areas.map(a => (
                     <li key={a.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                           <div className="w-4 h-4 rounded-full" style={{ backgroundColor: a.color || '#ccc' }}></div>
                           <span className="font-bold text-slate-700">{a.name}</span>
                        </div>
                        <button onClick={() => setAreas(areas.filter(x => x.id !== a.id))} className="text-red-400 hover:text-red-600 font-bold text-xs uppercase">Remover</button>
                     </li>
                  ))}
               </ul>
            </div>
         </div>
      )}

      {activeSubTab === 'TYPES' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
               <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b">Tipos de Curso / Eixos</h3>
               <div className="flex gap-2">
                  <input id="new-type" className="flex-1 border p-2 rounded text-sm outline-none" placeholder="Ex: Qualificação Profissional" />
                  <button onClick={() => {
                     const input = document.getElementById('new-type') as HTMLInputElement;
                     if(input.value) {
                        setTypes([...types, { id: Date.now().toString(), name: input.value }]);
                        input.value = '';
                     }
                  }} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold text-sm uppercase hover:bg-indigo-700">Adicionar</button>
               </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <ul className="divide-y divide-slate-100">
                  {types.map(t => (
                     <li key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                        <span className="font-bold text-slate-700">{t.name}</span>
                        <button onClick={() => setTypes(types.filter(x => x.id !== t.id))} className="text-red-400 hover:text-red-600 font-bold text-xs uppercase">Remover</button>
                     </li>
                  ))}
               </ul>
            </div>
         </div>
      )}

      {activeSubTab === 'PROJECTS' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
               <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b">Projetos / Modalidades</h3>
               <div className="flex gap-2">
                  <input id="new-project" className="flex-1 border p-2 rounded text-sm outline-none" placeholder="Ex: Trilhas de Futuro" />
                  <button onClick={() => {
                     const input = document.getElementById('new-project') as HTMLInputElement;
                     if(input.value) {
                        setProjects([...projects, { id: Date.now().toString(), name: input.value }]);
                        input.value = '';
                     }
                  }} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold text-sm uppercase hover:bg-indigo-700">Adicionar</button>
               </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <ul className="divide-y divide-slate-100">
                  {projects.map(p => (
                     <li key={p.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                        <span className="font-bold text-slate-700">{p.name}</span>
                        <button onClick={() => setProjects(projects.filter(x => x.id !== p.id))} className="text-red-400 hover:text-red-600 font-bold text-xs uppercase">Remover</button>
                     </li>
                  ))}
               </ul>
            </div>
         </div>
      )}
    </div>
  );
};

export default Courses;
