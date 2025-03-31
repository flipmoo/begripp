"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hourService = void 0;
const client_ts_1 = require("../client.ts");
exports.hourService = {
    async getByEmployeeIdsAndPeriod(employeeIds, startDate, endDate) {
        const requests = employeeIds.map(employeeId => ({
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
        }));
        return Promise.all(requests.map(request => (0, client_ts_1.executeRequest)(request)));
    },
    /**
     * Get all hours for a specific employee and period with pagination support
     * This function handles fetching all pages of data
     */
    async getAllHoursByEmployeeAndPeriod(employeeId, startDate, endDate) {
        const PAGE_SIZE = 250;
        let allHours = [];
        let hasMoreResults = true;
        let offset = 0;
        console.log(`Fetching hours for employee ${employeeId} from ${startDate} to ${endDate}`);
        while (hasMoreResults) {
            const request = {
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
            const response = await (0, client_ts_1.executeRequest)(request);
            // Check if the response has the expected structure
            if (!response.result || !response.result.rows) {
                console.error('Unexpected API response structure:', response);
                break;
            }
            const hours = response.result.rows || [];
            const totalCount = response.result.count || 0;
            console.log(`Fetched ${hours.length} hours for employee ${employeeId} (offset: ${offset}, total: ${totalCount})`);
            allHours = [...allHours, ...hours];
            // If we got fewer results than the page size or we've fetched all results, we've reached the end
            if (hours.length < PAGE_SIZE || allHours.length >= totalCount) {
                hasMoreResults = false;
            }
            else {
                offset += PAGE_SIZE;
            }
        }
        console.log(`Total hours fetched for employee ${employeeId}: ${allHours.length}`);
        return allHours;
    },
};
