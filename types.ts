
export type Role = 'SUPERVISION' | 'INSTRUCTOR';
export type UserStatus = 'PENDING' | 'ACTIVE';

export interface TechnicalCompetency {
  id: string;
  name: string;
}

export interface Workload {
  id: string;
  name: string;
}

// Alterado para string para permitir tipos dinâmicos criados pelo usuário
export type CalendarEventType = string;

export interface CalendarCategory {
  id: string;
  name: string;
  color: string;
  isSystem?: boolean; // Se true, impede exclusão (opcional)
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: CalendarEventType;
  isDayOff: boolean; // Se é dia não letivo
  color?: string;
}

// Mantido para compatibilidade, mas mapeado internamente para CalendarEvent
export interface Holiday {
  date: string; 
  name: string;
  type: 'NATIONAL' | 'CUSTOM';
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: Role;
  status?: UserStatus; 
  photoUrl?: string;
  email?: string;
  phone?: string;
  competencyIds?: string[]; 
  areaId?: string; 
  workloadId?: string; 
  re?: string; // Alterado de ra para re
  googleEmail?: string;
  lastLogin?: string; // Novo campo: ISO String da data do último login
}

export enum Shift {
  MANHA = 'MANHA',
  TARDE = 'TARDE',
  NOITE = 'NOITE'
}

export const ShiftTimes: Record<Shift, { start: string, end: string }> = {
  [Shift.MANHA]: { start: '07:30', end: '11:30' },
  [Shift.TARDE]: { start: '13:30', end: '17:30' },
  [Shift.NOITE]: { start: '18:30', end: '22:30' }
};

export interface LessonSlot {
  index: number;
  startTime: string;
  endTime: string;
}

export interface CourseArea {
  id: string;
  name: string;
  color?: string;
}

export interface CourseType {
  id: string;
  name: string;
}

export interface CourseProject {
  id: string;
  name: string;
}

export interface ActivityCategory {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface SubjectInfo {
  name: string;
  hours: number;
  competencyIds: string[]; 
}

export interface Course {
  id: string;
  name: string;
  areaId: string;
  typeId: string;
  presentialHours: number;
  eadHours: number;
  totalClasses: number;
  subjects: SubjectInfo[]; 
  coursePlan?: string; // Base64 string do PDF do Plano de Curso
}

export interface Room {
  id: string;
  name: string;
  type: 'SALA' | 'LABORATORIO';
  isActive: boolean;
  block?: string;
  capacity?: number;
  pcCount?: number; // Quantidade de computadores
  hasTv?: boolean;  // Possui TV
}

export interface ClassGroup {
  id: string;
  name: string;
  courseId: string;
  projectId: string; 
  shift: Shift;
  roomId: string;
  classesPerDay: number; 
  lessonSlots: LessonSlot[]; 
  startDate: string; 
  estimatedEndDate: string; 
  weekDays?: number[]; // 0 = Domingo, 1 = Segunda, ...
  status?: 'ACTIVE' | 'CONCLUDED'; // Novo campo
  classCalendar?: string; // Base64 string do PDF do Calendário da Turma
}

export type ActivityType = string;

export interface ScheduleEvent {
  id: string;
  type: ActivityType;
  title: string;
  date: string;
  shift: Shift;
  instructorId: string; 
  classGroupId?: string;
  roomId: string;
  subject?: string;
  createdAt?: string; // Novo campo: Data de criação
  createdBy?: string; // Novo campo: Role de quem criou (SUPERVISION ou INSTRUCTOR)
}

// --- SENAI LAB TYPES ---

export interface SenaiLabResource {
  id: string;
  name: string;
  unit: string; // ex: 'Horas', 'Gramas', 'Unidades'
}

export interface SenaiLabUsageType {
  id: string;
  name: string; // ex: 'Aula Prática', 'TCC', 'Projeto Integrador'
}

export interface SenaiLabLog {
  id: string;
  date: string;
  shift: Shift; 
  instructorId: string;
  resourceId: string;
  usageTypeId: string;
  quantity: number;
  description?: string;
  authorizedBy: string; // New field: Quem autorizou
  createdAt: string;
}

// --- INFO CARDS TYPES ---
export type InfoCategory = 'SAGA_SENAI' | 'SAGA_PARTNER' | 'SAEP' | 'DOCUMENTS' | 'LINKS';

export interface DocumentType {
  id: string;
  name: string;
}

export interface LinkType {
  id: string;
  name: string;
}

export interface InfoCard {
  id: string;
  category: InfoCategory;
  title: string;
  description: string;
  imageUrl?: string; // Base64 da imagem/icone
  externalLink?: string;
  fileUrl?: string; // Base64 do arquivo
  fileName?: string;
  documentTypeId?: string; // Para a aba de Documentos
  linkTypeId?: string; // Para a aba de Links
  createdAt: string;
}

export interface SectionMetadata {
  category: InfoCategory;
  title: string;
  description: string;
}

export interface BackupSettings {
  autoBackup: boolean;
  email: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  lastBackupDate: string | null;
}
