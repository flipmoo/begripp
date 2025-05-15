/**
 * Test script for revenue calculator
 *
 * This script tests the revenue calculator with a sample project
 * that has a previous year's budget usage.
 */

import {
  calculateRevenue,
  calculateProjectMaxRevenue,
  calculateLineMaxRevenue,
  CalculationMethod,
  Project
} from '../utils/revenue-calculator';

// Create a sample project similar to OLM - Phase 3A
const sampleProject: Project = {
  id: 1,
  projectId: 5632,
  projectName: 'OLM - Phase 3A',
  clientName: 'OLM',
  projectType: 'Vaste Prijs',
  projectBudget: 154154, // €154,154 total budget
  previousYearBudgetUsed: 142757, // €142,757 used in previous year
  projectLines: [
    {
      id: 1,
      amount: 100, // 100 hours budgeted
      amountwritten: 80, // 80 hours written
      sellingprice: 100, // €100 per hour
      invoicebasis: {
        id: 1, // Fixed price
        searchname: 'Vaste prijs'
      }
    },
    {
      id: 2,
      amount: 50, // 50 hours budgeted
      amountwritten: 40, // 40 hours written
      sellingprice: 120, // €120 per hour
      invoicebasis: {
        id: 1, // Fixed price
        searchname: 'Vaste prijs'
      }
    }
  ],
  monthlyItems: [
    // January
    [
      {
        id: 1,
        projectId: 5632,
        projectName: 'OLM - Phase 3A',
        clientName: 'OLM',
        projectType: 'Vaste Prijs',
        projectBudget: 154154,
        projectStatus: 'Active',
        year: 2024,
        month: 1,
        revenue: 0, // Will be calculated
        hours: 20,
        hourlyRate: 100,
        isDefinite: false,
        isOverBudget: false,
        previousYearBudgetUsed: 142757,
        projectLineId: 1
      }
    ],
    // February
    [
      {
        id: 2,
        projectId: 5632,
        projectName: 'OLM - Phase 3A',
        clientName: 'OLM',
        projectType: 'Vaste Prijs',
        projectBudget: 154154,
        projectStatus: 'Active',
        year: 2024,
        month: 2,
        revenue: 0, // Will be calculated
        hours: 30,
        hourlyRate: 100,
        isDefinite: false,
        isOverBudget: false,
        previousYearBudgetUsed: 142757,
        projectLineId: 1
      }
    ],
    // March
    [
      {
        id: 3,
        projectId: 5632,
        projectName: 'OLM - Phase 3A',
        clientName: 'OLM',
        projectType: 'Vaste Prijs',
        projectBudget: 154154,
        projectStatus: 'Active',
        year: 2024,
        month: 3,
        revenue: 0, // Will be calculated
        hours: 40,
        hourlyRate: 100,
        isDefinite: false,
        isOverBudget: false,
        previousYearBudgetUsed: 142757,
        projectLineId: 2
      }
    ],
    [], [], [], [], [], [], [], [], [] // Empty arrays for remaining months
  ]
};

// Create a sample project that exceeds the available budget
const overBudgetProject: Project = {
  id: 2,
  projectId: 9999,
  projectName: 'Test Over Budget Project',
  clientName: 'Test Client',
  projectType: 'Vaste Prijs',
  projectBudget: 20000, // €20,000 total budget
  previousYearBudgetUsed: 15000, // €15,000 used in previous year
  projectLines: [
    {
      id: 1,
      amount: 100, // 100 hours budgeted
      amountwritten: 80, // 80 hours written
      sellingprice: 100, // €100 per hour
      invoicebasis: {
        id: 1, // Fixed price
        searchname: 'Vaste prijs'
      }
    }
  ],
  monthlyItems: [
    // January
    [
      {
        id: 1,
        projectId: 9999,
        projectName: 'Test Over Budget Project',
        clientName: 'Test Client',
        projectType: 'Vaste Prijs',
        projectBudget: 20000,
        projectStatus: 'Active',
        year: 2024,
        month: 1,
        revenue: 0, // Will be calculated
        hours: 20,
        hourlyRate: 100,
        isDefinite: false,
        isOverBudget: false,
        previousYearBudgetUsed: 15000,
        projectLineId: 1
      }
    ],
    // February
    [
      {
        id: 2,
        projectId: 9999,
        projectName: 'Test Over Budget Project',
        clientName: 'Test Client',
        projectType: 'Vaste Prijs',
        projectBudget: 20000,
        projectStatus: 'Active',
        year: 2024,
        month: 2,
        revenue: 0, // Will be calculated
        hours: 30,
        hourlyRate: 100,
        isDefinite: false,
        isOverBudget: false,
        previousYearBudgetUsed: 15000,
        projectLineId: 1
      }
    ],
    // March
    [
      {
        id: 3,
        projectId: 9999,
        projectName: 'Test Over Budget Project',
        clientName: 'Test Client',
        projectType: 'Vaste Prijs',
        projectBudget: 20000,
        projectStatus: 'Active',
        year: 2024,
        month: 3,
        revenue: 0, // Will be calculated
        hours: 40,
        hourlyRate: 100,
        isDefinite: false,
        isOverBudget: false,
        previousYearBudgetUsed: 15000,
        projectLineId: 1
      }
    ],
    [], [], [], [], [], [], [], [], [] // Empty arrays for remaining months
  ]
};

// Test the revenue calculator
console.log('Testing revenue calculator with sample project...');
console.log('Project budget:', sampleProject.projectBudget);
console.log('Previous year budget used:', sampleProject.previousYearBudgetUsed);
console.log('Available budget for current year:', sampleProject.projectBudget - sampleProject.previousYearBudgetUsed);

