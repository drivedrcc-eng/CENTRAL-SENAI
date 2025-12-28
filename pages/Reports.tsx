
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Icons } from '../constants';
import { Shift } from '../types';

const COLORS = [
    '#2563eb', // Blue
    '#8b5cf6', // Violet
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#6366f1', // Indigo
];

const Reports: React.FC = () => {
    const { users, events, groups, areas, types, workloads, calendarEvents, courses, rooms, projects, customFont, reportBackground, currentUser } = useApp();
    const [period, setPeriod] = useState<'MONTH' | 'YEAR'>('MONTH');
    const [isGenerating, setIsGenerating] = useState(false);

    const isInstructor = currentUser?.role === 'INSTRUCTOR';

    // Novo estado de abas
    const [activeTab, setActiveTab] = useState<'INSTRUCTORS' | 'CLASSES'>('INSTRUCTORS');

    // Filtros de Relatório - Instrutores
    const [filterArea, setFilterArea] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Filtros de Relatório - Turmas
    const [filterClassArea, setFilterClassArea] = useState('');
    const [filterClassCourse, setFilterClassCourse] = useState('');
    const [filterClassShift, setFilterClassShift] = useState('');
    const [searchClassTerm, setSearchClassTerm] = useState('');

    // Filtros SAEP
    const [saepFilterMode, setSaepFilterMode] = useState<'ALL' | 'READY' | 'BY_DATE'>('ALL');
    const [saepDateLimit, setSaepDateLimit] = useState(new Date().toISOString().split('T')[0]);

    // Constante para peso de horas de um evento de agendamento.
    const HOURS_PER_EVENT = 4.0;

    // --- LÓGICA DE FILTRAGEM DE INSTRUTORES ---
    const instructors = useMemo(() => {
        // Se for instrutor, retorna apenas ele mesmo
        if (isInstructor && currentUser) {
            return [currentUser];
        }

        // Filtra quem não é supervisão (administrador) e tem competências
        return users.filter(u => {
            const isInstructorUser = u.role !== 'SUPERVISION' && u.competencyIds && u.competencyIds.length > 0;
            if (!isInstructorUser) return false;

            // Filtro por Área
            if (filterArea && u.areaId !== filterArea) return false;

            // Filtro por Nome
            if (searchTerm && !u.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            return true;
        });
    }, [users, filterArea, searchTerm, isInstructor, currentUser]);

    const instructorOccupancyData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        // Se for anual, consideramos null para pegar o ano todo, senão pega o mês atual
        const currentMonth = period === 'MONTH' ? now.getMonth() : null;

        // 1. Calcular Dias Letivos (Working Days) no Período conforme Calendário Acadêmico
        const calculateWorkingDays = () => {
            let count = 0;
            const start = new Date(currentYear, currentMonth === null ? 0 : currentMonth, 1);
            const end = new Date(currentYear, currentMonth === null ? 12 : currentMonth + 1, 0);

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                // Ignora Sábado (6) e Domingo (0)
                if (dayOfWeek === 0 || dayOfWeek === 6) continue;

                const dateStr = d.toISOString().split('T')[0];
                // Ignora Feriados/Dias Não Letivos cadastrados no Calendário
                const isDayOff = calendarEvents.some(c => c.date === dateStr && c.isDayOff);

                if (!isDayOff) count++;
            }
            return count;
        };

        const schoolDays = calculateWorkingDays();

        return instructors.map(inst => {
            // 2. Determinar Capacidade DIÁRIA do Instrutor = Carga Horária / 5
            const workload = workloads.find(w => w.id === inst.workloadId);
            let weeklyHours = 40; // Default

            if (workload) {
                // Tenta extrair número do nome (ex: "40 Horas" -> 40, "20 Horas" -> 20)
                const match = workload.name.match(/(\d+)/);
                if (match) {
                    weeklyHours = parseInt(match[1]);
                }
            }

            const dailyCapacityHours = weeklyHours / 5; // (carga horaria / 5)

            // 3. Filtrar Eventos (Agendamentos)
            const filteredEvents = events.filter(e => {
                const evDate = new Date(e.date + 'T00:00:00');
                const isSameYear = evDate.getFullYear() === currentYear;

                if (period === 'YEAR') {
                    return e.instructorId === inst.id && isSameYear;
                } else {
                    return e.instructorId === inst.id && isSameYear && evDate.getMonth() === (currentMonth || 0);
                }
            });

            // Quantidade de agendamentos na agenda
            const quantityOfEvents = filteredEvents.length;

            // Total de Horas Agendadas = Quantidade * 4h
            const totalHoursScheduled = quantityOfEvents * HOURS_PER_EVENT;

            // 4. Métrica de Ocupação
            // Fórmula: ((Agendamentos * 4h) / (CargaDiaria)) / DiasLetivos
            // Isso representa quantos "dias de capacidade total" foram consumidos dividido pelos dias disponíveis.
            const occupiedDaysEquivalent = dailyCapacityHours > 0 ? (totalHoursScheduled / dailyCapacityHours) : 0;

            // Porcentagem
            const percentage = schoolDays > 0
                ? Math.min(Math.round((occupiedDaysEquivalent / schoolDays) * 100), 100)
                : 0;

            const areaName = areas.find(a => a.id === inst.areaId)?.name || 'Geral';

            return {
                id: inst.id,
                name: inst.name,
                re: inst.re, // Inclui o RE
                photoUrl: inst.photoUrl,
                area: areaName,
                percentage,
                occupiedDays: occupiedDaysEquivalent.toFixed(1),
                schoolDays,
                eventCount: quantityOfEvents // Útil para debug ou display
            };
        }).sort((a, b) => b.percentage - a.percentage);
    }, [instructors, events, period, areas, calendarEvents, workloads]);

    // --- PROCESSAMENTO UNIFICADO DE DADOS DE TURMAS (COM FILTROS SAEP) ---
    const processedClassData = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // 1. Filtragem Básica
        let candidates = groups.filter(group => {
            const course = courses.find(c => c.id === group.courseId);

            // Se for instrutor, mostrar apenas turmas onde ele deu aula
            if (isInstructor && currentUser) {
                const hasTaught = events.some(e => e.classGroupId === group.id && e.instructorId === currentUser.id);
                if (!hasTaught) return false;
            }

            // Filtro por Nome da Turma
            if (searchClassTerm && !group.name.toLowerCase().includes(searchClassTerm.toLowerCase())) {
                return false;
            }

            // Filtro por Área do Curso
            if (filterClassArea && course?.areaId !== filterClassArea) {
                return false;
            }

            // Filtro por Curso Específico
            if (filterClassCourse && group.courseId !== filterClassCourse) {
                return false;
            }

            // Filtro por Turno
            if (filterClassShift && group.shift !== filterClassShift) {
                return false;
            }

            return true;
        });

        // 2. Enriquecimento (Cálculo de Progresso e SAEP)
        const enriched = candidates.map(group => {
            const course = courses.find(c => c.id === group.courseId);
            const courseType = types.find(t => t.id === course?.typeId);
            const isTechnical = courseType?.name === 'Técnico';

            let rawProgress = 0;
            let saepDateObj: Date | null = null;
            let saepDateStr = '-';

            if (group.startDate && group.estimatedEndDate) {
                const start = new Date(group.startDate + 'T00:00:00');
                const end = new Date(group.estimatedEndDate + 'T00:00:00');

                const totalTime = end.getTime() - start.getTime();
                const elapsedTime = now.getTime() - start.getTime();

                // Progresso Real (Float)
                rawProgress = totalTime > 0 ? (elapsedTime / totalTime) * 100 : (now >= end ? 100 : 0);
                rawProgress = Math.max(0, Math.min(100, rawProgress));

                // Calcular Data Prevista para 80% (SAEP)
                // Apenas se for Técnico
                if (isTechnical) {
                    const timeTo80Percent = totalTime * 0.8;
                    saepDateObj = new Date(start.getTime() + timeTo80Percent);
                    saepDateStr = saepDateObj.toLocaleDateString('pt-BR');
                }
            } else {
                // Se não tem datas, progresso é 0
                rawProgress = 0;
            }

            return {
                group,
                course,
                isTechnical, // Flag para controle de exibição
                completado: Math.round(rawProgress),
                rawProgress,
                startDate: group.startDate,
                endDate: group.estimatedEndDate,
                saepDateStr,
                saepDateObj
            };
        });

        // 3. Filtragem por Status SAEP (Apenas para cursos técnicos)
        return enriched.filter(item => {
            if (saepFilterMode === 'ALL') return true;

            // Se o filtro SAEP estiver ativo, ignoramos cursos que não são técnicos
            if (!item.isTechnical) return false;

            if (saepFilterMode === 'READY') {
                // Aptas agora (>= 80%)
                return item.rawProgress >= 79.5;
            }

            if (saepFilterMode === 'BY_DATE') {
                // Aptas até a data limite
                if (!item.saepDateObj) return false;
                const limit = new Date(saepDateLimit + 'T23:59:59');
                // Inclui as que já estão aptas (data SAEP no passado) E as que ficarão até a data
                return item.saepDateObj <= limit;
            }

            return true;
        });
    }, [groups, courses, types, searchClassTerm, filterClassArea, filterClassCourse, filterClassShift, saepFilterMode, saepDateLimit, isInstructor, currentUser, events]);

    // Dados para o Gráfico de Progresso Geral
    const courseCompletionData = useMemo(() => {
        return processedClassData.map(item => ({
            id: item.group.id,
            name: item.group.name,
            completado: item.completado,
            rawProgress: item.rawProgress,
            startDate: item.startDate,
            endDate: item.endDate,
            saepDate: item.saepDateStr,
            isTechnical: item.isTechnical
        }));
    }, [processedClassData]);

    // --- LÓGICA DO RELATÓRIO DETALHADO DE TURMAS (PARA DISPLAY NA TELA) ---
    const detailedClassReport = useMemo(() => {
        return processedClassData.map(item => {
            const group = item.group;
            const course = item.course;
            const status = group.status === 'CONCLUDED' ? 'Concluída' : 'Ativa';

            // Detalhamento das UCs
            const ucsDetails = course?.subjects.map(subject => {
                // Filtrar eventos desta turma e desta matéria
                const subjectEvents = events.filter(e =>
                    e.classGroupId === group.id &&
                    e.type === 'AULA' &&
                    e.subject === subject.name
                );

                // Calcular horas agendadas (assumindo 4h por evento, ou lógica similar)
                const hoursScheduled = subjectEvents.length * HOURS_PER_EVENT;

                // Progresso da UC (limitado a 100%)
                const progress = subject.hours > 0
                    ? Math.min(100, Math.round((hoursScheduled / subject.hours) * 100))
                    : 0;

                // Instrutores que deram aula nesta matéria para esta turma
                const instructorIds = Array.from(new Set(subjectEvents.map(e => e.instructorId)));
                const instructorNames = instructorIds.map(id => users.find(u => u.id === id)?.name || 'N/A');

                return {
                    name: subject.name,
                    progress,
                    instructors: instructorNames
                };
            }) || [];

            return {
                groupName: group.name,
                courseName: course?.name || 'N/A',
                totalProgress: item.completado,
                status,
                ucs: ucsDetails
            };
        });
    }, [processedClassData, events, users]);

    /**
     * Helper para comprimir imagem e converter para JPEG
     * Isso reduz drasticamente o tamanho do PDF final.
     */
    const compressImage = (source: Blob | string, quality = 0.70): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous'; // Importante para imagens externas

            const url = typeof source === 'string' ? source : URL.createObjectURL(source);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    if (typeof source !== 'string') URL.revokeObjectURL(url);
                    reject(new Error('Canvas context failure'));
                    return;
                }

                // Preenche com branco para lidar com transparência (JPEG não suporta alpha)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                // Exporta como JPEG com qualidade reduzida
                const dataUrl = canvas.toDataURL('image/jpeg', quality);

                if (typeof source !== 'string') URL.revokeObjectURL(url);
                resolve(dataUrl); // Retorna Data URL completo
            };

            img.onerror = (e) => {
                if (typeof source !== 'string') URL.revokeObjectURL(url);
                console.warn("Falha na compressão da imagem:", e);
                // Fallback: se falhar, retorna o original (se for string)
                if (typeof source === 'string') resolve(source);
                else reject(e);
            }

            img.src = url;
        });
    };

    // --- ASSET LOADER ---
    const loadAssets = async () => {
        let fontData: string | null = null;
        let bgData: string | null = null;

        try {
            if (customFont) {
                if (customFont.startsWith('http')) {
                    const resp = await fetch(customFont);
                    const blob = await resp.blob();
                    fontData = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                } else {
                    fontData = customFont;
                }
            }

            if (reportBackground) {
                // Tenta carregar e comprimir a imagem de fundo
                try {
                    let imageSource: Blob | string = reportBackground;

                    if (reportBackground.startsWith('http')) {
                        const resp = await fetch(reportBackground);
                        imageSource = await resp.blob();
                    }

                    // Comprime para JPEG
                    bgData = await compressImage(imageSource);

                } catch (imgErr) {
                    console.warn("Erro ao processar imagem de fundo, tentando raw...", imgErr);
                    // Fallback para raw se compressão falhar
                    if (reportBackground.startsWith('http')) {
                        // Se falhar a compressão mas era URL, tenta pegar o Blob direto sem compressão
                        const resp = await fetch(reportBackground);
                        const blob = await resp.blob();
                        bgData = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                    } else {
                        bgData = reportBackground;
                    }
                }
            }
        } catch (e) {
            console.error("Erro ao carregar assets para PDF", e);
            alert("Aviso: Alguns recursos visuais (fonte/fundo) falharam ao carregar. O PDF será gerado sem eles.");
        }

        return { fontData, bgData };
    };

    /**
     * Helper para adicionar números de páginas no rodapé
     * Posiciona o número dentro do elemento gráfico do rodapé (centro/baixo)
     */
    const addPageNumbers = (doc: jsPDF, fontName: string) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(9);
        doc.setTextColor(100); // Slate 500 (Gray)

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont(fontName, 'bold');
            // Posição ajustada para ficar dentro do logo "[]" no rodapé
            // A4 Landscape: 297mm largura, 210mm altura.
            // Centro X = 148.5
            // Altura do rodapé ~200
            doc.text(`${i}`, 148.5, 204, { align: 'center' });
        }
    };

    // PDF Geral de Instrutores
    const generatePDF = async () => {
        setIsGenerating(true);
        const { fontData, bgData } = await loadAssets();

        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
        const pageWidth = doc.internal.pageSize.getWidth();

        if (fontData) {
            doc.addFileToVFS('CustomFont.ttf', fontData);
            doc.addFont('CustomFont.ttf', 'CustomFont', 'normal');
            doc.addFont('CustomFont.ttf', 'CustomFont', 'bold'); // Register same font for bold
            doc.setFont('CustomFont');
        } else {
            doc.setFont("helvetica");
        }

        if (bgData) {
            doc.addImage(bgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
        }

        doc.setFontSize(18);
        doc.setTextColor(37, 99, 235);
        // Título em Negrito
        doc.setFont(fontData ? 'CustomFont' : 'helvetica', 'bold');
        doc.text('Relatório De Ocupação', pageWidth / 2, 20, { align: 'center' });

        const tableBody = instructorOccupancyData.map(inst => [
            inst.name,
            inst.re || 'N/A',
            inst.area,
            `${inst.occupiedDays} dias`,
            `${inst.percentage}%`
        ]);

        autoTable(doc, {
            startY: 40,
            head: [['Instrutor', 'RE', 'Area', 'Dias Ocupados', 'Ocupacao (%)']],
            body: tableBody,
            styles: { font: fontData ? 'CustomFont' : 'helvetica' }, // Global style for table
            headStyles: { fillColor: [37, 99, 235] },
            bodyStyles: {},
            willDrawPage: (data) => {
                if (bgData && data.pageNumber > 1) {
                    doc.addImage(bgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
                }
            }
        });

        addPageNumbers(doc, fontData ? 'CustomFont' : 'helvetica');

        doc.save(`Relatorio_Ocupacao_${period}.pdf`);
        setIsGenerating(false);
    };

    // PDF Individual do Instrutor (Com cabeçalho detalhado) - MODO PAISAGEM
    const generateInstructorPDF = async (instData: any) => {
        setIsGenerating(true);
        const { fontData, bgData } = await loadAssets();

        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape (Padronizado)
        const pageWidth = doc.internal.pageSize.getWidth();

        // Configurações de Fonte e Background
        if (fontData) {
            doc.addFileToVFS('CustomFont.ttf', fontData);
            doc.addFont('CustomFont.ttf', 'CustomFont', 'normal');
            doc.addFont('CustomFont.ttf', 'CustomFont', 'bold');
            doc.setFont('CustomFont');
        } else {
            doc.setFont("helvetica");
        }

        if (bgData) {
            doc.addImage(bgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
        }

        // Busca dados completos do usuário e auxiliares
        const user = users.find(u => u.id === instData.id);
        const workloadName = workloads.find(w => w.id === user?.workloadId)?.name || 'N/A';
        const areaName = areas.find(a => a.id === user?.areaId)?.name || 'N/A';

        // Cabeçalho Principal (Título em Negrito)
        doc.setFontSize(16);
        doc.setTextColor(30, 58, 138); // Dark Blue
        doc.setTextColor(30, 58, 138); // Dark Blue
        doc.setFont(fontData ? 'CustomFont' : 'helvetica', 'bold');
        doc.text("Relatório Individual De Ocupação", pageWidth / 2, 20, { align: 'center' });

        // Reset para fonte normal para o subtítulo
        doc.setFont(fontData ? 'CustomFont' : 'helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100);
        const periodLabel = period === 'MONTH'
            ? new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
            : new Date().getFullYear().toString();
        doc.text(`Período Base: ${periodLabel}`, pageWidth / 2, 26, { align: 'center' });

        // --- BLOCO DE DADOS CADASTRAIS DO INSTRUTOR ---
        const startY = 35;
        const margin = 14;
        const blockWidth = pageWidth - (margin * 2);

        // Fundo cinza claro para o cabeçalho de dados
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, startY, blockWidth, 35, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, startY, blockWidth, 35, 2, 2, 'S');

        // Lógica para Foto e Ajuste de Texto
        let contentStartX = margin + 6; // Posição X padrão do texto

        if (user?.photoUrl) {
            try {
                // Moldura branca para a foto
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(margin + 2, startY + 2.5, 30, 30, 1, 1, 'F');

                // Adiciona a imagem
                doc.addImage(user.photoUrl, 'JPEG', margin + 2, startY + 2.5, 30, 30);

                // Empurra o texto para a direita
                contentStartX = margin + 40;
            } catch (e) {
                console.warn("Não foi possível adicionar a foto ao PDF.");
            }
        }

        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59); // Slate 800
        doc.text(user?.name || 'Instrutor', contentStartX, startY + 10);

        doc.setFontSize(9);
        doc.setTextColor(100);

        // Coluna 1
        doc.text(`RE:`, contentStartX, startY + 20);
        doc.setTextColor(30, 41, 59);
        doc.text(user?.re || '-', contentStartX + 10, startY + 20);

        doc.setTextColor(100);
        doc.text(`Área:`, contentStartX, startY + 28);
        doc.setTextColor(30, 41, 59);
        doc.text(areaName, contentStartX + 10, startY + 28);

        // Coluna 2 (Ajustada para Landscape, mais espaçada)
        const col2X = contentStartX + 80;

        doc.setTextColor(100);
        doc.text(`Email:`, col2X, startY + 20);
        doc.setTextColor(30, 41, 59);
        doc.text(user?.email || '-', col2X + 15, startY + 20);

        doc.setTextColor(100);
        doc.text(`Telefone:`, col2X, startY + 28);
        doc.setTextColor(30, 41, 59);
        doc.text(user?.phone || '-', col2X + 15, startY + 28);

        // Coluna 3 (Stats) - Posicionada à direita do bloco largo
        const statsBoxWidth = 40;
        const statsBoxX = (margin + blockWidth) - statsBoxWidth - 5; // Alinhado à direita dentro do bloco

        doc.setFillColor(224, 231, 255); // Indigo 100
        doc.roundedRect(statsBoxX, startY + 5, statsBoxWidth, 25, 1, 1, 'F');

        doc.setFontSize(8);
        doc.setTextColor(67, 56, 202); // Indigo 700
        doc.text("Ocupação no Período", statsBoxX + (statsBoxWidth / 2), startY + 12, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(49, 46, 129); // Indigo 900
        doc.text(`${instData.percentage}%`, statsBoxX + (statsBoxWidth / 2), startY + 22, { align: 'center' });

        // --- TABELA DE EVENTOS DO PERÍODO ---
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = period === 'MONTH' ? now.getMonth() : null;

        const userEvents = events.filter(e => {
            const evDate = new Date(e.date + 'T00:00:00');
            const isSameYear = evDate.getFullYear() === currentYear;
            const isInstructor = e.instructorId === user?.id;

            if (period === 'YEAR') {
                return isInstructor && isSameYear;
            } else {
                return isInstructor && isSameYear && evDate.getMonth() === (currentMonth || 0);
            }
        }).sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));

        const tableBody = userEvents.map(ev => {
            const room = rooms.find(r => r.id === ev.roomId);
            const dateObj = new Date(ev.date + 'T00:00:00');
            const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });

            return [
                ev.date.split('-').reverse().join('/'),
                weekDay.toUpperCase(),
                ev.shift,
                ev.title + (ev.subject ? ` - ${ev.subject}` : ''),
                room?.name || 'Local N/A'
            ];
        });

        if (tableBody.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text("Nenhuma atividade registrada para este período.", pageWidth / 2, startY + 50, { align: 'center' });
        } else {
            autoTable(doc, {
                startY: startY + 40,
                head: [['Data', 'Dia', 'Turno', 'Atividade / Turma', 'Local']],
                body: tableBody,
                styles: { font: fontData ? 'CustomFont' : 'helvetica' },
                headStyles: { fillColor: [51, 65, 85], fontSize: 9 }, // Slate 700
                bodyStyles: { fontSize: 8 },
                alternateRowStyles: { fillColor: [241, 245, 249] }, // Slate 100
                columnStyles: {
                    0: { cellWidth: 30 }, // Data
                    1: { cellWidth: 20 }, // Dia
                    2: { cellWidth: 30 }, // Turno
                    // 3 é auto (Atividade)
                    4: { cellWidth: 50 }  // Local
                },
                willDrawPage: (data) => {
                    if (bgData && data.pageNumber > 1) {
                        doc.addImage(bgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
                    }
                }
            });
        }



        addPageNumbers(doc, fontData ? 'CustomFont' : 'helvetica');

        doc.save(`Relatorio_Individual_${user?.name.replace(/\s+/g, '_')}_${period}.pdf`);
        setIsGenerating(false);
    };

    // PDF Detalhado de Turmas (COM CABEÇALHO COMPLETO E CURSO ABAIXO DA TURMA)
    const generateDetailedClassesPDF = async (targetClassId?: string) => {
        setIsGenerating(true);
        const { fontData, bgData } = await loadAssets();

        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // CORES DO RELATÓRIO
        // Azul Profundo: #164194 -> RGB: 22, 65, 148
        // Laranja Vibrante: #E84910 -> RGB: 232, 73, 16
        const COLOR_PRIMARY: [number, number, number] = [22, 65, 148];
        const COLOR_ACCENT: [number, number, number] = [232, 73, 16];

        if (fontData) {
            doc.addFileToVFS('CustomFont.ttf', fontData);
            doc.addFont('CustomFont.ttf', 'CustomFont', 'normal');
            doc.addFont('CustomFont.ttf', 'CustomFont', 'bold');
            doc.setFont('CustomFont');
        } else {
            doc.setFont("helvetica");
        }

        if (bgData) {
            doc.addImage(bgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
        }

        // Filtragem dos dados (Geral ou Único)
        const dataToPrint = targetClassId
            ? processedClassData.filter(d => d.group.id === targetClassId)
            : processedClassData;

        if (dataToPrint.length === 0) {
            alert("Nenhuma turma encontrada para gerar o relatório.");
            setIsGenerating(false);
            return;
        }

        // Título Principal do Relatório em NEGRITO
        doc.setFontSize(16);
        doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]); // #164194
        doc.setFont(fontData ? 'CustomFont' : 'helvetica', 'bold');

        const titleText = targetClassId
            ? `Relatório Detalhado - ${dataToPrint[0].group.name}`
            : 'Relatório Detalhado De Turmas';

        doc.text(titleText, pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont(fontData ? 'CustomFont' : 'helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 26, { align: 'center' });

        let finalY = 35;

        // Função auxiliar para verificar quebra de página
        const checkPageBreak = (spaceNeeded: number) => {
            if (finalY + spaceNeeded > pageHeight - 15) {
                doc.addPage();
                if (bgData) {
                    doc.addImage(bgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
                }
                finalY = 20;
            }
        };

        dataToPrint.forEach((item) => {
            const { group, course, completado, saepDateStr, rawProgress, isTechnical } = item;
            const roomName = rooms.find(r => r.id === group.roomId)?.name || 'Não definida';
            const projectName = projects.find(p => p.id === group.projectId)?.name || '-';
            const areaName = areas.find(a => a.id === course?.areaId)?.name || 'Geral';
            const statusLabel = group.status === 'CONCLUDED' ? 'CONCLUÍDA' : 'EM ANDAMENTO';

            // Altura do cabeçalho da turma aumentada para acomodar o curso em nova linha
            const boxHeight = 32;
            // Espaço necessário para o bloco de cabeçalho + tabela mínima
            checkPageBreak(60);

            // --- DESENHO DO CABEÇALHO DA TURMA ---

            // Fundo do cabeçalho da turma
            doc.setFillColor(248, 250, 252); // Slate 50
            doc.roundedRect(14, finalY, pageWidth - 28, boxHeight, 2, 2, 'F');
            doc.setDrawColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]); // #164194
            doc.roundedRect(14, finalY, pageWidth - 28, boxHeight, 2, 2, 'S');

            // Linha 1: Nome da Turma (Destaque)
            doc.setFontSize(12);
            doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]); // #164194
            doc.setFont(fontData ? 'CustomFont' : 'helvetica', 'bold');
            doc.text(group.name, 18, finalY + 8);

            // Linha 2: Nome do Curso (Abaixo da Turma)
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.setFont(fontData ? 'CustomFont' : 'helvetica', 'normal');
            doc.text(course?.name || 'Curso não encontrado', 18, finalY + 13); // Posição ajustada abaixo da turma

            // Status Badge
            const statusColor = group.status === 'CONCLUDED' ? [100, 116, 139] : COLOR_ACCENT; // Slate or Orange #E84910
            doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
            doc.setFont(fontData ? 'CustomFont' : 'helvetica', 'bold');
            doc.text(statusLabel, pageWidth - 18, finalY + 8, { align: 'right' });

            // Linha 3: Detalhes (Grid na parte inferior do box)
            const lineDetailsY = finalY + 22;
            doc.setFontSize(8);
            doc.setTextColor(100); // Slate 500
            doc.setFont(fontData ? 'CustomFont' : 'helvetica', 'normal');

            // Coluna 1: Período e Turno
            doc.text(`Início: ${group.startDate.split('-').reverse().join('/')}`, 18, lineDetailsY);
            doc.text(`Fim Previsto: ${group.estimatedEndDate ? group.estimatedEndDate.split('-').reverse().join('/') : 'A definir'}`, 18, lineDetailsY + 5);
            doc.text(`Turno: ${group.shift}`, 80, lineDetailsY);

            // Coluna 2: Local e Projeto
            doc.text(`Sala Padrão: ${roomName}`, 80, lineDetailsY + 5);
            doc.text(`Projeto: ${projectName}`, 140, lineDetailsY);
            doc.text(`Área: ${areaName}`, 140, lineDetailsY + 5);

            // Coluna 3: Métricas (Progresso e SAEP)
            const progressX = pageWidth - 60;
            doc.text(`Progresso Geral:`, progressX, lineDetailsY);
            doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2]); // Orange #E84910
            doc.text(`${completado}%`, progressX + 25, lineDetailsY);

            // Exibe SAEP apenas se for Técnico
            if (isTechnical) {
                doc.setTextColor(100);
                doc.text(`Previsão SAEP:`, progressX, lineDetailsY + 5);
                doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]); // Blue #164194
                doc.text(saepDateStr, progressX + 25, lineDetailsY + 5);
            }

            finalY += (boxHeight + 4); // Avança para a tabela com espaçamento

            // --- TABELA DE UCs DA TURMA ---

            // Preparar dados das UCs
            const ucsData = course?.subjects.map(subject => {
                // Filtrar eventos desta turma e desta matéria
                const subjectEvents = events.filter(e =>
                    e.classGroupId === group.id &&
                    e.type === 'AULA' &&
                    e.subject === subject.name
                );

                const hoursScheduled = subjectEvents.length * HOURS_PER_EVENT;
                const progress = subject.hours > 0
                    ? Math.min(100, Math.round((hoursScheduled / subject.hours) * 100))
                    : 0;

                const instructorIds = Array.from(new Set(subjectEvents.map(e => e.instructorId)));
                const instructorNames = instructorIds.map(id => users.find(u => u.id === id)?.name || 'N/A').join(', ');

                return [
                    subject.name,
                    `${subject.hours}h`,
                    `${progress}%`,
                    instructorNames || 'Não iniciado'
                ];
            }) || [];

            if (ucsData.length > 0) {
                autoTable(doc, {
                    startY: finalY,
                    head: [['Unidade Curricular (UC)', 'Carga', 'Progresso', 'Instrutores']],
                    body: ucsData,
                    theme: 'striped',
                    styles: { font: fontData ? 'CustomFont' : 'helvetica' },
                    headStyles: {
                        fillColor: COLOR_PRIMARY, // #164194
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 8,
                        lineWidth: 0.1,
                        lineColor: [226, 232, 240]
                    },
                    bodyStyles: {
                        fontSize: 8,
                        textColor: [51, 65, 85]
                    },
                    columnStyles: {
                        0: { cellWidth: 90 }, // UC
                        1: { cellWidth: 20, halign: 'center' }, // Carga
                        2: { cellWidth: 20, halign: 'center' }, // Progresso
                        3: { cellWidth: 'auto' } // Instrutores
                    },
                    margin: { left: 14, right: 14 },
                    didDrawPage: (data) => {
                        // Se a tabela quebrar página, desenhar o background nas novas páginas
                        if (bgData && data.pageNumber > 1) {
                            doc.addImage(bgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
                        }
                    }
                });

                // @ts-ignore
                finalY = doc.lastAutoTable.finalY + 15; // Espaço após a tabela
            } else {
                // Caso não tenha UCs (curso sem grade cadastrada ou erro)
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text("Nenhuma Unidade Curricular encontrada para este curso.", 18, finalY + 5);
                finalY += 20;
            }
        });

        const fileName = targetClassId
            ? `Relatorio_Turma_${dataToPrint[0].group.name.replace(/\s+/g, '_')}.pdf`
            : `Relatorio_Turmas_Geral.pdf`;

        addPageNumbers(doc, fontData ? 'CustomFont' : 'helvetica');

        doc.save(fileName);
        setIsGenerating(false);
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-500 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Relatórios e Métricas</h2>
                    <p className="text-slate-500 text-sm">Análise de produtividade e progresso temporal dos cursos.</p>
                </div>

                <div className="flex flex-col xl:flex-row gap-4 items-center">
                    {/* Navegação de Abas */}
                    <div className="flex bg-slate-200 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('INSTRUCTORS')}
                            className={`px-6 py-2 rounded-md text-xs font-bold uppercase transition-all ${activeTab === 'INSTRUCTORS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
                        >
                            Instrutores
                        </button>
                        <button
                            onClick={() => setActiveTab('CLASSES')}
                            className={`px-6 py-2 rounded-md text-xs font-bold uppercase transition-all ${activeTab === 'CLASSES' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
                        >
                            Turmas
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {activeTab === 'INSTRUCTORS' && (
                            <>
                                {!isInstructor && (
                                    <>
                                        <div className="relative group">
                                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            <input
                                                type="text"
                                                placeholder="Buscar instrutor..."
                                                value={searchTerm}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none w-40 transition-all shadow-sm"
                                            />
                                        </div>
                                        <select
                                            value={filterArea}
                                            onChange={e => setFilterArea(e.target.value)}
                                            className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm bg-white"
                                        >
                                            <option value="">Todas as Áreas</option>
                                            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                                    </>
                                )}

                                <div className="flex bg-slate-200 p-1 rounded-lg">
                                    {(['MONTH', 'YEAR'] as const).map(p => (
                                        <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${period === p ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>{p === 'MONTH' ? 'Mensal' : 'Anual'}</button>
                                    ))}
                                </div>
                                {!isInstructor && (
                                    <button onClick={generatePDF} disabled={isGenerating} className={`p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-blue-600 shadow-sm transition-all ${isGenerating ? 'opacity-50 cursor-wait' : ''}`} title="Exportar PDF Geral">
                                        {isGenerating ? <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <Icons.Reports />}
                                    </button>
                                )}
                            </>
                        )}

                        {activeTab === 'CLASSES' && (
                            <>
                                <div className="relative group">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    <input
                                        type="text"
                                        placeholder="Buscar turma..."
                                        value={searchClassTerm}
                                        onChange={e => setSearchClassTerm(e.target.value)}
                                        className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none w-40 transition-all shadow-sm"
                                    />
                                </div>
                                <select
                                    value={filterClassArea}
                                    onChange={e => setFilterClassArea(e.target.value)}
                                    className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm bg-white"
                                >
                                    <option value="">Todas as Áreas</option>
                                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>

                                {/* Filtro de Curso */}
                                <select
                                    value={filterClassCourse}
                                    onChange={e => setFilterClassCourse(e.target.value)}
                                    className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm bg-white max-w-[150px]"
                                >
                                    <option value="">Todos os Cursos</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>

                                {/* Filtro de Turno */}
                                <select
                                    value={filterClassShift}
                                    onChange={e => setFilterClassShift(e.target.value)}
                                    className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm bg-white"
                                >
                                    <option value="">Todos os Turnos</option>
                                    {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>

                                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">SAEP:</span>
                                    <select
                                        value={saepFilterMode}
                                        onChange={(e) => setSaepFilterMode(e.target.value as any)}
                                        className="bg-transparent text-xs font-bold text-slate-600 outline-none w-24"
                                    >
                                        <option value="ALL">Todos</option>
                                        <option value="READY">Já Aptas</option>
                                        <option value="BY_DATE">Aptas até...</option>
                                    </select>
                                    {saepFilterMode === 'BY_DATE' && (
                                        <input
                                            type="date"
                                            value={saepDateLimit}
                                            onChange={(e) => setSaepDateLimit(e.target.value)}
                                            className="text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 outline-none text-slate-600"
                                        />
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {/* ABA INSTRUTORES */}
                {activeTab === 'INSTRUCTORS' && (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold text-slate-800">
                                {isInstructor ? "Minha Ocupação" : "Ocupação Real (Dias)"}
                            </h3>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold uppercase">
                                Baseado no Calendário Acadêmico
                            </span>
                        </div>
                        <div className="space-y-8">
                            {instructorOccupancyData.map((inst, index) => (
                                <div key={inst.id} className="space-y-3 border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <img src={inst.photoUrl || `https://picsum.photos/100/100?random=${inst.id}`} className="w-14 h-14 rounded-full border-2 border-slate-100 object-cover shadow-sm" alt={inst.name} />
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-base">{inst.name}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">RE: {inst.re || '-'}</span>
                                                    <span className="text-[9px] text-slate-300 font-bold">•</span>
                                                    <p className="text-xs text-slate-400 font-medium">{inst.area}</p>
                                                    <span className="text-[9px] text-slate-300 font-bold">•</span>
                                                    <p className="text-[9px] text-slate-400">Total de dias letivos: {inst.schoolDays}</p>
                                                    <span className="text-[9px] text-slate-300 font-bold">•</span>
                                                    <p className="text-[9px] text-slate-400">Agendamentos: {inst.eventCount}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <button
                                                onClick={() => generateInstructorPDF(inst)}
                                                className="text-slate-400 hover:text-indigo-600 text-[10px] font-bold uppercase flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors"
                                                title="Baixar Relatório Individual"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                PDF Individual
                                            </button>
                                            <div className="text-right w-16">
                                                <span className="text-lg font-bold text-slate-800">{inst.percentage}%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-inner" style={{ width: `${inst.percentage}%`, backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    </div>
                                </div>
                            ))}
                            {instructorOccupancyData.length === 0 && (
                                <div className="py-12 text-center text-slate-400 italic">
                                    Nenhum instrutor encontrado com os filtros selecionados.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ABA TURMAS */}
                {activeTab === 'CLASSES' && (
                    <div className="space-y-8 animate-in zoom-in-95 duration-200">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                    {isInstructor ? "Progresso e Detalhamento das Minhas Turmas" : "Progresso e Detalhamento das Turmas"}
                                </h3>
                                <button
                                    onClick={() => generateDetailedClassesPDF()}
                                    className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors border border-emerald-100"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Relatório Geral (Todas)
                                </button>
                            </div>
                            <div className="space-y-12">
                                {courseCompletionData.map((item, idx) => {
                                    const report = detailedClassReport[idx];
                                    return (
                                        <div key={item.id} className="border-b border-slate-100 pb-8 last:border-0 last:pb-0">
                                            <div className="mb-6">
                                                <div className="flex justify-between items-end mb-2">
                                                    <div>
                                                        <h4 className="text-lg font-extrabold text-slate-800 tracking-tight leading-tight flex items-center gap-2">
                                                            {item.name}
                                                            <button
                                                                onClick={() => generateDetailedClassesPDF(item.id)}
                                                                className="text-slate-400 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 p-1.5 rounded-lg border border-slate-100 hover:border-emerald-200 transition-all"
                                                                title="Baixar Relatório desta Turma"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                            </button>
                                                        </h4>
                                                        <p className="text-xs text-slate-500 font-medium">{report.courseName}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                                            {item.startDate?.split('-').reverse().join('/')} ➔ {item.endDate?.split('-').reverse().join('/') || 'A definir'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase mb-1 block w-fit ml-auto ${report.status === 'Concluída' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {report.status}
                                                        </span>
                                                        <span className="text-2xl font-black text-slate-900 tabular-nums">{item.completado}%</span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-slate-100 h-4 rounded-full p-0.5 shadow-inner relative overflow-hidden mb-2">
                                                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${item.completado}%`, backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                                </div>

                                                {/* SAEP Status Check (Apenas para Cursos Técnicos) */}
                                                {item.isTechnical && (
                                                    item.rawProgress >= 79.5 ? (
                                                        <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1 animate-pulse">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                            Turma apta para realizar SAEP
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                                                            Turma apta para o SAEP a partir de: <span className="text-indigo-600">{item.saepDate}</span>
                                                        </p>
                                                    )
                                                )}
                                            </div>

                                            {/* Detalhamento Curricular Embutido */}
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                                <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Detalhamento Curricular</h5>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="text-[9px] text-slate-400 uppercase font-bold border-b border-slate-200">
                                                                <th className="pb-2 w-1/3">Unidade Curricular (UC)</th>
                                                                <th className="pb-2 w-1/6 text-center">Progresso UC</th>
                                                                <th className="pb-2 w-1/2">Instrutores Responsáveis</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200">
                                                            {report.ucs.map((uc, ucIdx) => (
                                                                <tr key={ucIdx} className="text-xs text-slate-600">
                                                                    <td className="py-2 pr-2 font-medium">{uc.name}</td>
                                                                    <td className="py-2 text-center">
                                                                        <span className={`font-bold ${uc.progress === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                            {uc.progress}%
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 pl-2 text-[10px] uppercase">
                                                                        {uc.instructors.length > 0 ? uc.instructors.join(', ') : <span className="text-slate-400 italic">Não iniciado</span>}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {report.ucs.length === 0 && (
                                                                <tr><td colSpan={3} className="py-2 text-center text-xs text-slate-400 italic">Nenhuma UC encontrada para este curso.</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {courseCompletionData.length === 0 && (
                                    <div className="py-12 text-center text-slate-400 italic">
                                        Nenhuma turma encontrada com os filtros selecionados.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

export default Reports;
