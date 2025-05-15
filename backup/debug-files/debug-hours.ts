/**
 * Debug Hours Module
 * 
 * This module provides utility functions for debugging hours data.
 */

import { getDatabase } from '../../db/database';

/**
 * Get debug information about hours for a specific employee
 * @param employeeId Employee ID
 * @param year Year
 * @param week Week number
 * @returns Debug information about hours
 */
export async function getEmployeeHoursDebug(employeeId: number, year: number, week: number) {
  const db = await getDatabase();
  
  try {
    // Get all hours for the employee in the specified week
    const hours = await db.all(
      `SELECT * FROM hours 
       WHERE employee_id = ? 
       AND strftime('%Y', date) = ? 
       AND strftime('%W', date) = ?`,
      [employeeId, year.toString(), week.toString().padStart(2, '0')]
    );
    
    // Get employee details
    const employee = await db.get(
      'SELECT * FROM employees WHERE id = ?',
      [employeeId]
    );
    
    // Get contract details
    const contracts = await db.all(
      'SELECT * FROM contracts WHERE employee_id = ?',
      [employeeId]
    );
    
    return {
      employee,
      contracts,
      hours,
      meta: {
        totalHours: hours.reduce((sum, hour) => sum + parseFloat(hour.amount || '0'), 0),
        hoursByDay: hours.reduce((acc, hour) => {
          const day = new Date(hour.date).toLocaleDateString('en-US', { weekday: 'long' });
          acc[day] = (acc[day] || 0) + parseFloat(hour.amount || '0');
          return acc;
        }, {} as Record<string, number>),
        hoursByProject: hours.reduce((acc, hour) => {
          acc[hour.project_id] = (acc[hour.project_id] || 0) + parseFloat(hour.amount || '0');
          return acc;
        }, {} as Record<string, number>)
      }
    };
  } catch (error) {
    console.error('Error in getEmployeeHoursDebug:', error);
    throw error;
  }
}

/**
 * Get debug information about hours for all employees
 * @param year Year
 * @param week Week number
 * @returns Debug information about hours for all employees
 */
export async function getAllEmployeesHoursDebug(year: number, week: number) {
  const db = await getDatabase();
  
  try {
    // Get all active employees
    const employees = await db.all('SELECT id FROM employees WHERE active = 1');
    
    // Get debug information for each employee
    const results = await Promise.all(
      employees.map(emp => getEmployeeHoursDebug(emp.id, year, week))
    );
    
    return {
      year,
      week,
      employees: results,
      meta: {
        totalEmployees: employees.length,
        totalHours: results.reduce((sum, emp) => sum + emp.meta.totalHours, 0)
      }
    };
  } catch (error) {
    console.error('Error in getAllEmployeesHoursDebug:', error);
    throw error;
  }
}

export default {
  getEmployeeHoursDebug,
  getAllEmployeesHoursDebug
};
