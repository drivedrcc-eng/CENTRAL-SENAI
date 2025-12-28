import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User, CourseArea, CourseType, Course, Room,
  ClassGroup, ScheduleEvent, ActivityCategory, TechnicalCompetency, CourseProject, Workload, Holiday, CalendarEvent,
  SenaiLabResource, SenaiLabUsageType, SenaiLabLog, CalendarCategory, InfoCard, InfoCategory, SectionMetadata, DocumentType, LinkType, BackupSettings
} from './types';
import {
  INITIAL_USERS, INITIAL_AREAS,
  INITIAL_TYPES, INITIAL_ROOMS,
  INITIAL_ACTIVITY_CATEGORIES,
  INITIAL_COMPETENCIES,
  INITIAL_COURSES,
  INITIAL_GROUPS,
  INITIAL_PROJECTS,
  INITIAL_EVENTS,
  INITIAL_WORKLOADS,
  INITIAL_SENAI_LAB_RESOURCES,
  INITIAL_SENAI_LAB_USAGE_TYPES,
  INITIAL_SENAI_LAB_LOGS,
  INITIAL_CALENDAR_CATEGORIES,
  INITIAL_INFO_CARDS,
  INITIAL_SECTION_METADATA,
  INITIAL_DOCUMENT_TYPES,
  INITIAL_LINK_TYPES,
  INITIAL_BACKUP_SETTINGS
} from './constants';

