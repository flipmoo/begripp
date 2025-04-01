import { GrippClient, grippClient, executeRequest } from '../client';

// Helper function to log to both console and file
function log(message: string) {
  console.log(message);
  // If we're in a Node.js environment, we can write to a file
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write(message + '\n');
  }
}

export interface AbsenceRequest {
  id: number;
  employee: {
    id: number;
  };
  date: {
    date: string;
  };
  description: string;
  amount: number;
  startingtime: string;
  absencerequest: {
    id: number;
  };
  absencerequeststatus: {
    id: number;
    searchname: string;
  };
}

export class AbsenceService {
  private client: GrippClient;

  constructor(client: GrippClient) {
    this.client = client;
  }

  async getByEmployeeIdsAndPeriod(employeeIds: number[], startDate: string, endDate: string): Promise<any> {
    console.log(`Fetching absence requests for employee IDs: ${employeeIds} from ${startDate} to ${endDate}`);
    
    let allAbsenceLines: any[] = [];
    let currentPage = 0;
    const pageSize = 250; // Maximum allowed by the API
    let hasMoreResults = true;
    
    // Haal alle afwezigheidsgegevens op zonder filters
    while (hasMoreResults) {
      const firstResult = currentPage * pageSize;
      
      const request = this.client.createRequest(
        'absencerequest.get',
        [], // Geen filters
        {
          paging: {
            firstresult: firstResult,
            maxresults: pageSize
          }
        }
      );
      
      try {
        console.log(`Fetching page ${currentPage + 1} of absence requests (${firstResult} to ${firstResult + pageSize})`);
        const response = await this.client.executeRequest(request);
        
        if (!response?.result?.rows || response.result.rows.length === 0) {
          console.log('No absence requests found or end of results reached');
          hasMoreResults = false;
          break;
        }
        
        console.log(`Received ${response.result.rows.length} absence requests for page ${currentPage + 1}`);
        
        // Process each absence request to extract the absence lines
        for (const request of response.result.rows) {
          if (!request.absencerequestline || !Array.isArray(request.absencerequestline)) {
            console.warn(`Skipping absence request without valid lines: ${request.id}`);
            continue;
          }
          
          // Controleer of de medewerker in de lijst zit
          const employeeId = request.employee?.id;
          const employeeMatch = employeeIds.length === 0 || 
            (employeeId && employeeIds.includes(employeeId));
          
          // Als de medewerker niet in de lijst zit, sla deze aanvraag over
          if (!employeeMatch) {
            continue;
          }
          
          // Filter de regels op datum
          const filteredLines = request.absencerequestline.filter((line: any) => {
            if (!line.date || !line.date.date) return false;
            
            const lineDate = line.date.date.split(' ')[0]; // Format: YYYY-MM-DD
            
            // Filter op datum
            return lineDate >= startDate && lineDate <= endDate;
          });
          
          // Add the request data to each line
          const processedLines = filteredLines.map((line: any) => ({
            ...line,
            absencerequest: {
              id: request.id,
              absencetype: request.absencetype
            },
            employee: request.employee,
            description: line.description || request.description
          }));
          
          allAbsenceLines = [...allAbsenceLines, ...processedLines];
        }
        
        console.log(`Filtered to ${allAbsenceLines.length} absence lines within date range so far`);
        
        // If we received fewer results than the page size, we've reached the end
        if (response.result.rows.length < pageSize) {
          hasMoreResults = false;
        } else {
          currentPage++;
        }
      } catch (error) {
        console.error('Error fetching absence data:', error);
        hasMoreResults = false;
        break;
      }
    }
    
    console.log(`Total absence lines found: ${allAbsenceLines.length}`);
    return { result: { rows: allAbsenceLines } };
  }

  async getAbsencesByPeriod(startDate: string, endDate: string, offset = 0, limit = 250) {
    const request = {
      method: 'absencerequest.get',
      params: [
        [
          {
            field: 'absencerequest.startdate',
            operator: 'greaterthanequals',
            value: startDate
          },
          {
            field: 'absencerequest.enddate',
            operator: 'lessthanequals',
            value: endDate
          }
        ],
        {
          paging: {
            firstresult: offset,
            maxresults: limit
          }
        }
      ],
      id: Date.now()
    };
    
    console.log(`Fetching absence requests from ${startDate} to ${endDate} (offset: ${offset}, limit: ${limit})`);
    const response = await executeRequest(request);
    
    if (!response?.result?.rows) {
      console.log('No absence requests found or error in response');
      return [];
    }
    
    console.log(`Fetched ${response.result.rows.length} absence requests`);
    return response.result.rows;
  }
  
  async getAllAbsencesByPeriod(startDate: string, endDate: string) {
    let allAbsences = [];
    let offset = 0;
    const limit = 250;
    let hasMoreResults = true;
    
    console.log(`Fetching all absences for period ${startDate} to ${endDate}`);
    
    while (hasMoreResults) {
      const absences = await this.getAbsencesByPeriod(startDate, endDate, offset, limit);
      
      if (!absences || absences.length === 0) {
        console.log('No more absences found or end of results reached');
        hasMoreResults = false;
        break;
      }
      
      console.log(`Retrieved batch of ${absences.length} absences (offset: ${offset})`);
      allAbsences = [...allAbsences, ...absences];
      
      if (absences.length < limit) {
        hasMoreResults = false;
      } else {
        offset += limit;
      }
    }
    
    console.log(`Total absences fetched: ${allAbsences.length}`);
    return allAbsences;
  }
}

export const absenceService = new AbsenceService(grippClient); 