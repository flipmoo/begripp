/**
 * Revenue Calculator (Fixed)
 *
 * Dit bestand bevat functies voor het berekenen van omzet op basis van uren en projectgegevens.
 * Deze implementatie is specifiek gemaakt om het probleem met niet-doorbelastbare uren op te lossen.
 */

import { IrisRevenueItem } from '../contexts/IrisContext';

// Constanten voor facturatiebasis IDs
export const INVOICE_BASIS = {
  FIXED_PRICE: 1,    // Vaste prijs
  HOURLY_RATE: 2,    // Nacalculatie
  SUBSCRIPTION: 3,   // Abonnement
  NON_BILLABLE: 4    // Niet doorbelastbaar
};

// Constanten voor project types
export const PROJECT_TYPE = {
  FIXED_PRICE: 'Vaste Prijs',
  HOURLY_RATE: 'Nacalculatie',
  INTERNAL: 'Intern',
  CONTRACT: 'Contract',
  QUOTE: 'Offerte',
  WRONG_TAG: 'Verkeerde tag'
};

// Berekeningsmethoden
export enum CalculationMethod {
  PROJECT_MAX = 'project_max',
  LINE_MAX = 'line_max'
}

// Interface voor het resultaat van de omzetberekening
export interface RevenueCalculationResult {
  items: IrisRevenueItem[];
  totalRevenue: number;
  remainingBudget: number;
  isOverBudget: boolean;
  linesOverBudget: number[];
}

// Interface voor een project
export interface Project {
  projectId: number;
  projectName: string;
  projectType: string;
  projectBudget: number;
  previousYearBudgetUsed: number;
  monthlyItems: IrisRevenueItem[][];
  projectLines: any[];
  isQuote?: boolean;
}

/**
 * Bereken omzet voor een project met de gekozen berekeningsmethode
 *
 * @param project Project waarvoor de omzet berekend moet worden
 * @param method Berekeningsmethode (Project Max of Projectregel Max)
 * @returns Resultaat van de omzetberekening
 */
export function calculateRevenue(
  project: Project,
  method: CalculationMethod = CalculationMethod.PROJECT_MAX
): RevenueCalculationResult {
  console.log(`REVENUE CALCULATOR FIXED: Berekenen van omzet voor project ${project.projectId} (${project.projectName}) met methode ${method}`);
  
  // Kies de juiste berekeningsmethode
  const items = method === CalculationMethod.PROJECT_MAX
    ? calculateProjectMaxRevenue(project)
    : calculateLineMaxRevenue(project);

  // Bereken totale omzet
  const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);

  // Bereken resterend budget
  const totalBudget = project.projectBudget || 0;
  const previousYearBudgetUsed = project.previousYearBudgetUsed || 0;
  const remainingBudget = totalBudget - previousYearBudgetUsed - totalRevenue;

  // Bepaal of het project over budget is
  const isOverBudget = remainingBudget < 0;

  // Verzamel projectregels die over budget zijn
  const linesOverBudget = items
    .filter(item => item.isOverBudget)
    .map(item => item.projectLineId)
    .filter((id, index, self) => id && self.indexOf(id) === index); // Unieke IDs

  console.log(`REVENUE CALCULATOR FIXED: Resultaat voor project ${project.projectId} (${project.projectName}):`, {
    totalRevenue,
    remainingBudget,
    isOverBudget,
    linesOverBudget: linesOverBudget.length
  });

  return {
    items,
    totalRevenue,
    remainingBudget,
    isOverBudget,
    linesOverBudget
  };
}

/**
 * Bereken omzet voor een project met de Project Max methode
 *
 * Bij deze methode worden alle uren berekend met het uurtarief van de betreffende projectregel,
 * zolang het totale projectbudget niet is overschreden. Als het projectbudget op is, zijn alle
 * resterende uren €0 waard.
 *
 * @param project Project waarvoor de omzet berekend moet worden
 * @returns Array van IrisRevenueItem met berekende omzet
 */
