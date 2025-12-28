
import React from 'react';
import { User, CourseArea, CourseType, Room, Shift, ActivityCategory, TechnicalCompetency, Course, ClassGroup, CourseProject, ScheduleEvent, Workload, SenaiLabResource, SenaiLabUsageType, SenaiLabLog, CalendarCategory, InfoCard, SectionMetadata, DocumentType, LinkType, BackupSettings } from './types';

export const INITIAL_COMPETENCIES: TechnicalCompetency[] = [
  { id: 'c1', name: 'Lógica de Programação' },
  { id: 'c2', name: 'Banco de Dados' },
  { id: 'c3', name: 'Desenvolvimento Web React' },
  { id: 'c4', name: 'Gestão de Pessoas' },
  { id: 'c5', name: 'Contabilidade Básica' },
  { id: 'c6', name: 'Excel Avançado' },
  { id: 'c7', name: 'Desenho Técnico AutoCAD' },
  { id: 'c8', name: 'Usinagem Mecânica' },
];

export const INITIAL_WORKLOADS: Workload[] = [
  { id: 'w1', name: '20 Horas Semanais' },
  { id: 'w2', name: '40 Horas Semanais' },
  { id: 'w3', name: 'Horista' },
];

export const INITIAL_AREAS: CourseArea[] = [
  { id: 'a1', name: 'Informática', color: '#3b82f6' },
  { id: 'a2', name: 'Mecânica', color: '#ef4444' },
  { id: 'a3', name: 'Administração', color: '#f59e0b' },
];

export const INITIAL_PROJECTS: CourseProject[] = [
  { id: 'p1', name: 'Regimental (Gratuidade)' },
  { id: 'p2', name: 'Aprendizagem Industrial' },
  { id: 'p3', name: 'PRONATEC / Bolsa Formação' },
  { id: 'p4', name: 'Pago / Corporativo' },
];

export const INITIAL_USERS: User[] = [
  { 
    id: '1', 
    name: 'Administrador Principal', 
    username: 'admin', 
    password: 'admin',
    role: 'SUPERVISION', 
    status: 'ACTIVE',
    email: 'admin@escola.com',
    phone: '34999999999',
    photoUrl: 'https://picsum.photos/200/200?random=1',
    competencyIds: ['c4'],
    areaId: 'a3',
    workloadId: 'w2'
  },
  { 
    id: '2', 
    name: 'João Silva', 
    username: 'joao', 
    password: 'joao',
    role: 'INSTRUCTOR', 
    status: 'ACTIVE',
    email: 'joao@escola.com',
    phone: '34988888888',
    photoUrl: 'https://picsum.photos/200/200?random=3',
    competencyIds: ['c1', 'c2', 'c3'],
    areaId: 'a1',
    workloadId: 'w2'
  },
  { 
    id: '3', 
    name: 'Maria Santos', 
    username: 'maria', 
    password: 'maria',
    role: 'INSTRUCTOR', 
    status: 'ACTIVE',
    email: 'maria@escola.com',
    phone: '34977777777',
    photoUrl: 'https://picsum.photos/200/200?random=4',
    competencyIds: ['c4', 'c5', 'c6'],
    areaId: 'a3',
    workloadId: 'w1'
  },
];

export const INITIAL_TYPES: CourseType[] = [
  { id: 't1', name: 'Técnico' },
  { id: 't2', name: 'Qualificação Profissional' },
  { id: 't3', name: 'Especialização' },
];

export const INITIAL_COURSES: Course[] = [
  {
    id: 'course-1',
    name: 'Técnico em Desenvolvimento de Sistemas',
    areaId: 'a1',
    typeId: 't1',
    presentialHours: 120,
    eadHours: 40,
    totalClasses: 160,
    subjects: [
      { name: 'Lógica de Programação', hours: 40, competencyIds: ['c1'] },
      { name: 'Banco de Dados SQL', hours: 40, competencyIds: ['c2'] },
      { name: 'Frontend com React', hours: 40, competencyIds: ['c3'] }
    ]
  }
];

export const INITIAL_ROOMS: Room[] = [
  { id: 'r1', name: 'Sala 101', type: 'SALA', block: 'A', capacity: 40, hasTv: true, isActive: true },
  { id: 'r2', name: 'Sala 102', type: 'SALA', block: 'A', capacity: 35, hasTv: false, isActive: true },
  { id: 'r3', name: 'Lab Informática 01', type: 'LABORATORIO', block: 'B', capacity: 25, pcCount: 25, hasTv: true, isActive: true },
  { id: 'r4', name: 'Lab Mecânica 01', type: 'LABORATORIO', block: 'C', capacity: 20, pcCount: 0, hasTv: false, isActive: true },
  { id: 'r5', name: 'Auditório', type: 'SALA', block: 'A', capacity: 100, hasTv: true, isActive: true },
];

export const INITIAL_GROUPS: ClassGroup[] = [
  {
    id: 'group-1',
    name: 'TDS-2024-N-01',
    courseId: 'course-1',
    projectId: 'p1',
    shift: Shift.NOITE,
    roomId: 'r3',
    classesPerDay: 5,
    startDate: '2024-03-01',
    estimatedEndDate: '2024-08-15',
    status: 'ACTIVE',
    lessonSlots: [
      { index: 1, startTime: '18:30', endTime: '19:15' },
      { index: 2, startTime: '19:15', endTime: '20:00' },
      { index: 3, startTime: '20:00', endTime: '20:45' },
      { index: 4, startTime: '21:00', endTime: '21:45' },
      { index: 5, startTime: '21:45', endTime: '22:30' }
    ]
  }
];

