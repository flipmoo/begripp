"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDataCached = isDataCached;
exports.getDeclarabilityByDepartment = getDeclarabilityByDepartment;
exports.calculateDeclarabilityByDepartment = calculateDeclarabilityByDepartment;
exports.clearDeclarabilityCache = clearDeclarabilityCache;
const axios_1 = __importDefault(require("axios"));
const hour_1 = require("../api/gripp/services/hour");
// URL for API requests
const API_BASE = 'http://localhost:3002/api';
// Cache expiration time in milliseconds (30 minutes)
const CACHE_EXPIRATION = 30 * 60 * 1000;
// Initialize client-side cache
const clientCache = {};
// Cache keys
const CLIENT_CACHE_KEYS = {
    DECLARABILITY: (startDate, endDate) => `declarability_${startDate}_${endDate}`,
};
/**
 * Check if data for a specific period is in the cache and not expired
 */
function isDataCached(startDate, endDate) {
    const now = Date.now();
    const cacheKey = CLIENT_CACHE_KEYS.DECLARABILITY(startDate, endDate);
    return !!(clientCache[cacheKey] && (now - clientCache[cacheKey].timestamp) < CACHE_EXPIRATION);
}
/**
 * Calculate declarability per department for a specific period
 */
async function getDeclarabilityByDepartment(startDate, endDate, forceRefresh = false) {
    try {
        const cacheKey = CLIENT_CACHE_KEYS.DECLARABILITY(startDate, endDate);
        const now = Date.now();
        // Check if we have valid cached data
        if (!forceRefresh && clientCache[cacheKey] && (now - clientCache[cacheKey].timestamp) < CACHE_EXPIRATION) {
            console.log(`Using client-side cached data for declarability ${startDate}-${endDate}`);
            return clientCache[cacheKey].data;
        }
        // Add a timestamp parameter to prevent caching issues
        const currentTimestamp = now;
        const url = `${API_BASE}/declarability?startDate=${startDate}&endDate=${endDate}&_=${currentTimestamp}`;
        console.log(`Fetching declarability data from API: ${url}`);
        const response = await axios_1.default.get(url, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        if (response.status !== 200) {
            throw new Error('Failed to fetch declarability data');
        }
        const data = response.data;
        // Store in client-side cache
        clientCache[cacheKey] = {
            data: data,
            timestamp: now
        };
        return data;
    }
    catch (error) {
        console.error('Error fetching declarability data:', error);
        throw error;
    }
}
/**
 * Calculate declarability data manually (for initial development or when API isn't available)
 * This function should be called from the API endpoint
 */
async function calculateDeclarabilityByDepartment(startDate, endDate) {
    try {
        // 1. Get all employees with their department information
        const employeesResponse = await axios_1.default.get(`${API_BASE}/employees`);
        const employees = employeesResponse.data;
        // 2. Initialize a map to store department data
        const departmentMap = new Map();
        // Group employees by department
        employees.forEach((employee) => {
            if (employee.department && employee.department.id) {
                if (!departmentMap.has(employee.department.id)) {
                    departmentMap.set(employee.department.id, {
                        id: employee.department.id,
                        name: employee.department.zoeknaam || `Department ${employee.department.id}`,
                        totalHours: 0,
                        declarableHours: 0,
                        nonDeclarableHours: 0
                    });
                }
            }
        });
        // 3. Fetch hours for each employee
        for (const employee of employees) {
            if (employee.active && employee.id) {
                try {
                    const hours = await hour_1.hourService.getAllHoursByEmployeeAndPeriod(employee.id, startDate, endDate);
                    // Process each hour entry
                    for (const hour of hours) {
                        // Skip if no department info for the employee
                        if (!employee.department || !employee.department.id)
                            continue;
                        const departmentId = employee.department.id;
                        const departmentData = departmentMap.get(departmentId);
                        if (departmentData) {
                            // Update total hours
                            departmentData.totalHours += hour.amount;
                            // Check if the hour is linked to an offerprojectline
                            if (hour.offerprojectline && hour.offerprojectline.id) {
                                // Fetch the project line details to determine declarability
                                try {
                                    const projectLineResponse = await axios_1.default.get(`${API_BASE}/projectline/${hour.offerprojectline.id}`);
                                    const projectLine = projectLineResponse.data;
                                    // Check invoice basis (id:4 is "Niet Declarabel" according to requirements)
                                    if (projectLine.invoicebasis && projectLine.invoicebasis.id === 4) {
                                        departmentData.nonDeclarableHours += hour.amount;
                                    }
                                    else {
                                        departmentData.declarableHours += hour.amount;
                                    }
                                }
                                catch (error) {
                                    console.error(`Error fetching project line ${hour.offerprojectline.id}:`, error);
                                    // Default to non-declarable if we can't determine
                                    departmentData.nonDeclarableHours += hour.amount;
                                }
                            }
                            else {
                                // If no project line is linked, consider as non-declarable
                                departmentData.nonDeclarableHours += hour.amount;
                            }
                        }
                    }
                }
                catch (error) {
                    console.error(`Error processing hours for employee ${employee.id}:`, error);
                }
            }
        }
        // 4. Convert the map to array and calculate percentages
        const result = Array.from(departmentMap.values())
            .map(dept => ({
            departmentId: dept.id,
            departmentName: dept.name,
            totalHours: dept.totalHours,
            declarableHours: dept.declarableHours,
            nonDeclarableHours: dept.nonDeclarableHours,
            declarabilityPercentage: dept.totalHours > 0
                ? (dept.declarableHours / dept.totalHours) * 100
                : 0
        }))
            .filter(dept => dept.totalHours > 0) // Only include departments with recorded hours
            .sort((a, b) => b.declarabilityPercentage - a.declarabilityPercentage); // Sort by percentage (highest first)
        return result;
    }
    catch (error) {
        console.error('Error calculating declarability by department:', error);
        throw error;
    }
}
/**
 * Clear client-side declarability cache
 */
function clearDeclarabilityCache() {
    for (const key in clientCache) {
        if (key.startsWith('declarability_')) {
            delete clientCache[key];
        }
    }
    console.log('Declarability cache cleared');
}