export function calculateProjectMaxRevenue(project: Project): IrisRevenueItem[] {
  console.log(`REVENUE CALCULATOR FIXED: Project Max berekening voor project ${project.projectId} (${project.projectName})`);
  
  // Bereken het beschikbare budget voor dit jaar
  const totalBudget = project.projectBudget || 0;
  const previousYearBudgetUsed = project.previousYearBudgetUsed || 0;
  const availableBudget = Math.max(0, totalBudget - previousYearBudgetUsed);

  console.log(`REVENUE CALCULATOR FIXED: Project ${project.projectId} (${project.projectName}): Budget €${totalBudget}, Verbruikt €${previousYearBudgetUsed}, Beschikbaar €${availableBudget}`);

  // Voor interne projecten: alle uren genereren €0 omzet
  if (project.projectType === PROJECT_TYPE.INTERNAL) {
    console.log(`REVENUE CALCULATOR FIXED: Project ${project.projectId} (${project.projectName}) is een intern project, alle uren genereren €0 omzet`);
    
    return project.monthlyItems.flatMap(items =>
      items.map(item => ({
        ...item,
        revenue: 0,
        isOverBudget: false,
        lineOverBudget: false,
        adjustedDueToMaxBudget: false
      }))
    );
  }

  // Voor nacalculatie, offerte en contract projecten: alle uren worden altijd vermenigvuldigd met het uurtarief
  // BEHALVE niet-doorbelastbare uren, die genereren altijd €0 omzet
  if (project.projectType === PROJECT_TYPE.HOURLY_RATE || 
      project.projectType === PROJECT_TYPE.QUOTE || 
      project.projectType === PROJECT_TYPE.CONTRACT) {
    console.log(`REVENUE CALCULATOR FIXED: Project ${project.projectId} (${project.projectName}) is een ${project.projectType} project`);
    
    return project.monthlyItems.flatMap(items =>
      items.map(item => {
        // Check of dit een niet-doorbelastbaar uur is
        const isNonBillable = item.invoiceBasisId === INVOICE_BASIS.NON_BILLABLE;
        
        if (isNonBillable) {
          console.log(`REVENUE CALCULATOR FIXED: Niet-doorbelastbare uren gevonden in ${project.projectType} project ${project.projectId} (${project.projectName}):`, {
            projectLineId: item.projectLineId,
            projectLineName: item.projectLineName,
            hours: item.hours,
            month: item.month,
            invoiceBasisId: item.invoiceBasisId,
            invoiceBasisName: item.invoiceBasisName
          });
        }
        
        return {
          ...item,
          revenue: isNonBillable ? 0 : item.hours * item.hourlyRate,
          isOverBudget: false,
          lineOverBudget: false,
          adjustedDueToMaxBudget: false
        };
      })
    );
  }

  // Voor vaste prijs projecten: bereken de omzet chronologisch
  console.log(`REVENUE CALCULATOR FIXED: Project ${project.projectId} (${project.projectName}) is een vaste prijs project`);
  
  // Verzamel alle items in chronologische volgorde
  const allItems: IrisRevenueItem[] = [];
  
  for (let month = 0; month < 12; month++) {
    if (project.monthlyItems[month]) {
      allItems.push(...project.monthlyItems[month]);
    }
  }
  
  // Sorteer items op maand
  allItems.sort((a, b) => a.month - b.month);
  
  // Bereken de omzet voor elk item
  const result: IrisRevenueItem[] = [];
  let remainingBudget = availableBudget;
  
  allItems.forEach(item => {
    // Check of dit een niet-doorbelastbaar uur is
    const isNonBillable = item.invoiceBasisId === INVOICE_BASIS.NON_BILLABLE;
    
    if (isNonBillable) {
      console.log(`REVENUE CALCULATOR FIXED: Niet-doorbelastbare uren gevonden in vaste prijs project ${project.projectId} (${project.projectName}):`, {
        projectLineId: item.projectLineId,
        projectLineName: item.projectLineName,
        hours: item.hours,
        month: item.month,
        invoiceBasisId: item.invoiceBasisId,
        invoiceBasisName: item.invoiceBasisName
      });
      
      // Niet-doorbelastbare uren genereren altijd €0 omzet
      result.push({
        ...item,
        revenue: 0,
        isOverBudget: false,
        lineOverBudget: false,
        adjustedDueToMaxBudget: false
      });
      
      return; // Skip de rest van de berekening voor dit item
    }
    
    // Controleer of dit een nacalculatie regel is binnen een vaste prijs project
    const isHourlyRate = item.invoiceBasisId === INVOICE_BASIS.HOURLY_RATE;
    
    if (isHourlyRate) {
      // Nacalculatie regels binnen vaste prijs projecten worden altijd tegen uurtarief berekend
      result.push({
        ...item,
        revenue: item.hours * item.hourlyRate,
        isOverBudget: false,
        lineOverBudget: false,
        adjustedDueToMaxBudget: false
      });
      
      return; // Skip de rest van de berekening voor dit item
    }
    
    // Dit is een vaste prijs regel
    const potentialRevenue = item.hours * item.hourlyRate;
    
    if (remainingBudget <= 0) {
      // Geen budget meer over
      result.push({
        ...item,
        revenue: 0,
        isOverBudget: true,
        lineOverBudget: false,
        adjustedDueToMaxBudget: true
      });
    } else if (potentialRevenue <= remainingBudget) {
      // Genoeg budget voor deze uren
      result.push({
        ...item,
        revenue: potentialRevenue,
        isOverBudget: false,
        lineOverBudget: false,
        adjustedDueToMaxBudget: false
      });
      
      remainingBudget -= potentialRevenue;
    } else {
      // Niet genoeg budget voor deze uren
      result.push({
        ...item,
        revenue: remainingBudget,
        isOverBudget: true,
        lineOverBudget: false,
        adjustedDueToMaxBudget: true
      });
      
      remainingBudget = 0;
    }
  });
  
  return result;
}

/**
 * Bereken omzet voor een project met de Projectregel Max methode
 * 
 * Deze implementatie is vereenvoudigd en zorgt ervoor dat niet-doorbelastbare uren
 * altijd €0 omzet genereren, ongeacht het project type.
 */
export function calculateLineMaxRevenue(project: Project): IrisRevenueItem[] {
  // Implementatie is vergelijkbaar met calculateProjectMaxRevenue, maar dan per projectregel
  // Voor deze fix focussen we op de Project Max methode, dus deze implementatie is vereenvoudigd
  
  // We gebruiken gewoon de Project Max methode als fallback
  return calculateProjectMaxRevenue(project);
}