export const INITIAL_ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { id: 'aula', name: 'AULA', isSystem: true },
  { id: 'lab_uso', name: 'LAB_USO', isSystem: true },
  { id: 'reuniao', name: 'REUNIÃO', isSystem: false },
  { id: 'atendimento', name: 'ATENDIMENTO EXTERNO', isSystem: false },
  { id: 'afastamento', name: 'AFASTAMENTO', isSystem: false },
  { id: 'compensacao', name: 'COMPENSAÇÃO DE HORAS', isSystem: false },
];

export const INITIAL_EVENTS: ScheduleEvent[] = [
  {
    id: 'ev1',
    type: 'AULA',
    title: 'TDS-2024-N-01',
    subject: 'Lógica de Programação',
    date: new Date().toISOString().split('T')[0],
    shift: Shift.NOITE,
    instructorId: '2',
    roomId: 'r3',
    classGroupId: 'group-1'
  },
  {
    id: 'ev2',
    type: 'LAB_USO',
    title: 'Uso de Laboratório',
    date: new Date().toISOString().split('T')[0],
    shift: Shift.MANHA,
    instructorId: '3',
    roomId: 'r4'
  },
  {
    id: 'ev3',
    type: 'REUNIÃO',
    title: 'Planejamento Pedagógico',
    date: new Date().toISOString().split('T')[0],
    shift: Shift.TARDE,
    instructorId: '1',
    roomId: 'r5'
  }
];

// --- SENAI LAB INITIAL DATA ---

export const INITIAL_SENAI_LAB_RESOURCES: SenaiLabResource[] = [
  { id: 'res1', name: 'Impressora 3D (Bambu Lab)', unit: 'Horas' },
  { id: 'res2', name: 'Impressora 3D (Ender 3)', unit: 'Horas' },
  { id: 'res3', name: 'Corte a Laser', unit: 'Horas' },
  { id: 'res4', name: 'Filamento PLA', unit: 'Gramas' },
  { id: 'res5', name: 'Filamento ABS', unit: 'Gramas' },
  { id: 'res6', name: 'Placa Arduino Uno', unit: 'Unidade' },
];

export const INITIAL_SENAI_LAB_USAGE_TYPES: SenaiLabUsageType[] = [
  { id: 'ut1', name: 'Aula Prática' },
  { id: 'ut2', name: 'Projeto Integrador' },
  { id: 'ut3', name: 'TCC' },
  { id: 'ut4', name: 'Grand Prix / Hackathon' },
  { id: 'ut5', name: 'Projeto Pessoal (Instrutor)' },
  { id: 'ut6', name: 'Manutenção' },
];

export const INITIAL_SENAI_LAB_LOGS: SenaiLabLog[] = [];

// --- ACADEMIC CALENDAR INITIAL CATEGORIES ---
export const INITIAL_CALENDAR_CATEGORIES: CalendarCategory[] = [
  { id: 'HOLIDAY', name: 'Feriado', color: '#ef4444', isSystem: true },
  { id: 'SCHOOL_EVENT', name: 'Evento Escolar', color: '#3b82f6', isSystem: true },
  { id: 'EXAM', name: 'Provas/Exames', color: '#8b5cf6', isSystem: true },
  { id: 'RECESS', name: 'Recesso', color: '#10b981', isSystem: true },
  { id: 'MEETING', name: 'Reunião Pedagógica', color: '#f59e0b', isSystem: true },
];

export const INITIAL_INFO_CARDS: InfoCard[] = [];

export const INITIAL_DOCUMENT_TYPES: DocumentType[] = [
  { id: 'dt1', name: 'Modelo' },
  { id: 'dt2', name: 'Formulário' },
  { id: 'dt3', name: 'Normativa' },
  { id: 'dt4', name: 'Informativo' },
];

export const INITIAL_LINK_TYPES: LinkType[] = [
  { id: 'lt1', name: 'Educacional' },
  { id: 'lt2', name: 'Administrativo' },
  { id: 'lt3', name: 'Ferramenta' },
  { id: 'lt4', name: 'Portal' },
];

export const INITIAL_SECTION_METADATA: SectionMetadata[] = [
  { category: 'SAGA_SENAI', title: 'SAGA SENAI', description: 'Metodologia e diretrizes do Sistema de Aprendizagem.' },
  { category: 'SAGA_PARTNER', title: 'SAGA SENAI Indústria Parceira', description: 'Materiais e links para indústrias parceiras.' },
  { category: 'SAEP', title: 'SAEP', description: 'Sistema de Avaliação da Educação Profissional.' },
  { category: 'DOCUMENTS', title: 'Documentos Gerais', description: 'Modelos, formulários e normativas institucionais.' },
  { category: 'LINKS', title: "Link's Úteis", description: 'Acesso rápido a sistemas e portais externos.' },
];

export const INITIAL_BACKUP_SETTINGS: BackupSettings = {
  autoBackup: false,
  email: '',
  frequency: 'WEEKLY',
  lastBackupDate: null
};

export const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 15.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Book: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  Settings: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Labs: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.594 15.12a2 2 0 00-1.022.547l-2.387 2.387a2 2 0 000 2.828l.172.172a2 2 0 002.828 0l2.387-2.387a2 2 0 011.022-.547l2.387-.477a6 6 0 013.86-.517l.318.158a6 6 0 003.86-.517l2.387 2.477a2 2 0 011.022.547l2.387 2.387a2 2 0 002.828 0l.172-.172a2 2 0 000-2.828l-2.387-2.387z" /></svg>,
  Reports: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  SenaiLab: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>,
};
