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
    .filter(item => item.lineOverBudget)
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
 * Bij deze methode worden alle uren vermenigvuldigd met het uurtarief van de projectregel,
 * maar er is een maximum op projectniveau. Zodra het totale projectbudget is bereikt,
 * worden extra uren niet meer omgezet in omzet.
 *
 * @param project Project waarvoor de omzet berekend moet worden
 * @returns Array van IrisRevenueItem met berekende omzet
 */
export function calculateProjectMaxRevenue(project: Project): IrisRevenueItem[] {
  // Geen speciale fix meer voor OLM project

  // Bereken het beschikbare budget voor dit jaar
  const totalBudget = project.projectBudget || 0;
  const previousYearBudgetUsed = project.previousYearBudgetUsed || 0;
  const availableBudget = Math.max(0, totalBudget - previousYearBudgetUsed);

  // Controleer of het project al over budget is van vorig jaar
  const isAlreadyOverBudget = previousYearBudgetUsed >= totalBudget;

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

  // Voor vaste prijs projecten: gebruik proportionele verdeling van het budget
  if (project.projectType === 'Vaste Prijs') {
    // Als het project al over budget is van vorig jaar, genereren alle uren €0 omzet
    // behalve voor nacalculatie regels binnen vaste prijs projecten
    if (isAlreadyOverBudget) {
      return project.monthlyItems.flatMap(items =>
        items.map(item => {
          // Controleer of deze uren op een specifieke projectregel zijn geschreven
          const projectLine = project.projectLines.find(line => line.id === item.projectLineId);

          // Bepaal de omzet op basis van het type projectregel
          if (projectLine?.invoicebasis?.id === INVOICE_BASIS.HOURLY_RATE) {
            // Nacalculatie regel binnen vaste prijs project: altijd tegen uurtarief
            return {
              ...item,
              revenue: item.hours * item.hourlyRate,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            };
          } else if (projectLine?.invoicebasis?.id === INVOICE_BASIS.NON_BILLABLE) {
            // Niet-doorbelastbare uren: altijd €0
            console.log(`DEBUG revenue-calculator-new: Niet-doorbelastbare uren voor project ${project.projectId} (${project.projectName}):`, {
              projectLineId: item.projectLineId,
              projectLineName: item.projectLineName,
              hours: item.hours,
              month: item.month,
              invoiceBasisId: projectLine?.invoicebasis?.id,
              invoiceBasisName: projectLine?.invoicebasis?.name
            });
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

    // CHRONOLOGISCHE AANPAK: Verwerk de maanden chronologisch en gebruik het budget op volgorde
    console.log(`Project ${project.projectName} (${project.projectId}): Budget €${totalBudget}, Verbruikt €${previousYearBudgetUsed}, Beschikbaar €${availableBudget}`);

    // Verzamel alle items per maand
    const monthlyData = project.monthlyItems.map((items, monthIndex) => {
      // Bereken de potentiële omzet voor vaste prijs regels
      let fixedPriceRevenue = 0;
      // Bereken de potentiële omzet voor nacalculatie regels
      let hourlyRateRevenue = 0;
      // Bereken de totale uren
      let totalHours = 0;

      // Bereken de potentiële omzet per type regel
      items.forEach(item => {
        totalHours += item.hours;

        // Controleer of deze uren op een specifieke projectregel zijn geschreven
        const projectLine = project.projectLines.find(line => line.id === item.projectLineId);

        // Bepaal de omzet op basis van het type projectregel
        if (projectLine?.invoicebasis?.id === INVOICE_BASIS.HOURLY_RATE) {
          // Nacalculatie regel binnen vaste prijs project: altijd tegen uurtarief
          hourlyRateRevenue += (item.hours * item.hourlyRate);
        } else if (projectLine?.invoicebasis?.id === INVOICE_BASIS.NON_BILLABLE) {
          // Niet-doorbelastbare uren: altijd €0
          // Geen omzet toevoegen
        } else {
          // Standaard vaste prijs regel: telt mee voor het budget
          fixedPriceRevenue += (item.hours * item.hourlyRate);
        }
      });

      return {
        monthIndex,
        items,
        totalHours,
        fixedPriceRevenue,
        hourlyRateRevenue,
        totalPotentialRevenue: fixedPriceRevenue + hourlyRateRevenue
      };
    }).filter(month => month.items.length > 0);

    // Sorteer de maanden chronologisch
    monthlyData.sort((a, b) => a.monthIndex - b.monthIndex);

    console.log(`Project ${project.projectName} (${project.projectId}): ${monthlyData.length} maanden met uren`);

    // Bereken de omzet per maand
    const result: IrisRevenueItem[] = [];
    let remainingBudget = availableBudget;

    // Verwerk elke maand chronologisch
    for (const month of monthlyData) {
      console.log(`Project ${project.projectName} (${project.projectId}): Maand ${month.monthIndex + 1}: ${month.totalHours} uren, €${month.fixedPriceRevenue} vaste prijs, €${month.hourlyRateRevenue} nacalculatie`);

      // Als er geen budget meer over is, genereer dan geen vaste prijs omzet meer
      if (remainingBudget <= 0) {
        console.log(`Project ${project.projectName} (${project.projectId}): Maand ${month.monthIndex + 1}: Geen budget meer over`);

        // Verwerk alle items in deze maand
        month.items.forEach(item => {
          // Controleer of deze uren op een specifieke projectregel zijn geschreven
          const projectLine = project.projectLines.find(line => line.id === item.projectLineId);

          // Bepaal de omzet op basis van het type projectregel
          if (projectLine?.invoicebasis?.id === INVOICE_BASIS.HOURLY_RATE) {
            // Nacalculatie regel binnen vaste prijs project: altijd tegen uurtarief
            result.push({
              ...item,
              revenue: item.hours * item.hourlyRate,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });
          } else if (projectLine?.invoicebasis?.id === INVOICE_BASIS.NON_BILLABLE) {
            // Niet-doorbelastbare uren: altijd €0
            console.log(`DEBUG revenue-calculator-new (no budget): Niet-doorbelastbare uren voor project ${project.projectId} (${project.projectName}):`, {
              projectLineId: item.projectLineId,
              projectLineName: item.projectLineName,
              hours: item.hours,
              month: item.month,
              invoiceBasisId: projectLine?.invoicebasis?.id,
              invoiceBasisName: projectLine?.invoicebasis?.name
            });
            result.push({
              ...item,
              revenue: 0,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });
          } else {
            // Vaste prijs regels: geen omzet meer
            result.push({
              ...item,
              revenue: 0,
              isOverBudget: true,
              lineOverBudget: false,
              adjustedDueToMaxBudget: true
            });
          }
        });
      }
      // Als er genoeg budget is voor deze maand
      else if (month.fixedPriceRevenue <= remainingBudget) {
        console.log(`Project ${project.projectName} (${project.projectId}): Maand ${month.monthIndex + 1}: Genoeg budget (€${remainingBudget}) voor vaste prijs (€${month.fixedPriceRevenue})`);

        // Verwerk alle items in deze maand
        month.items.forEach(item => {
          // Controleer of deze uren op een specifieke projectregel zijn geschreven
          const projectLine = project.projectLines.find(line => line.id === item.projectLineId);

          // Bepaal de omzet op basis van het type projectregel
          if (projectLine?.invoicebasis?.id === INVOICE_BASIS.HOURLY_RATE) {
            // Nacalculatie regel binnen vaste prijs project: altijd tegen uurtarief
            result.push({
              ...item,
              revenue: item.hours * item.hourlyRate,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });
          } else if (projectLine?.invoicebasis?.id === INVOICE_BASIS.NON_BILLABLE) {
            // Niet-doorbelastbare uren: altijd €0
            console.log(`DEBUG revenue-calculator-new (enough budget): Niet-doorbelastbare uren voor project ${project.projectId} (${project.projectName}):`, {
              projectLineId: item.projectLineId,
              projectLineName: item.projectLineName,
              hours: item.hours,
              month: item.month,
              invoiceBasisId: projectLine?.invoicebasis?.id,
              invoiceBasisName: projectLine?.invoicebasis?.name
            });
            result.push({
              ...item,
              revenue: 0,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });
          } else {
            // Vaste prijs regels: volledige omzet
            result.push({
              ...item,
              revenue: item.hours * item.hourlyRate,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });
          }
        });

        // Update het resterende budget
        remainingBudget -= month.fixedPriceRevenue;
        console.log(`Project ${project.projectName} (${project.projectId}): Maand ${month.monthIndex + 1}: Resterend budget na verwerking: €${remainingBudget}`);
      }
      // Als er niet genoeg budget is voor deze maand
      else {
        console.log(`Project ${project.projectName} (${project.projectId}): Maand ${month.monthIndex + 1}: Niet genoeg budget (€${remainingBudget}) voor vaste prijs (€${month.fixedPriceRevenue})`);

        // Bereken de ratio voor de verdeling van het beschikbare budget
        const ratio = month.fixedPriceRevenue > 0 ? remainingBudget / month.fixedPriceRevenue : 0;

        // Verwerk alle items in deze maand
        month.items.forEach(item => {
          // Controleer of deze uren op een specifieke projectregel zijn geschreven
          const projectLine = project.projectLines.find(line => line.id === item.projectLineId);

          // Bepaal de omzet op basis van het type projectregel
          if (projectLine?.invoicebasis?.id === INVOICE_BASIS.HOURLY_RATE) {
            // Nacalculatie regel binnen vaste prijs project: altijd tegen uurtarief
            result.push({
              ...item,
              revenue: item.hours * item.hourlyRate,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });
          } else if (projectLine?.invoicebasis?.id === INVOICE_BASIS.NON_BILLABLE) {
            // Niet-doorbelastbare uren: altijd €0
            console.log(`DEBUG revenue-calculator-new (not enough budget): Niet-doorbelastbare uren voor project ${project.projectId} (${project.projectName}):`, {
              projectLineId: item.projectLineId,
              projectLineName: item.projectLineName,
              hours: item.hours,
              month: item.month,
              invoiceBasisId: projectLine?.invoicebasis?.id,
              invoiceBasisName: projectLine?.invoicebasis?.name
            });
            result.push({
              ...item,
              revenue: 0,
              isOverBudget: false,
              lineOverBudget: false,
              adjustedDueToMaxBudget: false
            });
          } else {
            // Vaste prijs regels: gedeeltelijke omzet op basis van ratio
            result.push({
              ...item,
              revenue: item.hours * item.hourlyRate * ratio,
              isOverBudget: true,
              lineOverBudget: false,
              adjustedDueToMaxBudget: true
            });
          }
        });

        // Update het resterende budget (nu 0)
        remainingBudget = 0;
        console.log(`Project ${project.projectName} (${project.projectId}): Maand ${month.monthIndex + 1}: Budget is nu op`);
      }
    }

    // Bereken de totale omzet
    const totalRevenue = result.reduce((sum, item) => sum + item.revenue, 0);
    const totalFixedPriceActualRevenue = result.reduce((sum, item) => {
      // Controleer of deze uren op een specifieke projectregel zijn geschreven
      const projectLine = project.projectLines.find(line => line.id === item.projectLineId);

      // Tel alleen vaste prijs regels mee
      if (!projectLine ||
          (projectLine.invoicebasis &&
           projectLine.invoicebasis.id !== INVOICE_BASIS.HOURLY_RATE &&
           projectLine.invoicebasis.id !== INVOICE_BASIS.NON_BILLABLE)) {
        return sum + item.revenue;
      }
      return sum;
    }, 0);

    console.log(`Project ${project.projectName} (${project.projectId}): Totale omzet €${totalRevenue}`);
    console.log(`Project ${project.projectName} (${project.projectId}): Totale vaste prijs omzet €${totalFixedPriceActualRevenue}`);

    // Return het resultaat
    return result;
  }

  // Voor andere projecttypes: verwerk alle uren individueel
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
 * Bij deze methode worden uren vermenigvuldigd met het uurtarief van de projectregel,
 * maar er is een maximum per projectregel. Zodra het budget van een projectregel is bereikt,
 * worden extra uren op die regel niet meer omgezet in omzet.
 *
 * @param project Project waarvoor de omzet berekend moet worden
 * @returns Array van IrisRevenueItem met berekende omzet
 */
export function calculateLineMaxRevenue(project: Project): IrisRevenueItem[] {
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

  // Voor vaste prijs projecten: gebruik de projectregel max methode
  if (project.projectType === 'Vaste Prijs') {
    // Bereken het beschikbare budget per projectregel
    const linesBudget = new Map<number, { total: number, used: number, remaining: number }>();

    // Initialiseer het budget voor elke projectregel
    project.projectLines.forEach(line => {
      // Bereken het totale budget voor deze regel
      const totalBudget = line.amount * line.sellingprice;
      // Bereken hoeveel er al is gebruikt (amountwritten)
      const usedBudget = line.amountwritten * line.sellingprice;
      // Bereken hoeveel er nog over is
      const remainingBudget = Math.max(0, totalBudget - usedBudget);

      // Sla het budget op voor deze regel
      linesBudget.set(line.id, {
        total: totalBudget,
        used: usedBudget,
        remaining: remainingBudget
      });
    });

    // Verwerk alle uren per projectregel
    return project.monthlyItems.flatMap(items =>
      items.map(item => {
        // Controleer of deze uren op een specifieke projectregel zijn geschreven
        const projectLine = project.projectLines.find(line => line.id === item.projectLineId);

        // Als er geen projectregel is gevonden, of als het een nacalculatie of niet-doorbelastbare regel is,
        // gebruik dan de standaard berekening
        if (!projectLine) {
          return {
            ...item,
            revenue: item.hours * item.hourlyRate,
            isOverBudget: false,
            lineOverBudget: false,
            adjustedDueToMaxBudget: false
          };
        }

        // Bepaal de omzet op basis van het type projectregel
        if (projectLine.invoicebasis?.id === INVOICE_BASIS.HOURLY_RATE) {
          // Nacalculatie regel binnen vaste prijs project: altijd tegen uurtarief
          return {
            ...item,
            revenue: item.hours * item.hourlyRate,
            isOverBudget: false,
            lineOverBudget: false,
            adjustedDueToMaxBudget: false
          };
        } else if (projectLine.invoicebasis?.id === INVOICE_BASIS.NON_BILLABLE) {
          // Niet-doorbelastbare uren: altijd €0
          console.log(`DEBUG revenue-calculator-new (line max): Niet-doorbelastbare uren voor project ${project.projectId} (${project.projectName}):`, {
            projectLineId: item.projectLineId,
            projectLineName: item.projectLineName,
            hours: item.hours,
            month: item.month,
            invoiceBasisId: projectLine.invoicebasis?.id,
            invoiceBasisName: projectLine.invoicebasis?.name
          });
          return {
            ...item,
            revenue: 0,
            isOverBudget: false,
            lineOverBudget: false,
            adjustedDueToMaxBudget: false
          };
        }

        // Voor vaste prijs regels: controleer of er nog budget over is
        const lineBudget = linesBudget.get(projectLine.id);

        if (!lineBudget || lineBudget.remaining <= 0) {
          // Geen budget meer over voor deze regel
          return {
            ...item,
            revenue: 0,
            isOverBudget: true,
            lineOverBudget: true,
            adjustedDueToMaxBudget: true
          };
        }

        // Bereken de potentiële omzet voor deze uren
        const potentialRevenue = item.hours * item.hourlyRate;

        if (potentialRevenue <= lineBudget.remaining) {
          // Er is genoeg budget over voor deze uren
          // Update het resterende budget
          lineBudget.remaining -= potentialRevenue;
          linesBudget.set(projectLine.id, lineBudget);

          return {
            ...item,
            revenue: potentialRevenue,
            isOverBudget: false,
            lineOverBudget: false,
            adjustedDueToMaxBudget: false
          };
        } else {
          // Er is niet genoeg budget over voor deze uren
          // Gebruik het resterende budget
          const revenue = lineBudget.remaining;
          // Update het resterende budget (nu 0)
          lineBudget.remaining = 0;
          linesBudget.set(projectLine.id, lineBudget);

          return {
            ...item,
            revenue,
            isOverBudget: true,
            lineOverBudget: true,
            adjustedDueToMaxBudget: true
          };
        }
      })
    );
  }

  // Voor andere projecttypes: verwerk alle uren individueel
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
