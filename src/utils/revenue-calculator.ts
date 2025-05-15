/**
 * Revenue Calculator
 *
 * Dit bestand bevat functies voor het berekenen van omzet op basis van uren en projectgegevens.
 * Het ondersteunt twee verschillende berekeningsmethoden:
 * 1. Project Max: Uren worden gewaardeerd tot het maximum van het totale projectbudget
 * 2. Projectregel Max: Uren worden gewaardeerd tot het maximum van elke individuele projectregel
 */

import { IrisRevenueItem } from '../contexts/IrisContext';

// Constanten voor facturatiebasis IDs
export const INVOICE_BASIS = {
  FIXED_PRICE: 1,    // Vaste prijs
  HOURLY_RATE: 2,    // Nacalculatie
  SUBSCRIPTION: 3,   // Abonnement
  NON_BILLABLE: 4    // Niet doorbelastbaar
};

// Berekeningsmethoden voor vaste prijs projecten
export enum CalculationMethod {
  PROJECT_MAX = 'project_max',       // Project Max methode
  PROJECT_LINE_MAX = 'project_line_max'  // Projectregel Max methode
}

// Interface voor projectregel
export interface ProjectLine {
  id: number;
  amount: number;            // Gebudgetteerde uren
  amountwritten: number;     // Geschreven uren
  sellingprice: number;      // Verkoopprijs per uur
  invoicebasis: {
    id: number;              // Facturatiebasis ID
    searchname: string;      // Facturatiebasis naam
  };
}

// Interface voor project
export interface Project {
  id: number;
  projectId: number;
  projectName: string;
  clientName: string;
  projectType: string;       // Vaste prijs, Nacalculatie, Contract
  projectBudget: number;     // Totaal budget
  previousYearBudgetUsed: number; // Verbruikt budget vorig jaar
  projectLines: ProjectLine[]; // Projectregels
  monthlyItems: IrisRevenueItem[][]; // Uren per maand
}

