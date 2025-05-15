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

// Interface voor factuurgegevens
interface GrippInvoiceResponse {
  id: number;
  searchname: string;
  company: {
    id: number;
    searchname: string;
    discr: string;
  };
  createdon: GrippDateObject;
  status: {
    id: number;
    searchname: string;
  };
  totalexclvat: string;
  duedate?: GrippDateObject;
  paymentdate?: GrippDateObject;
  invoicelines?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
}

// Interface voor API response van het invoices endpoint
interface InvoiceApiResponse {
  result?: {
    items: GrippInvoiceResponse[];
    count?: number;
    start?: number;
    limit?: number;
    more_items_in_collection?: boolean;
    next_start?: number;
  };
  error?: string;
}

// API client voor de dashboard functionaliteit
// Deze client maakt gebruik van de unified data structure API server
import { API_BASE_URL } from '../../config/api';

const dashboardApi = axios.create({
  baseURL: API_BASE_URL,
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

  // Handle phase field - don't try to parse if it's a simple string like "Planning"
  if (typeof transformedProject.phase === 'string') {
    try {
      // Check if the string looks like JSON (starts with { or [)
      if (transformedProject.phase.trim().startsWith('{') ||
          transformedProject.phase.trim().startsWith('[')) {
        transformedProject.phase = JSON.parse(transformedProject.phase);
      }
      // Otherwise keep it as a string
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
 * Check if a project has "Vaste prijs" tag
 */
const filterByFixedPriceTag = (project: any) => {
  if (!project.tags) return false;

  // Als tags een string is (JSON formaat), probeer te parsen
  if (typeof project.tags === 'string') {
    try {
      const parsedTags = JSON.parse(project.tags);
      return parsedTags.some((tag: { searchname?: string; name?: string }) =>
        (tag.searchname === "Vaste prijs") || (tag.name === "Vaste prijs")
      );
    } catch (error) {
      console.error('Error parsing tags JSON:', error);
      return false;
    }
  }
  // Als tags een array is, gebruik direct
  else if (Array.isArray(project.tags)) {
    return project.tags.some((tag: any) => {
      if (typeof tag === 'string') return tag === "Vaste prijs";
      return (tag.searchname === "Vaste prijs") || (tag.name === "Vaste prijs");
    });
  }
  return false;
};

/**
 * Haal actieve projecten op van de API
 */
export const fetchActiveProjects = async (queryParams = ''): Promise<GrippProject[]> => {
  try {
    console.log(`Fetching active projects with params: ${queryParams}`);

    // Add a timestamp to prevent caching
    const timestamp = Date.now();

    // Use the unified data structure endpoint
    const url = `/v1/projects?archived=false${queryParams ? '&' + queryParams : ''}${
      queryParams.includes('?') ? '&' : '&'
    }_t=${timestamp}`;

    const response = await dashboardApi.get(url);

    if (!response.data) {
      throw new Error('No data received from API');
    }

    // Check if the response has the expected structure (unified data structure)
    if (response.data.success && response.data.data) {
      console.log(`Received ${response.data.data.length} active projects from unified API`);
      return response.data.data;
    }
    // Fallback for backward compatibility
    else if (response.data.response) {
      console.log(`Received ${response.data.response.length} active projects from legacy API`);
      return response.data.response.map(transformGrippProject);
    } else {
      console.error('Unexpected API response structure:', response.data);
      throw new Error('Unexpected API response structure');
    }
  } catch (error) {
    console.error('Error fetching active projects:', error);
    throw error;
  }
};

/**
 * Haal project details op
 */
export const fetchProjectDetails = async (projectId: number): Promise<GrippProject | null> => {
  try {
    // Use the unified data structure endpoint
    const response = await dashboardApi.get(`/v1/projects/${projectId}`);

    if (!response.data) {
      console.error(`No data received for project ${projectId}`);
      return null;
    }

    // Check if the response has the expected structure (unified data structure)
    if (response.data.success && response.data.data) {
      console.log(`Received project details for project ${projectId} from unified API`);
      return response.data.data;
    }
    // Fallback for backward compatibility
    else if (response.data.response) {
      console.log(`Received project details for project ${projectId} from legacy API`);
      return transformGrippProject(response.data.response);
    } else {
      console.error('Unexpected API response structure:', response.data);
      return null;
    }
  } catch (error) {
    console.error(`Failed to fetch project ${projectId}:`, error);
    return null;
  }
};

// Synchroniseer projecten van Gripp API
export const syncProjects = async (): Promise<void> => {
  console.log('Starting syncProjects');
  try {
    // Eerst de projecten opschonen
    console.log('Cleaning projects before sync...');
    try {
      const cleanResponse = await dashboardApi.post(`/v1/iris/clean/projects`, {
        force: true
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      console.log('Projects cleaned successfully:', cleanResponse.data);

      // Wacht even om er zeker van te zijn dat de opschoning is voltooid
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (cleanError) {
      console.error('Failed to clean projects:', cleanError);
      // Ga door met synchroniseren, zelfs als opschonen mislukt
    }

    // Force a true refresh by adding a cache-busting parameter
    const timestamp = new Date().getTime();

    // Use the correct endpoint for project synchronization
    const response = await dashboardApi.post(`/v1/iris/sync/projects?_force=true&_t=${timestamp}`, {
      force: true
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    if (!response.data) {
      throw new Error('No data received from API');
    }

    console.log('syncProjects completed successfully with response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to sync projects:', error);
    throw error;
  }
}

/**
 * Synchroniseer een specifiek project met de Gripp API
 */
export const syncProjectById = async (projectId: number): Promise<GrippProject | null> => {
  try {
    console.log(`Syncing project ${projectId} with Gripp API...`);

    // Use the correct endpoint for project synchronization
    const response = await dashboardApi.post(`/v1/iris/sync/projects/${projectId}`, {
      force: true
    });

    if (!response.data) {
      console.error(`No data received for project sync ${projectId}`);
      return null;
    }

    // Check if the response has the expected structure (unified data structure)
    if (response.data.success && response.data.data) {
      console.log(`Project ${projectId} synced successfully from unified API`);
      return response.data.data;
    }
    // Fallback for backward compatibility
    else if (response.data.response) {
      console.log(`Project ${projectId} synced successfully from legacy API`);
      return transformGrippProject(response.data.response);
    } else {
      console.error('Unexpected API response structure:', response.data);
      return null;
    }
  } catch (error) {
    console.error(`Error syncing project ${projectId}:`, error);
    return null;
  }
};

export const fetchInvoices = async () => {
  try {
    // Use the unified data structure endpoint
    console.log('Fetching invoices from unified API using endpoint: /v1/invoices');

    const response = await dashboardApi.get('/v1/invoices');

    if (!response.data) {
      console.error('No data received from API');
      return [];
    }

    // Check if the response has the expected structure (unified data structure)
    if (response.data.success && response.data.data) {
      console.log(`Received ${response.data.data.length} invoices from unified API`);
      return response.data.data;
    }
    // Fallback for backward compatibility
    else if (response.data.response) {
      console.log(`Received ${response.data.response.length} invoices from legacy API`);
      return response.data.response;
    } else {
      // If no data is available, log error and return empty array
      console.error('No invoice data available from API');
      return [];
    }
  } catch (error) {
    console.error('Error in fetchInvoices:', error);
    // Return an empty array instead of throwing the error
    // to prevent the UI from crashing
    return [];
  }
};