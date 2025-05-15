/**
 * Test script voor het testen van de revenue calculator met het OLM - Phase 3A project
 */

import { calculateProjectMaxRevenue } from '../utils/revenue-calculator';

// Maak een test project aan dat lijkt op het OLM - Phase 3A project
const olmProject = {
  id: 'test-olm',
  projectId: 5632,
  projectName: 'OLM - Phase 3A (3353)',
  clientName: 'Limburgs Museum',
  projectType: 'Vaste Prijs',
  projectBudget: 154154,
  previousYearBudgetUsed: 142757,
  projectLines: [
    {
      id: 94423,
      amount: 154154,
      amountwritten: 142757,
      sellingprice: 120,
      invoicebasis: {
        id: 1, // Vaste prijs
        searchname: 'Vaste prijs'
      }
    }
  ],
  monthlyItems: Array(12).fill(null).map(() => [])
};

// Voeg uren toe voor januari (maand 0 in de array)
olmProject.monthlyItems[0] = [
  {
    id: 'test-1',
    projectId: 5632,
    projectName: 'OLM - Phase 3A (3353)',
    clientName: 'Limburgs Museum',
    employeeId: 101840,
    employeeName: 'Test Employee',
    year: 2025,
    month: 1,
    hours: 80.25,
    hourlyRate: 120,
    isDefinite: true,
    projectType: 'Vaste Prijs',
    projectStatus: 'Uitvoering',
    projectBudget: 154154,
    previousYearBudgetUsed: 142757,
    projectLineId: 94423,
    projectLineName: 'Front-end Development (Fixed)',
    projectLineAmount: 154154,
    projectLineAmountWritten: 142757,
    invoiceBasisId: 1,
    invoiceBasisName: 'Vaste prijs',
    isOverBudget: false,
    adjustedDueToMaxBudget: false,
    revenue: 0, // Wordt berekend door de calculator
    discr: null,
    isQuote: false,
    offerprojectbase: null,
    offerprojectbase_discr: null
  }
];

// Bereken de omzet met de Project Max methode
console.log('Berekenen van omzet voor OLM - Phase 3A project met Project Max methode...');
console.log(`Project budget: €${olmProject.projectBudget}`);
console.log(`Verbruikt vorig jaar: €${olmProject.previousYearBudgetUsed}`);
console.log(`Beschikbaar budget: €${Math.max(0, olmProject.projectBudget - olmProject.previousYearBudgetUsed)}`);

const result = calculateProjectMaxRevenue(olmProject);

// Toon de resultaten
console.log('\nResultaten:');
let totalRevenue = 0;
result.forEach(item => {
  console.log(`Maand ${item.month}: ${item.hours} uren, omzet: €${item.revenue}, over budget: ${item.isOverBudget}`);
  totalRevenue += item.revenue;
});

console.log(`\nTotale omzet: €${totalRevenue}`);
console.log(`Beschikbaar budget: €${Math.max(0, olmProject.projectBudget - olmProject.previousYearBudgetUsed)}`);
console.log(`Verschil: €${Math.max(0, olmProject.projectBudget - olmProject.previousYearBudgetUsed) - totalRevenue}`);