// Test Project Max method
console.log('\nTesting Project Max method...');
const projectMaxResult = calculateRevenue(sampleProject, CalculationMethod.PROJECT_MAX);
console.log('Total revenue:', projectMaxResult.totalRevenue);
console.log('Remaining budget:', projectMaxResult.remainingBudget);
console.log('Is over budget:', projectMaxResult.isOverBudget);

// Log monthly revenue
console.log('\nMonthly revenue (Project Max):');
const projectMaxItems = calculateProjectMaxRevenue(sampleProject);
const monthlyRevenue = Array(12).fill(0);
projectMaxItems.forEach(item => {
  const monthIndex = item.month - 1;
  monthlyRevenue[monthIndex] += item.revenue;
});

for (let i = 0; i < 12; i++) {
  if (monthlyRevenue[i] > 0) {
    console.log(`Month ${i + 1}: €${monthlyRevenue[i]}`);
  }
}

// Test Project Line Max method
console.log('\nTesting Project Line Max method...');
const lineMaxResult = calculateRevenue(sampleProject, CalculationMethod.PROJECT_LINE_MAX);
console.log('Total revenue:', lineMaxResult.totalRevenue);
console.log('Remaining budget:', lineMaxResult.remainingBudget);
console.log('Is over budget:', lineMaxResult.isOverBudget);

// Log monthly revenue
console.log('\nMonthly revenue (Project Line Max):');
const lineMaxItems = calculateLineMaxRevenue(sampleProject);
const monthlyLineRevenue = Array(12).fill(0);
lineMaxItems.forEach(item => {
  const monthIndex = item.month - 1;
  monthlyLineRevenue[monthIndex] += item.revenue;
});

for (let i = 0; i < 12; i++) {
  if (monthlyLineRevenue[i] > 0) {
    console.log(`Month ${i + 1}: €${monthlyLineRevenue[i]}`);
  }
}

// Verify that total revenue doesn't exceed available budget
const availableBudget = sampleProject.projectBudget - sampleProject.previousYearBudgetUsed;
console.log('\nVerification:');
console.log('Available budget:', availableBudget);
console.log('Project Max total revenue:', projectMaxResult.totalRevenue);
console.log('Project Line Max total revenue:', lineMaxResult.totalRevenue);
console.log('Project Max exceeds budget:', projectMaxResult.totalRevenue > availableBudget);
console.log('Project Line Max exceeds budget:', lineMaxResult.totalRevenue > availableBudget);

// Test with over budget project
console.log('\n\n========================================');
console.log('Testing with over budget project...');
console.log('========================================');
console.log('Project budget:', overBudgetProject.projectBudget);
console.log('Previous year budget used:', overBudgetProject.previousYearBudgetUsed);
console.log('Available budget for current year:', overBudgetProject.projectBudget - overBudgetProject.previousYearBudgetUsed);

// Test Project Max method
console.log('\nTesting Project Max method...');
const overBudgetProjectMaxResult = calculateRevenue(overBudgetProject, CalculationMethod.PROJECT_MAX);
console.log('Total revenue:', overBudgetProjectMaxResult.totalRevenue);
console.log('Remaining budget:', overBudgetProjectMaxResult.remainingBudget);
console.log('Is over budget:', overBudgetProjectMaxResult.isOverBudget);

// Log monthly revenue
console.log('\nMonthly revenue (Project Max):');
const overBudgetProjectMaxItems = calculateProjectMaxRevenue(overBudgetProject);
const overBudgetMonthlyRevenue = Array(12).fill(0);
overBudgetProjectMaxItems.forEach(item => {
  const monthIndex = item.month - 1;
  overBudgetMonthlyRevenue[monthIndex] += item.revenue;
});

for (let i = 0; i < 12; i++) {
  if (overBudgetMonthlyRevenue[i] > 0) {
    console.log(`Month ${i + 1}: €${overBudgetMonthlyRevenue[i]}`);
  }
}

// Test Project Line Max method
console.log('\nTesting Project Line Max method...');
const overBudgetLineMaxResult = calculateRevenue(overBudgetProject, CalculationMethod.PROJECT_LINE_MAX);
console.log('Total revenue:', overBudgetLineMaxResult.totalRevenue);
console.log('Remaining budget:', overBudgetLineMaxResult.remainingBudget);
console.log('Is over budget:', overBudgetLineMaxResult.isOverBudget);

// Log monthly revenue
console.log('\nMonthly revenue (Project Line Max):');
const overBudgetLineMaxItems = calculateLineMaxRevenue(overBudgetProject);
const overBudgetMonthlyLineRevenue = Array(12).fill(0);
overBudgetLineMaxItems.forEach(item => {
  const monthIndex = item.month - 1;
  overBudgetMonthlyLineRevenue[monthIndex] += item.revenue;
});

for (let i = 0; i < 12; i++) {
  if (overBudgetMonthlyLineRevenue[i] > 0) {
    console.log(`Month ${i + 1}: €${overBudgetMonthlyLineRevenue[i]}`);
  }
}

// Verify that total revenue doesn't exceed available budget
const overBudgetAvailableBudget = overBudgetProject.projectBudget - overBudgetProject.previousYearBudgetUsed;
console.log('\nVerification:');
console.log('Available budget:', overBudgetAvailableBudget);
console.log('Project Max total revenue:', overBudgetProjectMaxResult.totalRevenue);
console.log('Project Line Max total revenue:', overBudgetLineMaxResult.totalRevenue);
console.log('Project Max exceeds budget:', overBudgetProjectMaxResult.totalRevenue > overBudgetAvailableBudget);
console.log('Project Line Max exceeds budget:', overBudgetLineMaxResult.totalRevenue > overBudgetAvailableBudget);
