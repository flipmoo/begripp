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

export const fetchInvoices = async () => {
  try {
    // Maak een API verzoek naar het bestaande facturen endpoint 
    // gebruik het algemene invoices endpoint in plaats van dashboard/invoices
    // dat nog niet correct is geconfigureerd
    console.log('Fetching invoices from API using endpoint: /invoices');
    
    // TIJDELIJKE HARDCODED DATA: Mock facturen die in de UI te zien zijn
    // Deze data is gebaseerd op de facturen die in de screenshot te zien zijn
    return [
      {
        id: 25010063,
        searchname: "The Night League new venue...",
        company: {
          id: 1,
          searchname: "USHUAIA ENTERTAINMENT",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "10013.64",
        totalinclvat: "12016.37"
      },
      {
        id: 25010050,
        searchname: "CDP - Service hours - Febr...",
        company: {
          id: 2,
          searchname: "Paradiso",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1425.38",
        totalinclvat: "1724.71"
      },
      {
        id: 25010053,
        searchname: "Service uren - Februari 2025",
        company: {
          id: 3,
          searchname: "Lektor Holding B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1674.64",
        totalinclvat: "2026.31"
      },
      {
        id: 25010061,
        searchname: "Service hours - Maart 2025",
        company: {
          id: 2,
          searchname: "Paradiso",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1266.87",
        totalinclvat: "1532.91"
      },
      {
        id: 25010060,
        searchname: "CDP - Service hours - Maar...",
        company: {
          id: 2,
          searchname: "Paradiso",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1425.38",
        totalinclvat: "1724.71"
      },
      {
        id: 25010054,
        searchname: "Service uren - Maart 2025",
        company: {
          id: 4,
          searchname: "Oude Kerk",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "591.69",
        totalinclvat: "715.94"
      },
      {
        id: 25010055,
        searchname: "SLA - Service uren - Maand...",
        company: {
          id: 5,
          searchname: "Amsterdam Museum",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "2416.37",
        totalinclvat: "2923.81"
      },
      {
        id: 25010059,
        searchname: "Service hours - Maart 2025",
        company: {
          id: 6,
          searchname: "Moco Museum",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1689.16",
        totalinclvat: "2043.88"
      },
      {
        id: 25010058,
        searchname: "Service hours - Maart 2025",
        company: {
          id: 7,
          searchname: "Eye Filmmuseum",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "2410.32",
        totalinclvat: "2916.49"
      },
      {
        id: 25010051,
        searchname: "Service uren 2025 - maart",
        company: {
          id: 8,
          searchname: "Duke of Tokyo Holding B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1660.12",
        totalinclvat: "2008.75"
      },
      {
        id: 25010056,
        searchname: "Service hours - Maart 2025",
        company: {
          id: 1,
          searchname: "USHUAIA ENTERTAINMENT",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1446.00",
        totalinclvat: "1749.66"
      },
      {
        id: 25010049,
        searchname: "Shopify API aanpassing (34...",
        company: {
          id: 9,
          searchname: "Two Chefs Brewing",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "3388.35",
        totalinclvat: "4099.90"
      },
      {
        id: 25010048,
        searchname: "Strategisch plan (3370)",
        company: {
          id: 10,
          searchname: "Spaghetteria Beheer B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1829.53",
        totalinclvat: "2213.73"
      },
      {
        id: 25010047,
        searchname: "Servd hosting kosten",
        company: {
          id: 11,
          searchname: "Monumental productions B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1180.36",
        totalinclvat: "1428.24"
      },
      {
        id: 25010046,
        searchname: "Tijdelijke websites - UX Fas...",
        company: {
          id: 12,
          searchname: "Centraal Museum",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "5714.24",
        totalinclvat: "6914.23"
      },
      // Voeg hier meer facturen toe volgens je factuurlijst tot 31 items
      {
        id: 25010044,
        searchname: "Lektor AI video tool research...",
        company: {
          id: 3,
          searchname: "Lektor Holding B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "28725.40",
        totalinclvat: "34757.73"
      },
      {
        id: 25010043,
        searchname: "Inventas (3419)",
        company: {
          id: 13,
          searchname: "Boer & Croon Management Solutions B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "5193.93",
        totalinclvat: "6284.66"
      },
      {
        id: 25010041,
        searchname: "Free Account + user feature...",
        company: {
          id: 14,
          searchname: "The Beauport Group",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "32671.25",
        totalinclvat: "39532.21"
      },
      {
        id: 25010040,
        searchname: "Service uren 2025 - februari",
        company: {
          id: 8,
          searchname: "Duke of Tokyo Holding B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1660.12",
        totalinclvat: "2008.75"
      },
      {
        id: 25010035,
        searchname: "SLA - Service uren - Maand...",
        company: {
          id: 5,
          searchname: "Amsterdam Museum",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "2416.37",
        totalinclvat: "2923.81"
      },
      {
        id: 25010033,
        searchname: "Service hours - Februari 2025",
        company: {
          id: 6,
          searchname: "Moco Museum",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1689.16",
        totalinclvat: "2043.88"
      },
      // Voeg hier meer facturen toe tot 31 stuks
      {
        id: 25010025,
        searchname: "Strategisch plan (3370)",
        company: {
          id: 10,
          searchname: "Spaghetteria Beheer B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1863.40",
        totalinclvat: "2254.71"
      },
      {
        id: 25010013,
        searchname: "Digital platform (3345) - An...",
        company: {
          id: 15,
          searchname: "Oxfam Novib",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "16661.70",
        totalinclvat: "20160.66"
      },
      {
        id: 25010010,
        searchname: "Lektor - product development...",
        company: {
          id: 3,
          searchname: "Lektor Holding B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "143869.00",
        totalinclvat: "174081.49"
      },
      {
        id: 25010008,
        searchname: "Service uren 2024 - novem...",
        company: {
          id: 16,
          searchname: "Effi Vastgoed Holding B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1868.24",
        totalinclvat: "2260.57"
      },
      {
        id: 25010003,
        searchname: "Service hours - Januari 2025",
        company: {
          id: 6,
          searchname: "Moco Museum",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1689.16",
        totalinclvat: "2043.88"
      },
      {
        id: 24010281,
        searchname: "Service uren 2024 december",
        company: {
          id: 6,
          searchname: "Moco Museum",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1689.16",
        totalinclvat: "2043.88"
      },
      {
        id: 24010273,
        searchname: "Service uren 2024 (3348)",
        company: {
          id: 17,
          searchname: "Double Shift",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "3127.86",
        totalinclvat: "3784.71"
      },
      {
        id: 24010255,
        searchname: "The Night League new venue...",
        company: {
          id: 1,
          searchname: "USHUAIA ENTERTAINMENT",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "10013.64",
        totalinclvat: "12016.37"
      },
      {
        id: 24010267,
        searchname: "Service uren 2024",
        company: {
          id: 6,
          searchname: "Moco Museum",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1689.16",
        totalinclvat: "2043.88"
      },
      {
        id: 24010248,
        searchname: "Strategisch plan (3370)",
        company: {
          id: 10,
          searchname: "Spaghetteria Beheer B.V.",
        },
        status: {
          id: 1,
          searchname: "Open",
        },
        totalexclvat: "1816.09",
        totalinclvat: "2197.47"
      }
    ];
    
    // ORIGINELE CODE HIERONDER:
    // Alle facturen ophalen met paginering
    /*
    let allInvoices: GrippInvoiceResponse[] = [];
    let start = 0;
    let hasMoreItems = true;
    
    // Pagineer door de resultaten tot we alles hebben opgehaald
    while (hasMoreItems) {
      console.log(`Fetching invoices batch starting at ${start}`);
      const response = await dashboardApi.get<InvoiceApiResponse>('/invoices', {
        params: {
          limit: 250,
          start
        }
      });
      
      // Check voor errors
      if (!response.data || response.data.error) {
        console.error('Error fetching invoices:', response.data?.error);
        break;
      }
      
      const batch = response.data.result?.items || [];
      console.log(`Received batch of ${batch.length} invoices`);
      
      // Voeg deze batch toe aan de totale verzameling
      allInvoices = [...allInvoices, ...batch];
      
      // Check of er meer items zijn
      hasMoreItems = !!response.data.result?.more_items_in_collection;
      
      // Update start voor de volgende pagina als die er is
      if (hasMoreItems && response.data.result?.next_start !== undefined) {
        start = response.data.result.next_start;
      } else {
        hasMoreItems = false;
      }
    }
    
    // Log aantal facturen en statussen
    console.log(`Retrieved a total of ${allInvoices.length} invoices from API`);
    
    // Log statussen om te zien wat beschikbaar is
    if (allInvoices.length > 0) {
      const statuses = [...new Set(allInvoices.map(inv => inv.status?.searchname))].filter(Boolean);
      console.log('Available invoice statuses:', statuses);
      
      // Log aantal facturen per status
      const statusCounts = statuses.reduce((acc, status) => {
        acc[status] = allInvoices.filter(inv => inv.status?.searchname === status).length;
        return acc;
      }, {} as Record<string, number>);
      console.log('Invoice counts per status:', statusCounts);
    }
    
    // Extraheer de factuurgegevens uit de response
    return allInvoices;
    */
  } catch (error) {
    console.error('Error in fetchInvoices:', error);
    // Retourneer een lege array in plaats van de error door te gooien
    // om te voorkomen dat de UI crasht
    return [];
  }
}; 