// Dados iniciais de calendário (exemplo)
const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'h1', date: '2024-01-01', title: 'Confraternização Universal', type: 'HOLIDAY', isDayOff: true, color: '#ef4444' },
  { id: 'h2', date: '2024-02-13', title: 'Carnaval', type: 'HOLIDAY', isDayOff: true, color: '#ef4444' },
  { id: 'e1', date: '2024-02-01', title: 'Início das Aulas', type: 'SCHOOL_EVENT', isDayOff: false, color: '#3b82f6' },
  { id: 'h3', date: '2024-12-25', title: 'Natal', type: 'HOLIDAY', isDayOff: true, color: '#ef4444' },
];

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  updateUser: (user: User) => void; // Nova função para atualizar usuário individualmente
  areas: CourseArea[];
  setAreas: React.Dispatch<React.SetStateAction<CourseArea[]>>;
  types: CourseType[];
  setTypes: React.Dispatch<React.SetStateAction<CourseType[]>>;
  projects: CourseProject[];
  setProjects: React.Dispatch<React.SetStateAction<CourseProject[]>>;
  workloads: Workload[];
  setWorkloads: React.Dispatch<React.SetStateAction<Workload[]>>;
  activityCategories: ActivityCategory[];
  setActivityCategories: React.Dispatch<React.SetStateAction<ActivityCategory[]>>;
  technicalCompetencies: TechnicalCompetency[];
  setTechnicalCompetencies: React.Dispatch<React.SetStateAction<TechnicalCompetency[]>>;
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  groups: ClassGroup[];
  setGroups: React.Dispatch<React.SetStateAction<ClassGroup[]>>;
  events: ScheduleEvent[];
  setEvents: React.Dispatch<React.SetStateAction<ScheduleEvent[]>>;

  // Novo sistema de calendário
  calendarEvents: CalendarEvent[];
  setCalendarEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  calendarCategories: CalendarCategory[];
  setCalendarCategories: React.Dispatch<React.SetStateAction<CalendarCategory[]>>;

  // SENAI Lab
  senaiLabResources: SenaiLabResource[];
  setSenaiLabResources: React.Dispatch<React.SetStateAction<SenaiLabResource[]>>;
  senaiLabUsageTypes: SenaiLabUsageType[];
  setSenaiLabUsageTypes: React.Dispatch<React.SetStateAction<SenaiLabUsageType[]>>;
  senaiLabLogs: SenaiLabLog[];
  setSenaiLabLogs: React.Dispatch<React.SetStateAction<SenaiLabLog[]>>;
  senaiLabModelUrl: string;
  setSenaiLabModelUrl: React.Dispatch<React.SetStateAction<string>>;

  // Lab Configurations
  labBookingLimit: number;
  setLabBookingLimit: React.Dispatch<React.SetStateAction<number>>;

  // Info Cards
  infoCards: InfoCard[];
  setInfoCards: React.Dispatch<React.SetStateAction<InfoCard[]>>;
  documentTypes: DocumentType[];
  setDocumentTypes: React.Dispatch<React.SetStateAction<DocumentType[]>>;
  linkTypes: LinkType[];
  setLinkTypes: React.Dispatch<React.SetStateAction<LinkType[]>>;

  // Page Metadata
  sectionMetadata: SectionMetadata[];
  setSectionMetadata: React.Dispatch<React.SetStateAction<SectionMetadata[]>>;
  updateSectionMetadata: (category: InfoCategory, title: string, description: string) => void;
  getSectionMetadata: (category: InfoCategory) => SectionMetadata | undefined;

  // Backward compatibility
  holidays: Holiday[];
  setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;

  // Customization
  customLoginBg: string | null;
  setCustomLoginBg: React.Dispatch<React.SetStateAction<string | null>>;
  appBackground: string | null; // Novo: Fundo geral do app
  setAppBackground: React.Dispatch<React.SetStateAction<string | null>>;
  customLogo: string | null;
  setCustomLogo: React.Dispatch<React.SetStateAction<string | null>>;

  // PDF Customization
  customFont: string | null; // Base64 Content (sem header)
  setCustomFont: React.Dispatch<React.SetStateAction<string | null>>;
  reportBackground: string | null; // Base64 Image
  setReportBackground: React.Dispatch<React.SetStateAction<string | null>>;

  // Backup Settings
  backupSettings: BackupSettings;
  setBackupSettings: React.Dispatch<React.SetStateAction<BackupSettings>>;
  exportData: () => void;
  importData: (jsonStr: string) => boolean;

  addEvent: (event: Omit<ScheduleEvent, 'id'>) => boolean;
  updateEvent: (event: ScheduleEvent) => boolean;
  deleteEvent: (id: string) => void;
  getCalendarEvent: (date: string) => CalendarEvent | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [areas, setAreas] = useState<CourseArea[]>(INITIAL_AREAS);
  const [types, setTypes] = useState<CourseType[]>(INITIAL_TYPES);
  const [projects, setProjects] = useState<CourseProject[]>(INITIAL_PROJECTS);
  const [workloads, setWorkloads] = useState<Workload[]>(INITIAL_WORKLOADS);
  const [activityCategories, setActivityCategories] = useState<ActivityCategory[]>(INITIAL_ACTIVITY_CATEGORIES);
  const [technicalCompetencies, setTechnicalCompetencies] = useState<TechnicalCompetency[]>(INITIAL_COMPETENCIES);
  const [courses, setCourses] = useState<Course[]>(INITIAL_COURSES);
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [groups, setGroups] = useState<ClassGroup[]>(INITIAL_GROUPS);
  const [events, setEvents] = useState<ScheduleEvent[]>(INITIAL_EVENTS);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(INITIAL_CALENDAR_EVENTS);
  const [calendarCategories, setCalendarCategories] = useState<CalendarCategory[]>(INITIAL_CALENDAR_CATEGORIES);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // SENAI Lab States
  const [senaiLabResources, setSenaiLabResources] = useState<SenaiLabResource[]>(INITIAL_SENAI_LAB_RESOURCES);
  const [senaiLabUsageTypes, setSenaiLabUsageTypes] = useState<SenaiLabUsageType[]>(INITIAL_SENAI_LAB_USAGE_TYPES);
  const [senaiLabLogs, setSenaiLabLogs] = useState<SenaiLabLog[]>(INITIAL_SENAI_LAB_LOGS);
  const [senaiLabModelUrl, setSenaiLabModelUrl] = useState<string>('');

  // Lab Configuration State (Default 5 days for instructors)
  const [labBookingLimit, setLabBookingLimit] = useState<number>(5);

  // Info Cards
  const [infoCards, setInfoCards] = useState<InfoCard[]>(INITIAL_INFO_CARDS);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>(INITIAL_DOCUMENT_TYPES);
  const [linkTypes, setLinkTypes] = useState<LinkType[]>(INITIAL_LINK_TYPES);
  const [sectionMetadata, setSectionMetadata] = useState<SectionMetadata[]>(INITIAL_SECTION_METADATA);

  // Customization
  const [customLoginBg, setCustomLoginBg] = useState<string | null>(null);
  const [appBackground, setAppBackground] = useState<string | null>(null);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [customFont, setCustomFont] = useState<string | null>(null);
  const [reportBackground, setReportBackground] = useState<string | null>(null);

  // Backup
  const [backupSettings, setBackupSettings] = useState<BackupSettings>(INITIAL_BACKUP_SETTINGS);

  const [isLoaded, setIsLoaded] = useState(false);

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('edusched_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.users) {
          const loadedUsers = data.users;
          const adminExists = loadedUsers.some((u: User) => u.username === 'admin');
          if (!adminExists) {
            const defaultAdmin = INITIAL_USERS.find(u => u.username === 'admin');
            if (defaultAdmin) loadedUsers.unshift(defaultAdmin);
          }
          setUsers(loadedUsers);
        }
        if (data.areas) setAreas(data.areas);
        if (data.types) setTypes(data.types);
        if (data.projects) setProjects(data.projects);
        if (data.workloads) setWorkloads(data.workloads);
        if (data.activityCategories) setActivityCategories(data.activityCategories);
        if (data.technicalCompetencies) setTechnicalCompetencies(data.technicalCompetencies);
        if (data.courses) setCourses(data.courses);
        if (data.groups) setGroups(data.groups);
        if (data.rooms) setRooms(data.rooms);
        if (data.events) setEvents(data.events);
        if (data.calendarEvents) setCalendarEvents(data.calendarEvents);
        if (data.calendarCategories) setCalendarCategories(data.calendarCategories);
        if (data.customLoginBg) setCustomLoginBg(data.customLoginBg);
        if (data.appBackground) setAppBackground(data.appBackground);
        if (data.customLogo) setCustomLogo(data.customLogo);
        if (data.customFont) setCustomFont(data.customFont);
        if (data.reportBackground) setReportBackground(data.reportBackground);

        // Load SENAI Lab Data
        if (data.senaiLabResources) setSenaiLabResources(data.senaiLabResources);
        if (data.senaiLabUsageTypes) setSenaiLabUsageTypes(data.senaiLabUsageTypes);
        if (data.senaiLabLogs) setSenaiLabLogs(data.senaiLabLogs);
        if (data.senaiLabModelUrl) setSenaiLabModelUrl(data.senaiLabModelUrl);
        if (data.labBookingLimit) setLabBookingLimit(data.labBookingLimit);

        // Load Info Cards
        if (data.infoCards) setInfoCards(data.infoCards);
        if (data.documentTypes) setDocumentTypes(data.documentTypes);
        if (data.linkTypes) setLinkTypes(data.linkTypes);
        if (data.sectionMetadata) setSectionMetadata(data.sectionMetadata);

        // Backup Settings
        if (data.backupSettings) setBackupSettings(data.backupSettings);

      } catch (e) {
        console.error("Erro ao processar dados do localStorage", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Supabase Auth Integration
  useEffect(() => {
    import('./supabaseClient').then(({ supabase }) => {
      // Check active session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const mappedUser: User = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
            username: session.user.user_metadata.username || session.user.email?.split('@')[0] || 'user',
            role: session.user.user_metadata.role || 'INSTRUCTOR',
            status: 'ACTIVE', // Supabase authenticated means active for now
            photoUrl: session.user.user_metadata.photoUrl,
            phone: session.user.user_metadata.phone,
            areaId: session.user.user_metadata.areaId,
            workloadId: session.user.user_metadata.workloadId,
            re: session.user.user_metadata.re,
            googleEmail: session.user.user_metadata.googleEmail,
            competencyIds: session.user.user_metadata.competencyIds || [],
            lastLogin: new Date().toISOString()
          };
          setCurrentUser(mappedUser);
        }
      });

      // Listen for changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const mappedUser: User = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata.name || session.user.email?.split('@')[0] || 'User',
            username: session.user.user_metadata.username || session.user.email?.split('@')[0] || 'user',
            role: session.user.user_metadata.role || 'INSTRUCTOR',
            status: 'ACTIVE',
            photoUrl: session.user.user_metadata.photoUrl,
            phone: session.user.user_metadata.phone,
            areaId: session.user.user_metadata.areaId,
            workloadId: session.user.user_metadata.workloadId,
            re: session.user.user_metadata.re,
            googleEmail: session.user.user_metadata.googleEmail,
            competencyIds: session.user.user_metadata.competencyIds || [],
            lastLogin: new Date().toISOString()
          };
          setCurrentUser(mappedUser);
        } else {
          setCurrentUser(null);
        }
      });
      return () => subscription.unsubscribe();
    });
  }, []);

  // Save to LocalStorage Effect
  useEffect(() => {
    if (isLoaded) {
      const dataToSave = {
        users, areas, types, projects, workloads,
        activityCategories, technicalCompetencies,
        courses, rooms, groups, events, calendarEvents, calendarCategories,
        customLoginBg, appBackground, customLogo, customFont, reportBackground,
        senaiLabResources, senaiLabUsageTypes, senaiLabLogs, senaiLabModelUrl, labBookingLimit,
        infoCards, documentTypes, linkTypes, sectionMetadata,
        backupSettings
      };
      try {
        localStorage.setItem('edusched_data', JSON.stringify(dataToSave));
      } catch (e) {
        console.error("Erro ao salvar no localStorage", e);
      }
    }
  }, [
    isLoaded, users, areas, types, projects, workloads, activityCategories, technicalCompetencies,
    courses, rooms, groups, events, calendarEvents, calendarCategories, customLoginBg, appBackground, customLogo, customFont, reportBackground,
    senaiLabResources, senaiLabUsageTypes, senaiLabLogs, senaiLabModelUrl, labBookingLimit,
    infoCards, documentTypes, linkTypes, sectionMetadata, backupSettings
  ]);

  // AUTOMATIC BACKUP SIMULATION
  useEffect(() => {
    if (isLoaded && backupSettings.autoBackup && backupSettings.email) {
      const checkAndTriggerBackup = () => {
        const last = backupSettings.lastBackupDate ? new Date(backupSettings.lastBackupDate) : null;
        const now = new Date();
        let shouldBackup = false;

        if (!last) {
          shouldBackup = true;
        } else {
          const diffTime = Math.abs(now.getTime() - last.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (backupSettings.frequency === 'DAILY' && diffDays >= 1) shouldBackup = true;
          if (backupSettings.frequency === 'WEEKLY' && diffDays >= 7) shouldBackup = true;
          if (backupSettings.frequency === 'MONTHLY' && diffDays >= 30) shouldBackup = true;
        }

        if (shouldBackup) {
          console.log(`[SYSTEM] Iniciando backup automático para ${backupSettings.email}...`);
          // Simula o envio
          setTimeout(() => {
            // Atualiza a data do último backup
            setBackupSettings(prev => ({ ...prev, lastBackupDate: new Date().toISOString() }));
            // alert(`[SIMULAÇÃO] Backup automático enviado com sucesso para: ${backupSettings.email}`);
          }, 3000); // Delay simulado
        }
      };

      // Check on load
      checkAndTriggerBackup();
    }
  }, [isLoaded, backupSettings]); // Depende do settings

  const exportData = () => {
    const dataToSave = {
      users, areas, types, projects, workloads,
      activityCategories, technicalCompetencies,
      courses, rooms, groups, events, calendarEvents, calendarCategories,
      customLoginBg, appBackground, customLogo, customFont, reportBackground,
      senaiLabResources, senaiLabUsageTypes, senaiLabLogs, senaiLabModelUrl, labBookingLimit,
      infoCards, documentTypes, linkTypes, sectionMetadata, backupSettings
    };

    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_edusched_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.users || !data.events) {
        alert("Arquivo de backup inválido ou corrompido.");
        return false;
      }

      if (window.confirm("ATENÇÃO: Importar um backup substituirá TODOS os dados atuais. Deseja continuar?")) {
        if (data.users) setUsers(data.users);
        if (data.areas) setAreas(data.areas);
        if (data.types) setTypes(data.types);
        if (data.projects) setProjects(data.projects);
        if (data.workloads) setWorkloads(data.workloads);
        if (data.activityCategories) setActivityCategories(data.activityCategories);
        if (data.technicalCompetencies) setTechnicalCompetencies(data.technicalCompetencies);
        if (data.courses) setCourses(data.courses);
        if (data.groups) setGroups(data.groups);
        if (data.rooms) setRooms(data.rooms);
        if (data.events) setEvents(data.events);
        if (data.calendarEvents) setCalendarEvents(data.calendarEvents);
        if (data.calendarCategories) setCalendarCategories(data.calendarCategories);
        if (data.customLoginBg) setCustomLoginBg(data.customLoginBg);
        if (data.appBackground) setAppBackground(data.appBackground);
        if (data.customLogo) setCustomLogo(data.customLogo);
        if (data.customFont) setCustomFont(data.customFont);
        if (data.reportBackground) setReportBackground(data.reportBackground);
        if (data.senaiLabResources) setSenaiLabResources(data.senaiLabResources);
        if (data.senaiLabUsageTypes) setSenaiLabUsageTypes(data.senaiLabUsageTypes);
        if (data.senaiLabLogs) setSenaiLabLogs(data.senaiLabLogs);
        if (data.senaiLabModelUrl) setSenaiLabModelUrl(data.senaiLabModelUrl);
        if (data.labBookingLimit) setLabBookingLimit(data.labBookingLimit);
        if (data.infoCards) setInfoCards(data.infoCards);
        if (data.documentTypes) setDocumentTypes(data.documentTypes);
        if (data.linkTypes) setLinkTypes(data.linkTypes);
        if (data.sectionMetadata) setSectionMetadata(data.sectionMetadata);
        if (data.backupSettings) setBackupSettings(data.backupSettings);

        alert("Backup restaurado com sucesso! As configurações visuais foram aplicadas.");
        return true;
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao ler o arquivo. Verifique o formato JSON.");
    }
    return false;
  };

  const getCalendarEvent = (date: string) => {
    return calendarEvents.find(e => e.date === date);
  };

  const checkConflicts = (newEvent: Omit<ScheduleEvent, 'id'>, excludeId?: string) => {
    const calEvent = getCalendarEvent(newEvent.date);
    if (calEvent && calEvent.isDayOff) return "HOLIDAY";

    const conflict = events.some(e => {
      if (excludeId && String(e.id) === String(excludeId)) return false;

      if (e.date === newEvent.date && e.shift === newEvent.shift) {
        if (e.instructorId === newEvent.instructorId) return true;
        if (e.roomId === newEvent.roomId) return true;
        if (newEvent.classGroupId && e.classGroupId === newEvent.classGroupId) return true;
      }
      return false;
    });

    return conflict ? "CONFLICT" : null;
  };

  const addEvent = (event: Omit<ScheduleEvent, 'id'>) => {
    const error = checkConflicts(event);
    if (error === "HOLIDAY") {
      const h = getCalendarEvent(event.date);
      alert(`Bloqueio: ${event.date.split('-').reverse().join('/')} é dia não letivo (${h?.title}).`);
      return false;
    }
    if (error === "CONFLICT") {
      alert("Erro: Conflito de agenda! O instrutor, sala ou turma já possui atividade neste turno.");
      return false;
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    // Injeta metadados de criação
    const newEvent = {
      ...event,
      id,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.role || 'SYSTEM'
    };

    setEvents(prev => [...prev, newEvent]);
    return true;
  };

  const updateEvent = (event: ScheduleEvent) => {
    const error = checkConflicts(event, event.id);
    if (error) {
      alert(error === "HOLIDAY" ? "Data bloqueada no Calendário Acadêmico." : "Conflito detectado na alteração!");
      return false;
    }
    setEvents(prev => prev.map(e => String(e.id) === String(event.id) ? event : e));
    return true;
  };

  const deleteEvent = (id: string) => {
    if (!id) return;
    setEvents(prev => prev.filter(e => String(e.id) !== String(id)));
  };

  const updateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const updateSectionMetadata = (category: InfoCategory, title: string, description: string) => {
    setSectionMetadata(prev => {
      const index = prev.findIndex(m => m.category === category);
      if (index >= 0) {
        const newMeta = [...prev];
        newMeta[index] = { category, title, description };
        return newMeta;
      }
      return [...prev, { category, title, description }];
    });
  };

  const getSectionMetadata = (category: InfoCategory) => {
    return sectionMetadata.find(m => m.category === category) || INITIAL_SECTION_METADATA.find(m => m.category === category);
  };

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, users, setUsers, updateUser, areas, setAreas, types, setTypes,
      projects, setProjects, workloads, setWorkloads,
      activityCategories, setActivityCategories, technicalCompetencies, setTechnicalCompetencies,
      courses, setCourses, rooms, setRooms, groups, setGroups,
      events, setEvents,
      calendarEvents, setCalendarEvents,
      calendarCategories, setCalendarCategories,
      holidays, setHolidays,
      customLoginBg, setCustomLoginBg,
      appBackground, setAppBackground,
      customLogo, setCustomLogo,
      customFont, setCustomFont,
      reportBackground, setReportBackground,
      senaiLabResources, setSenaiLabResources,
      senaiLabUsageTypes, setSenaiLabUsageTypes,
      senaiLabLogs, setSenaiLabLogs, senaiLabModelUrl, setSenaiLabModelUrl,
      labBookingLimit, setLabBookingLimit,
      infoCards, setInfoCards, documentTypes, setDocumentTypes, linkTypes, setLinkTypes,
      sectionMetadata, setSectionMetadata, updateSectionMetadata, getSectionMetadata,
      backupSettings, setBackupSettings, exportData, importData,
      addEvent, updateEvent, deleteEvent, getCalendarEvent
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};