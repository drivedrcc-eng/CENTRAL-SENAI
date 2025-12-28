
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../AppContext';
import { InfoCategory, InfoCard } from '../types';

interface InfoBoardProps {
  category: InfoCategory;
  title?: string;
  description?: string;
  colorTheme: string;
}

const InfoBoard: React.FC<InfoBoardProps> = ({ category, title: defaultTitle, description: defaultDesc, colorTheme }) => {
  const { 
    infoCards, setInfoCards, currentUser, getSectionMetadata, updateSectionMetadata, 
    documentTypes, setDocumentTypes, linkTypes, setLinkTypes 
  } = useApp();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Section Metadata State
  const metadata = getSectionMetadata(category);
  const [displayTitle, setDisplayTitle] = useState(metadata?.title || defaultTitle || '');
  const [displayDesc, setDisplayDesc] = useState(metadata?.description || defaultDesc || '');

  // Document/Link Filters & Management
  const [filterType, setFilterType] = useState<string>('');
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = currentUser?.role === 'SUPERVISION';

  // Determine if this category supports types
  const hasTypes = category === 'DOCUMENTS' || category === 'LINKS';
  const currentTypes = category === 'DOCUMENTS' ? documentTypes : (category === 'LINKS' ? linkTypes : []);

  useEffect(() => {
    if (metadata) {
        setDisplayTitle(metadata.title);
        setDisplayDesc(metadata.description);
    }
  }, [metadata]);

  const handleMetadataBlur = () => {
    if (metadata && (displayTitle !== metadata.title || displayDesc !== metadata.description)) {
        updateSectionMetadata(category, displayTitle, displayDesc);
    } else if (!metadata) {
        updateSectionMetadata(category, displayTitle, displayDesc);
    }
  };

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    imageUrl: string;
    externalLink: string;
    fileUrl: string;
    fileName: string;
    documentTypeId: string;
    linkTypeId: string;
  }>({
    title: '',
    description: '',
    imageUrl: '',
    externalLink: '',
    fileUrl: '',
    fileName: '',
    documentTypeId: '',
    linkTypeId: ''
  });

  const categoryCards = useMemo(() => {
    let cards = infoCards.filter(c => c.category === category);
    
    if (filterType) {
        if (category === 'DOCUMENTS') {
            cards = cards.filter(c => c.documentTypeId === filterType);
        } else if (category === 'LINKS') {
            cards = cards.filter(c => c.linkTypeId === filterType);
        }
    }

    return cards.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [infoCards, category, filterType]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert("Arquivo muito grande. Máximo 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          fileUrl: reader.result as string,
          fileName: file.name
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert("Por favor, selecione um arquivo de imagem.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) { // 2MB limit for images
        alert("Imagem muito grande. Máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          imageUrl: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!formData.title) return alert("Título é obrigatório.");

    if (editingId) {
      setInfoCards(prev => prev.map(c => c.id === editingId ? { ...c, ...formData } : c));
      alert("Atualizado com sucesso!");
    } else {
      const newCard: InfoCard = {
        id: Date.now().toString(),
        category,
        createdAt: new Date().toISOString(),
        ...formData
      };
      setInfoCards(prev => [newCard, ...prev]);
      alert("Criado com sucesso!");
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Remover este item?")) {
      setInfoCards(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleEdit = (card: InfoCard) => {
    setFormData({
      title: card.title,
      description: card.description,
      imageUrl: card.imageUrl || '',
      externalLink: card.externalLink || '',
      fileUrl: card.fileUrl || '',
      fileName: card.fileName || '',
      documentTypeId: card.documentTypeId || '',
      linkTypeId: card.linkTypeId || ''
    });
    setEditingId(card.id);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', imageUrl: '', externalLink: '', fileUrl: '', fileName: '', documentTypeId: '', linkTypeId: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleAddType = () => {
      if (!newTypeName.trim()) return;
      const id = (category === 'DOCUMENTS' ? 'dt-' : 'lt-') + Date.now();
      
      if (category === 'DOCUMENTS') {
          setDocumentTypes([...documentTypes, { id, name: newTypeName.trim() }]);
      } else if (category === 'LINKS') {
          setLinkTypes([...linkTypes, { id, name: newTypeName.trim() }]);
      }
      setNewTypeName('');
  };

  const handleDeleteType = (id: string) => {
      if(window.confirm("Remover este tipo?")) {
          if (category === 'DOCUMENTS') {
              setDocumentTypes(documentTypes.filter(d => d.id !== id));
              if(formData.documentTypeId === id) setFormData({...formData, documentTypeId: ''});
          } else if (category === 'LINKS') {
              setLinkTypes(linkTypes.filter(d => d.id !== id));
              if(formData.linkTypeId === id) setFormData({...formData, linkTypeId: ''});
          }
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex-1">
          {isAdmin ? (
            <div className="space-y-1 group relative">
               <input 
                 value={displayTitle}
                 onChange={e => setDisplayTitle(e.target.value)}
                 onBlur={handleMetadataBlur}
                 className="text-2xl font-bold text-slate-800 w-full bg-transparent border border-transparent rounded hover:border-slate-300 focus:border-indigo-500 focus:ring-0 px-1 -ml-1 transition-colors"
                 placeholder="Título da Página"
               />
               <textarea 
                 value={displayDesc}
                 onChange={e => setDisplayDesc(e.target.value)}
                 onBlur={handleMetadataBlur}
                 rows={2}
                 className="text-sm text-slate-500 w-full bg-transparent border border-transparent rounded hover:border-slate-300 focus:border-indigo-500 focus:ring-0 px-1 -ml-1 transition-colors resize-none"
                 placeholder="Descrição da Página"
               />
               <span className="absolute top-0 right-0 text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 uppercase font-bold pointer-events-none">Clique para editar</span>
            </div>
          ) : (
            <div>
                <h2 className="text-2xl font-bold text-slate-800">{displayTitle}</h2>
                <p className="text-sm text-slate-500">{displayDesc}</p>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
            {hasTypes && isAdmin && (
                <button 
                    onClick={() => setShowTypeManager(!showTypeManager)}
                    className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2 text-xs uppercase"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Configurar Tipos
                </button>
            )}
            {isAdmin && !isAdding && (
            <button 
                onClick={() => setIsAdding(true)}
                className={`px-4 py-2 rounded-lg font-bold shadow-md transition-all text-white flex items-center gap-2`}
                style={{ backgroundColor: colorTheme }}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                Novo Card
            </button>
            )}
        </div>
      </div>

      {/* FILTER BAR FOR DOCUMENTS OR LINKS */}
      {hasTypes && (
          <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Filtrar por:</span>
              <button 
                  onClick={() => setFilterType('')}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${!filterType ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
              >
                  Todos
              </button>
              {currentTypes.map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setFilterType(t.id)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${filterType === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                  >
                      {t.name}
                  </button>
              ))}
          </div>
      )}

      {/* TYPE MANAGER MODAL/PANEL */}
      {showTypeManager && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-lg max-w-md mx-auto animate-in zoom-in-95 duration-200 mb-6">
              <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h4 className="font-bold text-slate-700 text-sm">Gerenciar Tipos de {category === 'DOCUMENTS' ? 'Documento' : 'Link'}</h4>
                  <button onClick={() => setShowTypeManager(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="flex gap-2 mb-3">
                  <input 
                    className="flex-1 border p-1.5 rounded text-sm outline-none focus:ring-1 focus:ring-indigo-500" 
                    placeholder="Novo tipo (ex: Regulamento)" 
                    value={newTypeName} 
                    onChange={e => setNewTypeName(e.target.value)} 
                  />
                  <button onClick={handleAddType} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold uppercase hover:bg-emerald-700">Adicionar</button>
              </div>
              <ul className="divide-y divide-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
                  {currentTypes.map(t => (
                      <li key={t.id} className="py-2 px-1 flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-600">{t.name}</span>
                          <button onClick={() => handleDeleteType(t.id)} className="text-red-400 hover:text-red-600 font-bold">Excluir</button>
                      </li>
                  ))}
              </ul>
          </div>
      )}

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl max-w-2xl mx-auto">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">{editingId ? 'Editar Item' : 'Novo Item'}</h3>
          <div className="space-y-4">
            <div className="flex justify-center mb-4">
                <div 
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all overflow-hidden relative group"
                >
                   {formData.imageUrl ? (
                     <>
                        <img src={formData.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                           <span className="text-white font-bold text-xs uppercase">Alterar Imagem</span>
                        </div>
                     </>
                   ) : (
                     <div className="text-center p-4">
                        <svg className="w-8 h-8 text-slate-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-xs font-bold text-slate-500 uppercase">Carregar Imagem de Capa</span>
                     </div>
                   )}
                </div>
                <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImage} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
              <input className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-indigo-500" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Título do card..." />
            </div>

            {/* DOCUMENT/LINK TYPE SELECTOR */}
            {hasTypes && (
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de {category === 'DOCUMENTS' ? 'Documento' : 'Link'}</label>
                        <select 
                            className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-indigo-500 bg-white" 
                            value={category === 'DOCUMENTS' ? formData.documentTypeId : formData.linkTypeId} 
                            onChange={e => {
                                if (category === 'DOCUMENTS') setFormData({...formData, documentTypeId: e.target.value});
                                else setFormData({...formData, linkTypeId: e.target.value});
                            }}
                        >
                            <option value="">Selecione o tipo...</option>
                            {currentTypes.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    {/* Inline Type Adder shortcut */}
                    <button 
                        onClick={() => {
                            const name = prompt(`Novo tipo de ${category === 'DOCUMENTS' ? 'documento' : 'link'}:`);
                            if (name) {
                                const id = (category === 'DOCUMENTS' ? 'dt-' : 'lt-') + Date.now();
                                if (category === 'DOCUMENTS') {
                                    setDocumentTypes([...documentTypes, { id, name }]);
                                    setFormData(prev => ({ ...prev, documentTypeId: id }));
                                } else {
                                    setLinkTypes([...linkTypes, { id, name }]);
                                    setFormData(prev => ({ ...prev, linkTypeId: id }));
                                }
                            }
                        }}
                        className="bg-slate-100 border border-slate-300 text-slate-600 p-2 rounded hover:bg-slate-200 h-[42px] w-[42px] flex items-center justify-center"
                        title="Adicionar novo tipo rapidamente"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
              <textarea rows={3} className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-indigo-500" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Detalhes..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Link Externo (Opcional)</label>
              <input className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-indigo-500" value={formData.externalLink} onChange={e => setFormData({...formData, externalLink: e.target.value})} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Anexo (Opcional)</label>
              <div className="flex gap-2 items-center">
                <button onClick={() => fileInputRef.current?.click()} className="bg-slate-100 border border-slate-300 text-slate-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-200">
                  Escolher Arquivo
                </button>
                <span className="text-xs text-slate-500 truncate max-w-[200px]">{formData.fileName || 'Nenhum arquivo'}</span>
                {formData.fileUrl && (
                  <button onClick={() => setFormData({...formData, fileUrl: '', fileName: ''})} className="text-red-500 hover:text-red-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFile} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={resetForm} className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg">Cancelar</button>
              <button onClick={handleSave} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-emerald-700">Salvar</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categoryCards.map(card => (
          <div key={card.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden relative group">
            {isAdmin && (
              <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded p-1 shadow-sm">
                <button onClick={() => handleEdit(card)} className="text-indigo-500 hover:text-indigo-700 p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                <button onClick={() => handleDelete(card.id)} className="text-red-500 hover:text-red-700 p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
              </div>
            )}
            
            {/* Card Image Cover */}
            {card.imageUrl && (
                <div className="w-full h-40 bg-slate-100 overflow-hidden border-b border-slate-100">
                    <img src={card.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={card.title} />
                </div>
            )}

            <div className="p-5 flex-1">
              {/* Document/Link Type Badge */}
              {(hasTypes && (card.documentTypeId || card.linkTypeId)) && (
                  <div className="mb-2">
                      <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                          {
                            category === 'DOCUMENTS' 
                            ? (documentTypes.find(t => t.id === card.documentTypeId)?.name || 'Tipo Desconhecido')
                            : (linkTypes.find(t => t.id === card.linkTypeId)?.name || 'Tipo Desconhecido')
                          }
                      </span>
                  </div>
              )}

              <h3 className="font-bold text-lg text-slate-800 mb-2 leading-tight">{card.title}</h3>
              <p className="text-sm text-slate-500 whitespace-pre-line">{card.description}</p>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center gap-2">
               {card.externalLink ? (
                 <a href={card.externalLink} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                   Acessar Link
                 </a>
               ) : <span></span>}
               
               {card.fileUrl && (
                 <a href={card.fileUrl} download={card.fileName || 'download'} className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded hover:bg-emerald-100 flex items-center gap-1 transition-colors">
                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   Baixar Arquivo
                 </a>
               )}
            </div>
          </div>
        ))}
        {categoryCards.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed rounded-xl">
            <p>Nenhum item cadastrado nesta seção {filterType ? 'com o filtro selecionado' : ''}.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoBoard;
