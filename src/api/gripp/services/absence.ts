import { GrippClient, grippClient } from '../client';

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
    const pageSize = 250;
    let hasMoreResults = true;
    
    while (hasMoreResults) {
      const firstResult = currentPage * pageSize;
      
      // Create filters for the request
      const filters = [];
      
      // Add employee filter if employeeIds is not empty
      if (employeeIds && employeeIds.length > 0) {
        filters.push({
          field: 'absencerequest.employee',
          operator: 'in',
          value: employeeIds
        });
      }
      
      const request = this.client.createRequest(
        'absencerequest.get',
        filters,
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
          
          // Filter the lines by date
          const filteredLines = request.absencerequestline.filter(line => {
            if (!line.date || !line.date.date) return false;
            
            const lineDate = line.date.date.split(' ')[0]; // Format: YYYY-MM-DD
            return lineDate >= startDate && lineDate <= endDate;
          });
          
          // Add the request data to each line
          const processedLines = filteredLines.map(line => ({
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
        throw error;
      }
    }
    
    console.log(`Total absence lines found: ${allAbsenceLines.length}`);
    return { result: { rows: allAbsenceLines } };
  }
}

export const absenceService = new AbsenceService(grippClient); 