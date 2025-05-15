import { GrippRequest, GrippResponse, executeRequest } from '../client.ts';

export type Hour = {
  id: number;
  employee: {
    id: number;
    searchname: string;
  };
  date: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  amount: number;
  description: string;
  status: {
    id: number;
    searchname: string;
  };
  offerprojectbase?: {
    id: number;
    searchname: string;
    discr: string;
  };
  offerprojectline?: {
    id: number;
    searchname: string;
  };
};

// Define the actual response structure from the API
export type HourResponse = {
  rows: Hour[];
  count: number;
  start: number;
};

export type HourFilter = {
  field: string;
  operator: string;
  value: string | number | boolean;
  value2?: string;
};

export type GetHoursOptions = {
  filters?: HourFilter[];
  options?: {
    paging?: {
      firstresult: number;
      maxresults: number;
    };
  };
};

export const hourService = {
  async getByEmployeeIdsAndPeriod(
    employeeIds: number[],
    startDate: string,
    endDate: string
  ): Promise<GrippResponse<HourResponse>[]> {
    const requests = employeeIds.map(employeeId =>
      ({
        method: 'hour.get',
        params: [
          [
            {
              field: 'hour.employee',
              operator: 'equals',
              value: employeeId,
            },
            {
              field: 'hour.date',
              operator: 'between',
              value: startDate,
              value2: endDate,
            },
          ],
          {
            paging: {
              firstresult: 0,
              maxresults: 250,
            },
          },
        ],
        id: Date.now(),
      } as GrippRequest)
    );

    return Promise.all(requests.map(request => executeRequest<HourResponse>(request)));
  },

  /**
   * Get all hours for a specific employee and period with pagination support
   * This function handles fetching all pages of data with improved error handling and retry logic
   */
  async getAllHoursByEmployeeAndPeriod(
    employeeId: number,
    startDate: string,
    endDate: string
  ): Promise<Hour[]> {
    // Split the date range into smaller chunks (e.g., weeks) to avoid API limitations
    const dateChunks = this.splitDateRange(startDate, endDate, 7); // Split into 7-day chunks
    let allHours: Hour[] = [];

    console.log(`Fetching hours for employee ${employeeId} from ${startDate} to ${endDate}`);
    console.log(`Split into ${dateChunks.length} chunks for better reliability`);

    // Process each date chunk
    for (let i = 0; i < dateChunks.length; i++) {
      const { start, end } = dateChunks[i];
      console.log(`Processing chunk ${i + 1}/${dateChunks.length}: ${start} to ${end}`);

      const hoursForChunk = await this.getHoursForDateChunk(employeeId, start, end);
      allHours = [...allHours, ...hoursForChunk];

      // Add a small delay between chunks to avoid overwhelming the API
      if (i < dateChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Log detailed statistics about the fetched hours
    console.log(`Total hours fetched for employee ${employeeId}: ${allHours.length}`);

    // Check for duplicate hours and remove them
    const uniqueHours = this.removeDuplicateHours(allHours);
    if (uniqueHours.length < allHours.length) {
      console.log(`Removed ${allHours.length - uniqueHours.length} duplicate hours`);
      allHours = uniqueHours;
    }

    // Log distribution by project for debugging
    const projectCounts: Record<string, { count: number, total: number }> = {};
    for (const hour of allHours) {
      const projectName = hour.offerprojectbase?.searchname || 'Unknown Project';
      if (!projectCounts[projectName]) {
        projectCounts[projectName] = { count: 0, total: 0 };
      }
      projectCounts[projectName].count++;
      projectCounts[projectName].total += hour.amount;
    }

    console.log(`Hours distribution by project for employee ${employeeId}:`);
    for (const [project, stats] of Object.entries(projectCounts)) {
      console.log(`- ${project}: ${stats.count} records, ${stats.total} hours`);
    }

    // Log distribution by date for debugging
    const dateCounts: Record<string, { count: number, total: number }> = {};
    for (const hour of allHours) {
      const date = hour.date.date.split(' ')[0]; // Format: YYYY-MM-DD
      if (!dateCounts[date]) {
        dateCounts[date] = { count: 0, total: 0 };
      }
      dateCounts[date].count++;
      dateCounts[date].total += hour.amount;
    }

    console.log(`Hours distribution by date for employee ${employeeId}:`);
    const sortedDates = Object.entries(dateCounts).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [date, stats] of sortedDates) {
      console.log(`- ${date}: ${stats.count} records, ${stats.total} hours`);
    }

    return allHours;
  },

  /**
   * Split a date range into smaller chunks
   */
  splitDateRange(startDate: string, endDate: string, chunkSizeDays: number): { start: string, end: string }[] {
    const chunks: { start: string, end: string }[] = [];

    const start = new Date(startDate);
    const end = new Date(endDate);

    let chunkStart = new Date(start);

    while (chunkStart <= end) {
      // Calculate chunk end date (chunkStart + chunkSizeDays - 1)
      let chunkEnd = new Date(chunkStart);
      chunkEnd.setDate(chunkEnd.getDate() + chunkSizeDays - 1);

      // If chunk end is after the overall end date, use the overall end date
      if (chunkEnd > end) {
        chunkEnd = new Date(end);
      }

      // Add the chunk to the list
      chunks.push({
        start: chunkStart.toISOString().split('T')[0],
        end: chunkEnd.toISOString().split('T')[0]
      });

      // Move to the next chunk
      chunkStart = new Date(chunkEnd);
      chunkStart.setDate(chunkStart.getDate() + 1);
    }

    return chunks;
  },

  /**
   * Remove duplicate hours based on hour ID
   */
  removeDuplicateHours(hours: Hour[]): Hour[] {
    const uniqueHours: Hour[] = [];
    const seenIds = new Set<number>();

    for (const hour of hours) {
      if (!seenIds.has(hour.id)) {
        seenIds.add(hour.id);
        uniqueHours.push(hour);
      }
    }

    return uniqueHours;
  },

  /**
   * Get hours for a specific date chunk
   */
  async getHoursForDateChunk(
    employeeId: number,
    startDate: string,
    endDate: string
  ): Promise<Hour[]> {
    const PAGE_SIZE = 250;
    let allHours: Hour[] = [];
    let hasMoreResults = true;
    let offset = 0;
    let retryCount = 0;
    const MAX_RETRIES = 5; // Increased from 3 to 5 for better resilience
    const RETRY_DELAY_MS = 2000; // 2 seconds delay between retries

    console.log(`Fetching hours for employee ${employeeId} from ${startDate} to ${endDate}`);

    while (hasMoreResults) {
      try {
        // Log the API request details for debugging
        console.log(`Making API request to: ${process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php'}`);
        console.log(`Request headers: ${JSON.stringify({
          Authorization: `Bearer ${process.env.GRIPP_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }, null, 2)}`);

        const request: GrippRequest = {
          method: 'hour.get',
          params: [
            [
              {
                field: 'hour.employee',
                operator: 'equals',
                value: employeeId,
              },
              {
                field: 'hour.date',
                operator: 'between',
                value: startDate,
                value2: endDate,
              },
            ],
            {
              paging: {
                firstresult: offset,
                maxresults: PAGE_SIZE,
              },
            },
          ],
          id: Date.now(),
        };

        // Log the request body for debugging
        console.log(`Request body: ${JSON.stringify(request, null, 2)}`);

        const response = await executeRequest<HourResponse>(request);

        // Log the response status and headers for debugging
        console.log(`API response status: ${response.status || 'unknown'}`);
        console.log(`API response headers: ${JSON.stringify(response.headers || {}, null, 2)}`);

        // Log the response data for debugging (limited to avoid excessive logging)
        console.log(`API response data: ${JSON.stringify(response, null, 2)}`);

        // Check if the response has the expected structure
        if (!response.result || !response.result.rows) {
          console.error('Unexpected API response structure:', response);

          // Retry logic with exponential backoff
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delayMs = RETRY_DELAY_MS * Math.pow(2, retryCount - 1); // Exponential backoff
            console.log(`Retrying request (${retryCount}/${MAX_RETRIES}) after ${delayMs}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          } else {
            console.error(`Max retries (${MAX_RETRIES}) reached. Stopping.`);
            break;
          }
        }

        // Reset retry count on successful response
        retryCount = 0;

        const hours = response.result.rows || [];
        const totalCount = response.result.count || 0;
        const moreItemsInCollection = response.result.more_items_in_collection || false;

        console.log(`Fetched ${hours.length} hours for employee ${employeeId} (offset: ${offset}, total: ${totalCount}, more_items: ${moreItemsInCollection})`);

        allHours = [...allHours, ...hours];

        // Check if we need to continue fetching more pages
        // We continue if we got a full page of results AND either:
        // 1. The API explicitly says there are more items, OR
        // 2. We haven't fetched all items according to the total count
        if (hours.length === PAGE_SIZE && (moreItemsInCollection || allHours.length < totalCount)) {
          offset += PAGE_SIZE;
        } else {
          hasMoreResults = false;
        }

        // Add a small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching hours for employee ${employeeId} (offset: ${offset}):`, error);

        // Retry logic with exponential backoff
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delayMs = RETRY_DELAY_MS * Math.pow(2, retryCount - 1); // Exponential backoff
          console.log(`Retrying request (${retryCount}/${MAX_RETRIES}) after ${delayMs}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.error(`Max retries (${MAX_RETRIES}) reached. Stopping.`);
          break;
        }
      }
    }

    return allHours;
  },

  /**
   * Get all hours for a specific period, regardless of employee
   * This is used for the IRIS page where we need all hours, including those from inactive employees
   */
  async getAllHoursByPeriod(startDate: string, endDate: string): Promise<Hour[]> {
    // Split the date range into smaller chunks (e.g., weeks) to avoid API limitations
    const dateChunks = this.splitDateRange(startDate, endDate, 7); // Split into 7-day chunks
    let allHours: Hour[] = [];

    console.log(`Fetching ALL hours from ${startDate} to ${endDate}`);
    console.log(`Split into ${dateChunks.length} chunks for better reliability`);

    // Process each date chunk
    for (let i = 0; i < dateChunks.length; i++) {
      const { start, end } = dateChunks[i];
      console.log(`Processing chunk ${i + 1}/${dateChunks.length}: ${start} to ${end}`);

      const hoursForChunk = await this.getHoursForDateChunkAllEmployees(start, end);
      allHours = [...allHours, ...hoursForChunk];

      // Add a small delay between chunks to avoid overwhelming the API
      if (i < dateChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Log detailed statistics about the fetched hours
    console.log(`Total hours fetched for all employees: ${allHours.length}`);

    // Check for duplicate hours and remove them
    const uniqueHours = this.removeDuplicateHours(allHours);
    if (uniqueHours.length < allHours.length) {
      console.log(`Removed ${allHours.length - uniqueHours.length} duplicate hours`);
      allHours = uniqueHours;
    }

    // Log distribution by project for debugging
    const projectCounts: Record<string, { count: number, total: number }> = {};
    for (const hour of allHours) {
      const projectName = hour.offerprojectbase?.searchname || 'Unknown Project';
      if (!projectCounts[projectName]) {
        projectCounts[projectName] = { count: 0, total: 0 };
      }
      projectCounts[projectName].count++;
      projectCounts[projectName].total += hour.amount;
    }

    console.log(`Hours distribution by project for all employees:`);
    for (const [project, stats] of Object.entries(projectCounts)) {
      console.log(`- ${project}: ${stats.count} records, ${stats.total} hours`);
    }

    // Log distribution by employee for debugging
    const employeeCounts: Record<string, { count: number, total: number }> = {};
    for (const hour of allHours) {
      const employeeName = hour.employee?.searchname || 'Unknown Employee';
      if (!employeeCounts[employeeName]) {
        employeeCounts[employeeName] = { count: 0, total: 0 };
      }
      employeeCounts[employeeName].count++;
      employeeCounts[employeeName].total += hour.amount;
    }

    console.log(`Hours distribution by employee:`);
    for (const [employee, stats] of Object.entries(employeeCounts)) {
      console.log(`- ${employee}: ${stats.count} records, ${stats.total} hours`);
    }

    return allHours;
  },

  /**
   * Get hours for a specific date chunk for all employees
   */
  async getHoursForDateChunkAllEmployees(
    startDate: string,
    endDate: string
  ): Promise<Hour[]> {
    const PAGE_SIZE = 250;
    let allHours: Hour[] = [];
    let hasMoreResults = true;
    let offset = 0;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 2000;

    console.log(`Fetching hours for all employees from ${startDate} to ${endDate}`);

    while (hasMoreResults) {
      try {
        // Log the API request details for debugging
        console.log(`Making API request to: ${process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php'}`);
        console.log(`Request headers: ${JSON.stringify({
          Authorization: `Bearer ${process.env.GRIPP_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }, null, 2)}`);

        const request: GrippRequest = {
          method: 'hour.get',
          params: [
            [
              {
                field: 'hour.date',
                operator: 'between',
                value: startDate,
                value2: endDate,
              },
            ],
            {
              paging: {
                firstresult: offset,
                maxresults: PAGE_SIZE,
              },
            },
          ],
          id: Date.now(),
        };

        // Log the request body for debugging
        console.log(`Request body: ${JSON.stringify(request, null, 2)}`);

        const response = await executeRequest<HourResponse>(request);

        // Log the response status and headers for debugging
        console.log(`API response status: ${response.status || 'unknown'}`);
        console.log(`API response headers: ${JSON.stringify(response.headers || {}, null, 2)}`);

        // Check if the response has the expected structure
        if (!response.result || !response.result.rows) {
          console.error('Unexpected API response structure:', response);

          // Retry logic with exponential backoff
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delayMs = RETRY_DELAY_MS * Math.pow(2, retryCount - 1); // Exponential backoff
            console.log(`Retrying request (${retryCount}/${MAX_RETRIES}) after ${delayMs}ms delay...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          } else {
            console.error(`Max retries (${MAX_RETRIES}) reached. Stopping.`);
            break;
          }
        }

        // Reset retry count on successful response
        retryCount = 0;

        const hours = response.result.rows || [];
        const totalCount = response.result.count || 0;
        const moreItemsInCollection = response.result.more_items_in_collection || false;

        console.log(`Fetched ${hours.length} hours for all employees (offset: ${offset}, total: ${totalCount}, more_items: ${moreItemsInCollection})`);

        allHours = [...allHours, ...hours];

        // Check if we need to continue fetching more pages
        if (hours.length === PAGE_SIZE && (moreItemsInCollection || allHours.length < totalCount)) {
          offset += PAGE_SIZE;
        } else {
          hasMoreResults = false;
        }

        // Add a small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching hours for all employees (offset: ${offset}):`, error);

        // Retry logic with exponential backoff
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delayMs = RETRY_DELAY_MS * Math.pow(2, retryCount - 1); // Exponential backoff
          console.log(`Retrying request (${retryCount}/${MAX_RETRIES}) after ${delayMs}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.error(`Max retries (${MAX_RETRIES}) reached. Stopping.`);
          break;
        }
      }
    }

    return allHours;
  },
};