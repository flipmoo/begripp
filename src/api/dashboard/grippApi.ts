import axios from 'axios';
import type { 
  GrippProject, 
  GrippDateObject,
  GrippTemplateSet,
  GrippValidFor,
  GrippPhase,
  GrippCompany,
  GrippIdentity,
  GrippEmployeeSimple,
  GrippProjectLine
} from '../../types/gripp';

interface GrippApiResponse<T> {
  response?: T;
  error?: string;
}

// API client voor de dashboard functionaliteit
// Deze client maakt gebruik van de bestaande API server
const dashboardApi = axios.create({
  baseURL: 'http://localhost:3002/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// Debug logging voor requests
dashboardApi.interceptors.request.use(request => {
  console.log('Dashboard API Request:', {
    url: request.url,
    method: request.method,
    headers: request.headers,
    data: request.data
  });
  
  return request;
});

// Debug logging voor responses
dashboardApi.interceptors.response.use(response => {
  console.log('Dashboard API Response:', {
    status: response.status,
    headers: response.headers,
    data: response.data
  });
  
  return response;
}, error => {
  console.error('Dashboard API Error:', error);
  return Promise.reject(error);
});

interface GrippProjectResponse {
  id: number;
  name: string;
  number: number;
  color: string | null;
  archivedon: GrippDateObject | null;
  clientreference: string;
  isbasis: boolean;
  archived: boolean;
  workdeliveraddress: string;
  createdon: GrippDateObject;
  updatedon: GrippDateObject | null;
  searchname: string;
  extendedproperties: Record<string, unknown> | null;
  totalinclvat: string;
  totalexclvat: string;
  startdate: GrippDateObject | null;
  deadline: GrippDateObject | null;
  deliverydate: GrippDateObject | null;
  enddate: GrippDateObject | null;
  addhoursspecification: boolean;
  description: string;
  filesavailableforclient: boolean;
  discr: string;
  templateset: GrippTemplateSet;
  validfor: GrippValidFor | null;
  accountmanager: GrippEmployeeSimple | null;
  phase: GrippPhase;
  company: GrippCompany;
  contact: GrippEmployeeSimple | null;
  identity: GrippIdentity;
  extrapdf1: { id: number; name: string; } | null;
  extrapdf2: { id: number; name: string; } | null;
  umbrellaproject: { id: number; name: string; } | null;
  tags: Array<{ id: number; name: string; searchname: string; }>;
  employees: GrippEmployeeSimple[];
  employees_starred: GrippEmployeeSimple[];
  files: Array<{ id: number; name: string; }>;
  projectlines: GrippProjectLine[];
  viewonlineurl: string;
}

export const transformGrippProject = (project: GrippProjectResponse): GrippProject => {
  // Maak een kopie van het project om te bewerken
  const transformedProject = { ...project };
  
  // Parse projectlines als ze als string zijn opgeslagen
  if (typeof transformedProject.projectlines === 'string') {
    try {
      transformedProject.projectlines = JSON.parse(transformedProject.projectlines);
    } catch (error) {
      console.error('Error parsing projectlines:', error);
      transformedProject.projectlines = [];
    }
  } else if (!Array.isArray(transformedProject.projectlines)) {
    transformedProject.projectlines = [];
  }
  
  // Parse company als het als string is opgeslagen
  if (typeof transformedProject.company === 'string') {
    try {
      transformedProject.company = JSON.parse(transformedProject.company);
    } catch (error) {
      console.error('Error parsing company:', error);
    }
  }
  
  // Parse phase als het als string is opgeslagen
  if (typeof transformedProject.phase === 'string') {
    try {
      transformedProject.phase = JSON.parse(transformedProject.phase);
    } catch (error) {
      console.error('Error parsing phase:', error);
    }
  }
  
  // Parse employees_starred als het als string is opgeslagen
  if (typeof transformedProject.employees_starred === 'string') {
    try {
      transformedProject.employees_starred = JSON.parse(transformedProject.employees_starred);
    } catch (error) {
      console.error('Error parsing employees_starred:', error);
      transformedProject.employees_starred = [];
    }
  } else if (!Array.isArray(transformedProject.employees_starred)) {
    transformedProject.employees_starred = [];
  }
  
  // Parse deadline als het als string is opgeslagen
  if (typeof transformedProject.deadline === 'string') {
    try {
      transformedProject.deadline = JSON.parse(transformedProject.deadline);
    } catch (error) {
      console.error('Error parsing deadline:', error);
      transformedProject.deadline = null;
    }
  }
  
  // Parse startdate als het als string is opgeslagen
  if (typeof transformedProject.startdate === 'string') {
    try {
      transformedProject.startdate = JSON.parse(transformedProject.startdate);
    } catch (error) {
      console.error('Error parsing startdate:', error);
      transformedProject.startdate = null;
    }
  }
  
  // Parse deliverydate als het als string is opgeslagen
  if (typeof transformedProject.deliverydate === 'string') {
    try {
      transformedProject.deliverydate = JSON.parse(transformedProject.deliverydate);
    } catch (error) {
      console.error('Error parsing deliverydate:', error);
      transformedProject.deliverydate = null;
    }
  }
  
  // Parse enddate als het als string is opgeslagen
  if (typeof transformedProject.enddate === 'string') {
    try {
      transformedProject.enddate = JSON.parse(transformedProject.enddate);
    } catch (error) {
      console.error('Error parsing enddate:', error);
      transformedProject.enddate = null;
    }
  }
  
  return transformedProject;
};

/**
 * Test de API verbinding
 */
export const testApiConnection = async (): Promise<boolean> => {
  try {
    const response = await dashboardApi.get('/dashboard/test');
    return response.status === 200;
  } catch (error) {
    console.error('API connection test failed:', error);
    return false;
  }
};

/**
 * Haal actieve projecten op
 */
export async function fetchActiveProjects(): Promise<GrippProject[]> {
  console.log('fetchActiveProjects called');
  try {
    console.log('Making API request to /dashboard/projects/active');
    const response = await dashboardApi.get<GrippApiResponse<GrippProjectResponse[]>>('/dashboard/projects/active');
    
    console.log('API response received:', response.status, response.statusText);
    
    if (response.data.error) {
      console.error('Error fetching active projects:', response.data.error);
      return [];
    }
    
    if (!response.data.response) {
      console.error('No response data for active projects');
      return [];
    }
    
    console.log('Raw projects data:', response.data.response.length, 'projects');
    const transformedProjects = response.data.response.map(transformGrippProject);
    console.log('Transformed projects:', transformedProjects.length, 'projects');
    
    return transformedProjects;
  } catch (error) {
    console.error('Failed to fetch active projects:', error);
    return [];
  }
}

/**
 * Haal project details op
 */
export const fetchProjectDetails = async (projectId: number): Promise<GrippProject | null> => {
  try {
    const response = await dashboardApi.get<GrippApiResponse<GrippProjectResponse>>(`/dashboard/projects/${projectId}`);
    
    if (response.data.error) {
      console.error(`Error fetching project ${projectId}:`, response.data.error);
      return null;
    }
    
    if (!response.data.response) {
      console.error(`No response data for project ${projectId}`);
      return null;
    }
    
    return transformGrippProject(response.data.response);
  } catch (error) {
    console.error(`Failed to fetch project ${projectId}:`, error);
    return null;
  }
};

/**
 * Synchroniseer projecten
 */
export async function syncProjects(): Promise<void> {
  try {
    await dashboardApi.post('/dashboard/sync/projects');
    console.log('Projects synchronized successfully');
  } catch (error) {
    console.error('Failed to synchronize projects:', error);
    throw error;
  }
}

/**
 * Synchroniseer een specifiek project met de Gripp API
 */
export const syncProjectById = async (projectId: number): Promise<GrippProject | null> => {
  try {
    console.log(`Syncing project ${projectId} with Gripp API...`);
    
    // Maak een request om het project te synchroniseren
    const response = await dashboardApi.post<GrippApiResponse<GrippProjectResponse>>('/gripp/sync-project', { 
      projectId 
    });
    
    if (response.data.error) {
      console.error('Error syncing project:', response.data.error);
      return null;
    }
    
    if (!response.data.response) {
      console.error('No project data returned from sync');
      return null;
    }
    
    // Transformeer het project naar het juiste formaat
    const project = transformGrippProject(response.data.response);
    
    console.log('Project synced successfully:', project.id);
    return project;
  } catch (error) {
    console.error(`Error syncing project ${projectId}:`, error);
    return null;
  }
}; 