// Interface voor het resultaat van de omzetberekening
export interface RevenueCalculationResult {
  items: IrisRevenueItem[];  // Berekende omzetitems
  totalRevenue: number;      // Totale omzet
  remainingBudget: number;   // Resterend budget
  isOverBudget: boolean;     // Is het project over budget
  linesOverBudget: number[]; // IDs van projectregels die over budget zijn
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
 * Bij deze methode worden uren berekend met het uurtarief van de betreffende projectregel TOTDAT de projectregel over budget gaat.
 * Als een projectregel over budget gaat, worden de uren van die projectregel verder berekend op basis van het LAAGSTE beschikbare
 * uurtarief van alle projectregels. Het totale omzet mag nooit over het beschikbare budget heen gaan. Als het budget op is,
 * zijn alle uren €0 waard.
 *
 * @param project Project waarvoor de omzet berekend moet worden
 * @returns Array van IrisRevenueItem met berekende omzet
 */
export function calculateProjectMaxRevenue(project: Project): IrisRevenueItem[] {
  // Definieer de variabelen op het hoogste niveau zodat ze overal beschikbaar zijn
  const totalBudget = project.projectBudget || 0;
  const previousYearBudgetUsed = project.previousYearBudgetUsed || 0;
  const availableBudget = Math.max(0, totalBudget - previousYearBudgetUsed);

  // Log voor debugging
  console.log(`Project ${project.projectName} (${project.projectId}): Totaal budget: €${totalBudget}, Verbruikt vorig jaar: €${previousYearBudgetUsed}, Beschikbaar: €${availableBudget}`);

  // Extra debug logging voor alle projecten
  console.log(`Project ${project.projectName} (${project.projectId}) budget berekening: ${totalBudget} - ${previousYearBudgetUsed} = ${availableBudget}`);

  // Controleer of het project al over budget is van vorig jaar
  const isAlreadyOverBudget = previousYearBudgetUsed >= totalBudget;
  console.log(`Project ${project.projectName} (${project.projectId}) isAlreadyOverBudget: ${isAlreadyOverBudget}`);

  // Extra debug logging voor projecten die al over budget zijn van vorig jaar
  if (isAlreadyOverBudget) {
    console.log(`Project ${project.projectName} (${project.projectId}) WAARSCHUWING: Project is al over budget van vorig jaar (${previousYearBudgetUsed} >= ${totalBudget}), beschikbaar budget is €0`);
  }

  // Voor interne projecten: alle uren genereren €0 omzet
  if (project.projectType === 'Intern') {
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
  if (project.projectType === 'Nacalculatie' || project.projectType === 'Offerte' || project.projectType === 'Contract') {
    return project.monthlyItems.flatMap(items =>
      items.map(item => ({
        ...item,
        revenue: item.hours * item.hourlyRate,
        isOverBudget: false,
        lineOverBudget: false,
        adjustedDueToMaxBudget: false
      }))
    );
  }

  // Voor vaste prijs projecten: implementeer de nieuwe logica
  if (project.projectType === 'Vaste Prijs') {
    // Als het project al over budget is van vorig jaar, genereren alle uren €0 omzet
    // behalve voor nacalculatie regels binnen vaste prijs projecten
    if (isAlreadyOverBudget) {
      console.log(`Project ${project.projectName} (${project.projectId}): Al over budget van vorig jaar, alle uren genereren €0 omzet`);
      return project.monthlyItems.flatMap(items =>
        items.map(item => {
          // Controleer of deze uren op een specifieke projectregel zijn geschreven
          const projectLine = project.projectLines.find(line => line.id === item.projectLineId);

          // Bepaal de omzet op basis van het type projectregel
          if (projectLine && projectLine.invoicebasis && projectLine.invoicebasis.id === INVOICE_BASIS.HOURLY_RATE) {
            // Nacalculatie regel binnen vaste prijs project: altijd tegen uurtarief, zelfs als het project over budget is
            return {
              ...item,
              revenue: item.hours * item.hourlyRate,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            };
          } else if (projectLine && projectLine.invoicebasis && projectLine.invoicebasis.id === INVOICE_BASIS.NON_BILLABLE) {
            // Niet-doorbelastbare uren: altijd €0
            return {
              ...item,
              revenue: 0,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            };
          }

          // Standaard voor vaste prijs regels: geen omzet als het project over budget is
          return {
            ...item,
            revenue: 0,
            isOverBudget: true,
            lineOverBudget: true,
            adjustedDueToMaxBudget: true
          };
        })
      );
    }

    console.log(`Project ${project.projectName} (${project.projectId}): Nieuwe Project Max methode toegepast`);
    console.log(`Project ${project.projectName} (${project.projectId}): Beschikbaar budget: €${availableBudget}`);

    // Stap 1: Verzamel alle uren per maand en per projectregel
    const monthlyLineItems: Record<number, Array<{ monthIndex: number, items: any[] }>> = {};

    // Initialiseer de structuur voor elke projectregel
    project.projectLines.forEach(line => {
      monthlyLineItems[line.id] = [];
      for (let month = 0; month < 12; month++) {
        monthlyLineItems[line.id].push({ monthIndex: month, items: [] });
      }
    });

    // Verzamel alle uren per maand en per projectregel
    for (let month = 0; month < 12; month++) {
      const monthItems = project.monthlyItems[month] || [];
      monthItems.forEach(item => {
        const projectLineId = item.projectLineId;
        if (projectLineId && monthlyLineItems[projectLineId]) {
          monthlyLineItems[projectLineId][month].items.push(item);
        } else {
          // Voor items zonder projectregel, maak een speciale categorie
          if (!monthlyLineItems[-1]) {
            monthlyLineItems[-1] = [];
            for (let m = 0; m < 12; m++) {
              monthlyLineItems[-1].push({ monthIndex: m, items: [] });
            }
          }
          monthlyLineItems[-1][month].items.push(item);
        }
      });
    }

    // Stap 2: Bereken het budget per projectregel
    const lineBudgets: Record<number, number> = {};
    project.projectLines.forEach(line => {
      // Voor vaste prijs regels: gebruik het aantal uren * uurtarief als budget
      if (!line.invoicebasis ||
          (line.invoicebasis.id !== INVOICE_BASIS.HOURLY_RATE &&
           line.invoicebasis.id !== INVOICE_BASIS.NON_BILLABLE)) {
        lineBudgets[line.id] = (line.amount || 0) * (line.sellingprice || 0);
      }
    });

    // Stap 3: Vind het laagste uurtarief van alle projectregels
    let lowestHourlyRate = Number.MAX_VALUE;
    project.projectLines.forEach(line => {
      if (line.sellingprice && line.sellingprice > 0 && line.sellingprice < lowestHourlyRate) {
        lowestHourlyRate = line.sellingprice;
      }
    });

    // Als er geen geldig uurtarief is gevonden, gebruik een standaardwaarde
    if (lowestHourlyRate === Number.MAX_VALUE) {
      lowestHourlyRate = 0;
    }

    console.log(`Project ${project.projectName} (${project.projectId}): Laagste uurtarief: €${lowestHourlyRate}`);

    // Stap 4: Bereken de omzet per uur volgens de nieuwe methode
    const result: IrisRevenueItem[] = [];
    let totalUsedBudget = 0;

    // Verwerk alle uren chronologisch per maand
    for (let month = 0; month < 12; month++) {
      // Verwerk eerst alle nacalculatie regels (deze genereren altijd omzet)
      for (const projectLine of project.projectLines) {
        if (projectLine.invoicebasis && projectLine.invoicebasis.id === INVOICE_BASIS.HOURLY_RATE) {
          const monthData = monthlyLineItems[projectLine.id][month];
          monthData.items.forEach(item => {
            const revenue = item.hours * item.hourlyRate;
            result.push({
              ...item,
              revenue,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });
          });
        } else if (projectLine.invoicebasis && projectLine.invoicebasis.id === INVOICE_BASIS.NON_BILLABLE) {
          // Niet-doorbelastbare uren: altijd €0
          const monthData = monthlyLineItems[projectLine.id][month];
          monthData.items.forEach(item => {
            result.push({
              ...item,
              revenue: 0,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });
          });
        }
      }

      // Verwerk vervolgens alle vaste prijs regels
      for (const projectLine of project.projectLines) {
        // Sla nacalculatie en niet-doorbelastbare regels over (die zijn al verwerkt)
        if ((projectLine.invoicebasis && projectLine.invoicebasis.id === INVOICE_BASIS.HOURLY_RATE) ||
            (projectLine.invoicebasis && projectLine.invoicebasis.id === INVOICE_BASIS.NON_BILLABLE)) {
          continue;
        }

        const monthData = monthlyLineItems[projectLine.id][month];
        const lineBudget = lineBudgets[projectLine.id] || 0;
        let lineUsedBudget = 0;

        // Bereken hoeveel budget er al is gebruikt voor deze regel
        for (let m = 0; m < month; m++) {
          const prevMonthData = monthlyLineItems[projectLine.id][m];
          prevMonthData.items.forEach(item => {
            lineUsedBudget += item.hours * item.hourlyRate;
          });
        }

        // Bereken hoeveel budget er nog over is voor deze regel
        const lineRemainingBudget = Math.max(0, lineBudget - lineUsedBudget);

        // Bereken de potentiële omzet voor deze maand
        const potentialRevenue = monthData.items.reduce((sum: number, item: any) => sum + (item.hours * item.hourlyRate), 0);

        if (potentialRevenue === 0) {
          // Geen uren in deze maand
          continue;
        }

        // Controleer of de regel over budget gaat
        if (lineRemainingBudget >= potentialRevenue) {
          // Er is genoeg budget voor deze regel in deze maand
          // Controleer of het totale projectbudget niet wordt overschreden
          if (totalUsedBudget + potentialRevenue <= availableBudget) {
            // Er is genoeg budget op projectniveau
            monthData.items.forEach(item => {
              const revenue = item.hours * item.hourlyRate;
              result.push({
                ...item,
                revenue,
                isOverBudget: false,
                lineOverBudget: false,
                adjustedDueToMaxBudget: false
              });
            });
            totalUsedBudget += potentialRevenue;
          } else {
            // Er is niet genoeg budget op projectniveau
            const remainingProjectBudget = Math.max(0, availableBudget - totalUsedBudget);
            if (remainingProjectBudget <= 0) {
              // Geen budget meer over op projectniveau
              monthData.items.forEach(item => {
                result.push({
                  ...item,
                  revenue: 0,
                  isOverBudget: true,
                  lineOverBudget: false,
                  adjustedDueToMaxBudget: true
                });
              });
            } else {
              // Gedeeltelijk budget over op projectniveau
              const ratio = remainingProjectBudget / potentialRevenue;
              monthData.items.forEach(item => {
                const revenue = item.hours * item.hourlyRate * ratio;
                result.push({
                  ...item,
                  revenue,
                  isOverBudget: true,
                  lineOverBudget: false,
                  adjustedDueToMaxBudget: true
                });
              });
              totalUsedBudget = availableBudget;
            }
          }
        } else {
          // De regel gaat over budget in deze maand
          // Bereken hoeveel omzet er nog gegenereerd kan worden met het normale tarief
          const normalRateRevenue = Math.min(lineRemainingBudget, potentialRevenue);

          // Bereken hoeveel omzet er nog gegenereerd kan worden met het laagste tarief
          const remainingHours = monthData.items.reduce((sum: number, item: any) => sum + item.hours, 0) - (normalRateRevenue / (projectLine.sellingprice || 1));
          const lowRateRevenue = remainingHours * lowestHourlyRate;

          // Totale potentiële omzet voor deze maand
          const totalPotentialRevenue = normalRateRevenue + lowRateRevenue;

          // Controleer of het totale projectbudget niet wordt overschreden
          if (totalUsedBudget + totalPotentialRevenue <= availableBudget) {
            // Er is genoeg budget op projectniveau
            // Verdeel de uren over normaal tarief en laag tarief
            let remainingNormalBudget = normalRateRevenue;

            monthData.items.forEach(item => {
              const normalRateHours = Math.min(item.hours, remainingNormalBudget / item.hourlyRate);
              const lowRateHours = item.hours - normalRateHours;

              const normalRateRevenueForItem = normalRateHours * item.hourlyRate;
              const lowRateRevenueForItem = lowRateHours * lowestHourlyRate;

              remainingNormalBudget -= normalRateRevenueForItem;

              result.push({
                ...item,
                revenue: normalRateRevenueForItem + lowRateRevenueForItem,
                isOverBudget: lowRateHours > 0,
                lineOverBudget: true,
                adjustedDueToMaxBudget: lowRateHours > 0
              });
            });

            totalUsedBudget += totalPotentialRevenue;
          } else {
            // Er is niet genoeg budget op projectniveau
            const remainingProjectBudget = Math.max(0, availableBudget - totalUsedBudget);

            if (remainingProjectBudget <= 0) {
              // Geen budget meer over op projectniveau
              monthData.items.forEach(item => {
                result.push({
                  ...item,
                  revenue: 0,
                  isOverBudget: true,
                  lineOverBudget: true,
                  adjustedDueToMaxBudget: true
                });
              });
            } else {
              // Gedeeltelijk budget over op projectniveau
              // Verdeel het resterende budget proportioneel over de items
              const ratio = remainingProjectBudget / totalPotentialRevenue;

              monthData.items.forEach(item => {
                const normalRateHours = Math.min(item.hours, lineRemainingBudget / item.hourlyRate);
                const lowRateHours = item.hours - normalRateHours;

                const normalRateRevenueForItem = normalRateHours * item.hourlyRate;
                const lowRateRevenueForItem = lowRateHours * lowestHourlyRate;
                const totalRevenueForItem = normalRateRevenueForItem + lowRateRevenueForItem;

                result.push({
                  ...item,
                  revenue: totalRevenueForItem * ratio,
                  isOverBudget: true,
                  lineOverBudget: true,
                  adjustedDueToMaxBudget: true
                });
              });

              totalUsedBudget = availableBudget;
            }
          }
        }
      }

      // Verwerk items zonder projectregel
      if (monthlyLineItems[-1]) {
        const monthData = monthlyLineItems[-1][month];
        const potentialRevenue = monthData.items.reduce((sum: number, item: any) => sum + (item.hours * item.hourlyRate), 0);

        if (potentialRevenue === 0) {
          // Geen uren in deze maand
          continue;
        }

        // Controleer of het totale projectbudget niet wordt overschreden
        if (totalUsedBudget + potentialRevenue <= availableBudget) {
          // Er is genoeg budget op projectniveau
          monthData.items.forEach(item => {
            const revenue = item.hours * item.hourlyRate;
            result.push({
              ...item,
              revenue,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });
          });
          totalUsedBudget += potentialRevenue;
        } else {
          // Er is niet genoeg budget op projectniveau
          const remainingProjectBudget = Math.max(0, availableBudget - totalUsedBudget);

          if (remainingProjectBudget <= 0) {
            // Geen budget meer over op projectniveau
            monthData.items.forEach(item => {
              result.push({
                ...item,
                revenue: 0,
                isOverBudget: true,
                lineOverBudget: false,
                adjustedDueToMaxBudget: true
              });
            });
          } else {
            // Gedeeltelijk budget over op projectniveau
            const ratio = remainingProjectBudget / potentialRevenue;

            monthData.items.forEach(item => {
              const revenue = item.hours * item.hourlyRate * ratio;
              result.push({
                ...item,
                revenue,
                isOverBudget: true,
                lineOverBudget: false,
                adjustedDueToMaxBudget: true
              });
            });

            totalUsedBudget = availableBudget;
          }
        }
      }
    }

    return result;
  }

  // Verwerk alle uren individueel voor andere projecttypes
  return project.monthlyItems.flatMap(items => {
    return items.map(item => {
      let revenue = 0;

      // Bepaal hoe de omzet berekend moet worden op basis van projecttype
      if (project.projectType === 'Intern') {
        // Interne projecten genereren geen omzet
        revenue = 0;
      } else if (project.projectType === 'Nacalculatie' || project.projectType === 'Offerte' || project.projectType === 'Contract') {
        // Voor nacalculatie, offerte en contract projecten: alle uren worden altijd vermenigvuldigd met het uurtarief
        revenue = item.hours * item.hourlyRate;
      } else {
        // Voor andere projecttypes: gebruik standaard berekening
        revenue = item.hours * item.hourlyRate;
      }

      return {
        ...item,
        revenue,
        isOverBudget: false,
        lineOverBudget: false,
        adjustedDueToMaxBudget: false
      };
    });
  });
}

/**
 * Bereken omzet voor een project met de Projectregel Max methode
 *
 * Bij deze methode worden alle uren berekend met het uurtarief van de betreffende projectregel,
 * zolang de projectregel budget heeft. Als een projectregel geen budget meer heeft, zijn de uren
 * op die regel €0 waard. Deze berekening hoeft niet rekening te houden met het totale projectbudget.
 *
 * @param project Project waarvoor de omzet berekend moet worden
 * @returns Array van IrisRevenueItem met berekende omzet
 */
export function calculateLineMaxRevenue(project: Project): IrisRevenueItem[] {
  const result: IrisRevenueItem[] = [];

  // Bereken het beschikbare budget voor dit jaar
  const totalBudget = project.projectBudget || 0;
  const previousYearBudgetUsed = project.previousYearBudgetUsed || 0;
  const availableBudget = Math.max(0, totalBudget - previousYearBudgetUsed);

  // Log voor debugging
  console.log(`Project ${project.projectName} (${project.projectId}): Totaal budget: €${totalBudget}, Verbruikt vorig jaar: €${previousYearBudgetUsed}, Beschikbaar: €${availableBudget}`);

  // Extra debug logging voor budget berekening
  console.log(`Project ${project.projectName} (${project.projectId}) budget berekening (LineMax): ${totalBudget} - ${previousYearBudgetUsed} = ${availableBudget}`);

  // Controleer of het project al over budget is van vorig jaar
  const isAlreadyOverBudget = previousYearBudgetUsed >= totalBudget;
  console.log(`Project ${project.projectName} (${project.projectId}) isAlreadyOverBudget: ${isAlreadyOverBudget}`);

  // Extra debug logging voor projecten die al over budget zijn van vorig jaar
  if (isAlreadyOverBudget) {
    console.log(`Project ${project.projectName} (${project.projectId}) WAARSCHUWING (LineMax): Project is al over budget van vorig jaar (${previousYearBudgetUsed} >= ${totalBudget}), beschikbaar budget is €0`);
  }

  // Voor interne projecten: alle uren genereren €0 omzet
  if (project.projectType === 'Intern') {
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
  if (project.projectType === 'Nacalculatie' || project.projectType === 'Offerte' || project.projectType === 'Contract') {
    return project.monthlyItems.flatMap(items =>
      items.map(item => ({
        ...item,
        revenue: item.hours * item.hourlyRate,
        isOverBudget: false,
        lineOverBudget: false,
        adjustedDueToMaxBudget: false
      }))
    );
  }

  // Voor vaste prijs projecten: implementeer de nieuwe logica
  if (project.projectType === 'Vaste Prijs') {
    console.log(`Project ${project.projectName} (${project.projectId}): Nieuwe Projectregel Max methode toegepast`);

    // Stap 1: Verzamel alle uren per projectregel
    const lineItems: Record<number, any[]> = {};

    // Initialiseer de structuur voor elke projectregel
    project.projectLines.forEach(line => {
      lineItems[line.id] = [];
    });

    // Verzamel alle uren per projectregel
    for (let month = 0; month < 12; month++) {
      const monthItems = project.monthlyItems[month] || [];
      monthItems.forEach(item => {
        const projectLineId = item.projectLineId;
        if (projectLineId && lineItems[projectLineId]) {
          lineItems[projectLineId].push(item);
        } else {
          // Voor items zonder projectregel, maak een speciale categorie
          if (!lineItems[-1]) {
            lineItems[-1] = [];
          }
          lineItems[-1].push(item);
        }
      });
    }

    // Stap 2: Bereken de omzet per projectregel
    for (const projectLine of project.projectLines) {
      const items = lineItems[projectLine.id] || [];

      // Sla lege projectregels over
      if (items.length === 0) {
        continue;
      }

      // Bepaal het type projectregel
      if (projectLine.invoicebasis && projectLine.invoicebasis.id === INVOICE_BASIS.HOURLY_RATE) {
        // Nacalculatie regel binnen vaste prijs project: altijd tegen uurtarief
        items.forEach(item => {
          result.push({
            ...item,
            revenue: item.hours * item.hourlyRate,
            isOverBudget: false,
            lineOverBudget: false,
            adjustedDueToMaxBudget: false
          });
        });
      } else if (projectLine.invoicebasis && projectLine.invoicebasis.id === INVOICE_BASIS.NON_BILLABLE) {
        // Niet-doorbelastbare uren: altijd €0
        items.forEach(item => {
          result.push({
            ...item,
            revenue: 0,
            isOverBudget: false,
            lineOverBudget: false,
            adjustedDueToMaxBudget: false
          });
        });
      } else {
        // Vaste prijs regel: bereken het budget en de gebruikte uren
        const lineBudgetHours = projectLine.amount || 0;
        let lineHoursWritten = 0;

        // Sorteer de items chronologisch (op datum)
        items.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateA.getTime() - dateB.getTime();
        });

        // Verwerk elk item chronologisch
        for (const item of items) {
          if (lineHoursWritten + item.hours <= lineBudgetHours) {
            // Er zijn nog genoeg uren binnen budget van deze regel
            result.push({
              ...item,
              revenue: item.hours * item.hourlyRate,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });

            lineHoursWritten += item.hours;
          } else if (lineHoursWritten < lineBudgetHours) {
            // Gedeeltelijk binnen budget
            const hoursWithinBudget = lineBudgetHours - lineHoursWritten;
            const hoursOverBudget = item.hours - hoursWithinBudget;

            result.push({
              ...item,
              revenue: hoursWithinBudget * item.hourlyRate,
              isOverBudget: true,
              lineOverBudget: true,
              adjustedDueToMaxBudget: true
            });

            lineHoursWritten = lineBudgetHours;
          } else {
            // Volledig over budget
            result.push({
              ...item,
              revenue: 0,
              isOverBudget: true,
              lineOverBudget: true,
              adjustedDueToMaxBudget: true
            });
          }
        }
      }
    }

    // Stap 3: Verwerk items zonder projectregel
    const itemsWithoutLine = lineItems[-1] || [];
    itemsWithoutLine.forEach(item => {
      // Voor items zonder projectregel: gebruik het uurtarief
      result.push({
        ...item,
        revenue: item.hours * item.hourlyRate,
        isOverBudget: false,
        lineOverBudget: false,
        adjustedDueToMaxBudget: false
      });
    });

    return result;
  }

  // Voor andere projecttypes dan vaste prijs: verwerk alle uren individueel
  if (project.projectType !== 'Vaste Prijs') {
    // Voor interne projecten: alle uren genereren €0 omzet
    if (project.projectType === 'Intern') {
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
    return project.monthlyItems.flatMap(items =>
      items.map(item => ({
        ...item,
        revenue: item.hours * item.hourlyRate,
        isOverBudget: false,
        lineOverBudget: false,
        adjustedDueToMaxBudget: false
      }))
    );
  }

  // Return een lege array als we hier komen (zou niet moeten gebeuren)
  return [];
}
