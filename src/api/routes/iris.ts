/**
 * IRIS Routes
 *
 * Dit bestand bevat routes voor de IRIS Revenue App.
 */
import express, { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { successResponse } from '../utils/response';
import { BadRequestError } from '../middleware/error-handler';
import axios from 'axios';
import dotenv from 'dotenv';

// Functie om de omzet te berekenen volgens de Project Max methode
const calculateProjectMaxRevenue = (project, availableBudget) => {
  // Initialiseer de resultaten
  const monthlyRevenue = Array(12).fill(0);
  const monthlyOverBudget = Array(12).fill(false);
  let totalRevenue = 0;
  let isOverBudget = false;

  // Groepeer de uren per maand
  const hoursByMonth = Array(12).fill(0).map(() => []);
  project.hourDetails.forEach(hour => {
    hoursByMonth[hour.month].push(hour);
  });

  // Bereken de potentiële omzet per maand
  const monthlyPotentialRevenue = Array(12).fill(0);

  // Bereken de potentiële omzet per maand en per regel
  for (let month = 0; month < 12; month++) {
    const monthHours = hoursByMonth[month];

    monthHours.forEach(hour => {
      // Bepaal de omzet op basis van het type regel
      if (hour.invoiceBasisId === 4) {
        // Niet-doorbelastbare uren genereren geen omzet
        // Doe niets
      } else if (hour.invoiceBasisId === 2) {
        // Nacalculatie regels binnen vaste prijs projecten
        // Deze uren worden altijd tegen het volledige uurtarief berekend
        const hourRevenue = hour.hours * hour.hourlyRate;
        monthlyPotentialRevenue[month] += hourRevenue;
      } else {
        // Vaste prijs regels
        const hourRevenue = hour.hours * hour.hourlyRate;
        monthlyPotentialRevenue[month] += hourRevenue;
      }
    });
  }

  // Bereken de werkelijke omzet per maand (chronologisch)
  let remainingBudget = availableBudget;

  for (let month = 0; month < 12; month++) {
    const monthHours = hoursByMonth[month];
    let monthRevenue = 0;

    // Bereken de omzet voor deze maand
    monthHours.forEach(hour => {
      if (hour.invoiceBasisId === 4) {
        // Niet-doorbelastbare uren genereren geen omzet
        // Doe niets
      } else if (hour.invoiceBasisId === 2) {
        // Nacalculatie regels binnen vaste prijs projecten
        // Deze uren worden altijd tegen het volledige uurtarief berekend
        const hourRevenue = hour.hours * hour.hourlyRate;
        monthRevenue += hourRevenue;
      } else {
        // Vaste prijs regels
        const hourRevenue = hour.hours * hour.hourlyRate;

        // Controleer of er nog budget beschikbaar is
        if (remainingBudget > 0) {
          if (hourRevenue <= remainingBudget) {
            // Er is genoeg budget voor deze uren
            monthRevenue += hourRevenue;
            remainingBudget -= hourRevenue;
          } else {
            // Er is niet genoeg budget voor deze uren
            monthRevenue += remainingBudget;

            // Markeer deze maand als over budget
            monthlyOverBudget[month] = true;
            isOverBudget = true;

            // Budget is nu op
            remainingBudget = 0;
          }
        } else {
          // Er is geen budget meer beschikbaar
          // Markeer deze maand als over budget
          monthlyOverBudget[month] = true;
          isOverBudget = true;
        }
      }
    });

    // Sla de omzet voor deze maand op
    monthlyRevenue[month] = monthRevenue;
    totalRevenue += monthRevenue;
  }

  return {
    monthlyRevenue,
    monthlyOverBudget,
    totalRevenue,
    isOverBudget,
    remainingBudget: availableBudget - totalRevenue
  };
};

// Functie om de omzet te berekenen volgens de Projectregel Max methode
const calculateLineMaxRevenue = (project, availableBudget) => {
  // Initialiseer de resultaten
  const monthlyRevenue = Array(12).fill(0);
  const monthlyOverBudget = Array(12).fill(false);
  let totalRevenue = 0;
  let isOverBudget = false;

  // Groepeer de uren per projectregel en per maand
  const hoursByLineAndMonth = new Map();

  project.hourDetails.forEach(hour => {
    const lineId = hour.projectLineId || 'unknown';
    if (!hoursByLineAndMonth.has(lineId)) {
      hoursByLineAndMonth.set(lineId, Array(12).fill(0).map(() => []));
    }
    hoursByLineAndMonth.get(lineId)[hour.month].push(hour);
  });

  // Bereken de budgetten per projectregel
  const lineBudgets = new Map();

  if (project.projectLines && Array.isArray(project.projectLines)) {
    project.projectLines.forEach(line => {
      if (line.id) {
        // Bereken het budget voor deze regel
        let lineBudget = 0;

        if (line.amount && line.sellingprice) {
          const amount = parseFloat(line.amount);
          const sellingPrice = parseFloat(line.sellingprice);

          if (!isNaN(amount) && !isNaN(sellingPrice)) {
            lineBudget = amount * sellingPrice;
          }
        }

        lineBudgets.set(line.id, lineBudget);
      }
    });
  }

  // Bereken de omzet per projectregel en per maand
  let remainingProjectBudget = availableBudget;

  // Houd bij hoeveel uren er al zijn geschreven per regel
  const lineHoursUsed = new Map();

  // Loop door alle maanden chronologisch
  for (let month = 0; month < 12; month++) {
    let monthRevenue = 0;

    // Loop door alle projectregels
    for (const [lineId, monthsData] of hoursByLineAndMonth.entries()) {
      const monthHours = monthsData[month];

      // Initialiseer de gebruikte uren voor deze regel als dat nog niet is gebeurd
      if (!lineHoursUsed.has(lineId)) {
        lineHoursUsed.set(lineId, 0);
      }

      // Loop door alle uren voor deze regel in deze maand
      monthHours.forEach(hour => {
        if (hour.invoiceBasisId === 4) {
          // Niet-doorbelastbare uren genereren geen omzet
          // Doe niets
        } else if (hour.invoiceBasisId === 2) {
          // Nacalculatie regels binnen vaste prijs projecten
          // Deze uren worden altijd tegen het volledige uurtarief berekend
          const hourRevenue = hour.hours * hour.hourlyRate;

          // Controleer of er nog budget beschikbaar is op projectniveau
          if (remainingProjectBudget > 0) {
            if (hourRevenue <= remainingProjectBudget) {
              // Er is genoeg budget voor deze uren
              monthRevenue += hourRevenue;
              remainingProjectBudget -= hourRevenue;
            } else {
              // Er is niet genoeg budget voor deze uren
              monthRevenue += remainingProjectBudget;

              // Markeer deze maand als over budget
              monthlyOverBudget[month] = true;
              isOverBudget = true;

              // Budget is nu op
              remainingProjectBudget = 0;
            }
          } else {
            // Er is geen budget meer beschikbaar
            // Markeer deze maand als over budget
            monthlyOverBudget[month] = true;
            isOverBudget = true;
          }
        } else {
          // Vaste prijs regels
          const lineBudget = lineBudgets.get(lineId) || 0;
          const lineHoursLimit = lineBudget / hour.hourlyRate; // Maximaal aantal uren voor deze regel
          const currentLineHours = lineHoursUsed.get(lineId);

          // Bereken hoeveel uren er nog beschikbaar zijn voor deze regel
          const availableLineHours = Math.max(0, lineHoursLimit - currentLineHours);

          if (availableLineHours > 0) {
            // Er zijn nog uren beschikbaar voor deze regel
            const usableHours = Math.min(hour.hours, availableLineHours);
            const hourRevenue = usableHours * hour.hourlyRate;

            // Controleer of er nog budget beschikbaar is op projectniveau
            if (remainingProjectBudget > 0) {
              if (hourRevenue <= remainingProjectBudget) {
                // Er is genoeg budget voor deze uren
                monthRevenue += hourRevenue;
                remainingProjectBudget -= hourRevenue;
              } else {
                // Er is niet genoeg budget voor deze uren
                monthRevenue += remainingProjectBudget;

                // Markeer deze maand als over budget
                monthlyOverBudget[month] = true;
                isOverBudget = true;

                // Budget is nu op
                remainingProjectBudget = 0;
              }
            } else {
              // Er is geen budget meer beschikbaar
              // Markeer deze maand als over budget
              monthlyOverBudget[month] = true;
              isOverBudget = true;
            }

            // Update de gebruikte uren voor deze regel
            lineHoursUsed.set(lineId, currentLineHours + usableHours);
          } else {
            // Er zijn geen uren meer beschikbaar voor deze regel
            // Markeer deze maand als over budget
            monthlyOverBudget[month] = true;
            isOverBudget = true;
          }
        }
      });
    }

    // Sla de omzet voor deze maand op
    monthlyRevenue[month] = monthRevenue;
    totalRevenue += monthRevenue;
  }

  return {
    monthlyRevenue,
    monthlyOverBudget,
    totalRevenue,
    isOverBudget,
    remainingBudget: availableBudget - totalRevenue
  };
};

// Globale variabelen om de status van synchronisatie bij te houden
declare global {
  var projectSyncInProgress: boolean;
  var offerSyncInProgress: boolean;
  var hoursSyncInProgress: boolean;
}

// Initialiseer de globale variabelen
global.projectSyncInProgress = false;
global.offerSyncInProgress = false;
global.hoursSyncInProgress = false;

const router = express.Router();

// Laad environment variables
dotenv.config();

// Gripp API configuratie
const GRIPP_API_URL = process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php';
const GRIPP_API_KEY = process.env.GRIPP_API_KEY;

console.log('Using Gripp API server:', GRIPP_API_URL);
console.log('Using Gripp API key:', GRIPP_API_KEY);

/**
 * GET /api/v1/iris/health
 *
 * Health check endpoint voor de IRIS API
 */
router.get('/health', async (_req: Request, res: Response) => {
  res.json(successResponse({ status: 'ok', message: 'IRIS API is running' }));
});

/**
 * POST /api/v1/iris/cache/clear
 *
 * Leegt de cache voor een specifiek jaar en type
 */
router.post('/cache/clear', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const type = req.query.type as string || 'all';

    console.log(`Clearing cache for year ${year}, type ${type}`);

    // Hier zou je normaal gesproken de cache leegmaken
    // Maar omdat we geen echte cache hebben, simuleren we dit

    // Stuur een succesbericht terug
    res.json(successResponse({
      status: 'ok',
      message: `Cache cleared for year ${year}, type ${type}`,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/iris/gripp-data
 *
 * Haalt data op uit Gripp voor de IRIS pagina
 *
 * Deze endpoint haalt projecten, uren en tags op uit Gripp en combineert deze
 * om een volledig overzicht te krijgen van de revenue per project per maand.
 */
router.get('/gripp-data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!GRIPP_API_KEY) {
      throw new BadRequestError('Gripp API key is niet geconfigureerd');
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    console.log(`Ophalen van Gripp data voor jaar ${year}`);

    // Functie om Gripp API aan te roepen
    const callGrippApi = async (resource: string, params: any = {}) => {
      try {
        console.log('Making API request to:', GRIPP_API_URL);
        console.log('API Key:', GRIPP_API_KEY);

        // Gebruik dezelfde structuur als in de werkende implementatie
        const requestData = {
          api_key: GRIPP_API_KEY,
          call: resource,
          params
        };

        console.log('Full request data:', JSON.stringify(requestData));

        const response = await axios.post(GRIPP_API_URL, requestData);

        if (response.data && response.data.response) {
          return response.data.response;
        }

        // Als de eerste methode faalt, probeer een andere methode
        if (!response.data || !response.data.response) {
          console.log('First method failed, trying alternative method with Authorization header');

          const requestData2 = {
            call: resource,
            params
          };

          const response2 = await axios.post(GRIPP_API_URL, requestData2, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${GRIPP_API_KEY}`
            }
          });

          if (response2.data && response2.data.response) {
            return response2.data.response;
          }

          // Als ook de tweede methode faalt, probeer de JSON-RPC formaat
          console.log('Second method failed, trying JSON-RPC format');

          const requestId = Math.floor(Math.random() * 10000000000);
          const requestData3 = [{
            method: resource.replace('/list', '.get').replace('/get', '.get'),
            params: [
              {}, // filters
              {   // options
                paging: {
                  firstresult: 0,
                  maxresults: params.options?.limit || 1000
                }
              }
            ],
            id: requestId
          }];

          const response3 = await axios.post(GRIPP_API_URL, requestData3, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${GRIPP_API_KEY}`
            }
          });

          if (response3.data && response3.data[0] && response3.data[0].result && response3.data[0].result.rows) {
            return response3.data[0].result.rows;
          }
        }

        console.error('All API request methods failed');
        return null;
      } catch (error) {
        console.error(`Fout bij aanroepen Gripp API (${resource}):`, error);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
        return null;
      }
    };

    // Haal projecten op uit Gripp
    const projects = await callGrippApi('projects/list', {
      options: {
        limit: 1000,
        offset: 0,
        sort: { id: 'ASC' }
      }
    });

    // Haal uren op uit Gripp voor het geselecteerde jaar
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const hours = await callGrippApi('hours/list', {
      options: {
        limit: 5000,
        offset: 0,
        sort: { date: 'ASC' },
        filter: {
          date: {
            from: startDate,
            to: endDate
          }
        }
      }
    });

    // Haal tags op uit Gripp
    const tags = await callGrippApi('tags/list', {
      options: {
        limit: 1000,
        offset: 0
      }
    });

    // Verwerk de data
    const processedData = [];

    if (hours && hours.length > 0 && projects && projects.length > 0) {
      console.log(`Verwerken van ${hours.length} uren en ${projects.length} projecten`);

      // Maak een map van project ID naar project
      const projectMap = new Map();
      projects.forEach(project => {
        projectMap.set(project.id, project);
      });

      // Maak een map van tag ID naar tag
      const tagMap = new Map();
      if (tags && tags.length > 0) {
        tags.forEach(tag => {
          tagMap.set(tag.id, tag);
        });
      }

      // Functie om project type te bepalen op basis van tags
      const getProjectType = (project) => {
        if (!project) return 'Verkeerde tag';

        // Gebruik het type veld uit de database als het beschikbaar is
        if (project.type) {
          console.log(`Project ${project.id} (${project.name}) heeft type: ${project.type} uit de database`);
          return project.type;
        }

        // Geen directe fixes meer voor specifieke projecten op basis van ID

        // STAP 1: Controleer tags volgens de specificatie
        if (project.tags) {
          let tags;

          // Converteer tags naar een array van objecten als het een string is
          if (typeof project.tags === 'string') {
            try {
              tags = JSON.parse(project.tags);
            } catch (e) {
              console.log(`Kon tags niet parsen voor project ${project.id} (${project.name}): ${project.tags}`);
              tags = [];
            }
          } else if (Array.isArray(project.tags)) {
            tags = project.tags;
          }

          // Controleer tags volgens de specificatie
          if (Array.isArray(tags)) {
            for (const tag of tags) {
              if (tag && typeof tag === 'object' && tag.id && tag.searchname) {
                // Check volgens de specificatie
                if (tag.id === '30' || tag.searchname === 'Intern') {
                  console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Intern op basis van tag`);
                  return 'Intern';
                }
                if (tag.id === '29' || tag.searchname === 'Contract') {
                  console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Contract op basis van tag`);
                  return 'Contract';
                }
                if (tag.id === '28' || tag.searchname === 'Vaste prijs') {
                  console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Vaste Prijs op basis van tag`);
                  return 'Vaste Prijs';
                }
                if (tag.id === '26' || tag.searchname === 'Nacalculatie') {
                  console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Nacalculatie op basis van tag`);
                  return 'Nacalculatie';
                }
              }
            }
          }
        }

        // STAP 2: Controleer projectnaam voor interne projecten
        if (project.name && typeof project.name === 'string') {
          const nameLower = project.name.toLowerCase();
          if (nameLower.includes('intern') || nameLower.includes('internal')) {
            console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Intern op basis van naam`);
            return 'Intern';
          }
        }

        // STAP 3: Controleer projectnaam voor service uren (meestal nacalculatie)
        if (project.name && typeof project.name === 'string') {
          const nameLower = project.name.toLowerCase();
          if (nameLower.includes('service') && nameLower.includes('uren')) {
            console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Nacalculatie op basis van naam (service uren)`);
            return 'Nacalculatie';
          }
        }

        // Als geen type is gevonden, markeer als "Verkeerde tag"
        console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Verkeerde tag omdat geen type is gevonden`);
        return 'Verkeerde tag';
      };

      // Groepeer uren per project en maand
      const hoursByProjectMonth = new Map();

      hours.forEach(hour => {
        if (!hour.project_id) return;

        const project = projectMap.get(hour.project_id);
        if (!project) return;

        // Bepaal de maand uit de datum
        const date = new Date(hour.date);
        const month = date.getMonth() + 1; // JavaScript maanden zijn 0-indexed

        const key = `${project.id}-${month}`;

        if (!hoursByProjectMonth.has(key)) {
          hoursByProjectMonth.set(key, {
            projectId: project.id,
            projectName: project.name,
            clientName: project.company ? project.company.searchname : 'Onbekend',
            month,
            hours: 0,
            projectType: getProjectType(project),
            projectBudget: project.totalexclvat || 0
          });
        }

        // Update hours
        const entry = hoursByProjectMonth.get(key);
        entry.hours += hour.amount;
        hoursByProjectMonth.set(key, entry);
      });

      // Converteer de map naar een array
      hoursByProjectMonth.forEach(entry => {
        processedData.push({
          id: `${entry.projectId}-${entry.month}`,
          projectId: entry.projectId,
          projectName: entry.projectName,
          clientName: entry.clientName,
          year,
          month: entry.month,
          revenue: entry.hours * 100, // Simpele berekening, kan worden verfijnd
          hours: entry.hours,
          hourlyRate: 100, // Default uurtarief
          isDefinite: true,
          projectType: entry.projectType,
          projectBudget: entry.projectBudget
        });
      });
    }

    // Stuur de verwerkte data terug
    res.json(successResponse({
      year,
      data: processedData,
      message: `${processedData.length} revenue records gevonden voor het jaar ${year}`
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/iris/sync-all
 *
 * Synchroniseert alle benodigde data uit Gripp:
 * - Projects (projecten)
 * - Hours (uren)
 * - Tags (tags)
 * - Offers (offertes)
 * - Projectofferlines (projectregels)
 *
 * Deze endpoint haalt alle data op uit Gripp en slaat deze op in de database.
 * Dit zorgt ervoor dat we altijd de meest recente data hebben.
 */
router.get('/sync-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!GRIPP_API_KEY) {
      throw new BadRequestError('Gripp API key is niet geconfigureerd');
    }

    console.log('Synchroniseren van alle data uit Gripp');

    // Functie om Gripp API aan te roepen
    const callGrippApi = async (resource: string, params: any = {}) => {
      try {
        console.log(`Making API request to ${resource}:`, GRIPP_API_URL);

        // Gebruik dezelfde structuur als in de werkende implementatie
        const requestData = {
          api_key: GRIPP_API_KEY,
          call: resource,
          params
        };

        const response = await axios.post(GRIPP_API_URL, requestData);

        if (response.data && response.data.response) {
          return response.data.response;
        }

        // Als de eerste methode faalt, probeer een andere methode
        if (!response.data || !response.data.response) {
          console.log('First method failed, trying alternative method with Authorization header');

          const requestData2 = {
            call: resource,
            params
          };

          const response2 = await axios.post(GRIPP_API_URL, requestData2, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${GRIPP_API_KEY}`
            }
          });

          if (response2.data && response2.data.response) {
            return response2.data.response;
          }

          // Als ook de tweede methode faalt, probeer de JSON-RPC formaat
          console.log('Second method failed, trying JSON-RPC format');

          const requestId = Math.floor(Math.random() * 10000000000);
          const requestData3 = [{
            method: resource.replace('/list', '.get').replace('/get', '.get'),
            params: [
              {}, // filters
              {   // options
                paging: {
                  firstresult: 0,
                  maxresults: params.options?.limit || 1000
                }
              }
            ],
            id: requestId
          }];

          const response3 = await axios.post(GRIPP_API_URL, requestData3, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${GRIPP_API_KEY}`
            }
          });

          if (response3.data && response3.data[0] && response3.data[0].result && response3.data[0].result.rows) {
            return response3.data[0].result.rows;
          }
        }

        console.error('All API request methods failed');
        return null;
      } catch (error) {
        console.error(`Fout bij aanroepen Gripp API (${resource}):`, error);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
        return null;
      }
    };

    // Haal alle benodigde data op uit Gripp
    console.log('Ophalen van projecten uit Gripp');
    const projects = await callGrippApi('projects/list', {
      options: {
        limit: 1000,
        offset: 0,
        sort: { id: 'ASC' }
      }
    });

    console.log('Ophalen van tags uit Gripp');
    const tags = await callGrippApi('tags/list', {
      options: {
        limit: 1000,
        offset: 0
      }
    });

    console.log('Ophalen van offertes uit Gripp');
    const offers = await callGrippApi('offerprojectbase/list', {
      options: {
        limit: 1000,
        offset: 0,
        sort: { id: 'ASC' }
      }
    });

    console.log('Ophalen van projectregels uit Gripp');
    const projectOfferLines = await callGrippApi('projectofferlines/list', {
      options: {
        limit: 1000,
        offset: 0,
        sort: { id: 'ASC' }
      }
    });

    // Haal uren op uit Gripp voor het huidige jaar
    const year = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    console.log(`Ophalen van uren uit Gripp voor jaar ${year}`);
    const hours = await callGrippApi('hours/list', {
      options: {
        limit: 5000,
        offset: 0,
        sort: { date: 'ASC' },
        filter: {
          date: {
            from: startDate,
            to: endDate
          }
        }
      }
    });

    // Sla de data op in de database
    const dbConnection = await getDatabase();

    // Maak de tabellen aan als ze nog niet bestaan
    try {
      await dbConnection.exec(`
        CREATE TABLE IF NOT EXISTS gripp_projects (
          id INTEGER PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbConnection.exec(`
        CREATE TABLE IF NOT EXISTS gripp_tags (
          id INTEGER PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbConnection.exec(`
        CREATE TABLE IF NOT EXISTS gripp_offers (
          id INTEGER PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbConnection.exec(`
        CREATE TABLE IF NOT EXISTS gripp_projectofferlines (
          id INTEGER PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbConnection.exec(`
        CREATE TABLE IF NOT EXISTS gripp_hours (
          id INTEGER PRIMARY KEY,
          data TEXT,
          year INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Begin een transactie
      await dbConnection.exec('BEGIN TRANSACTION');

      try {
        // Verwijder alle bestaande data
        await dbConnection.exec('DELETE FROM gripp_projects');
        await dbConnection.exec('DELETE FROM gripp_tags');
        await dbConnection.exec('DELETE FROM gripp_offers');
        await dbConnection.exec('DELETE FROM gripp_projectofferlines');
        await dbConnection.run('DELETE FROM gripp_hours WHERE year = ?', [year]);

        // Sla de nieuwe data op
        if (projects && projects.length > 0) {
          for (const project of projects) {
            await dbConnection.run(
              'INSERT INTO gripp_projects (id, data) VALUES (?, ?)',
              [project.id, JSON.stringify(project)]
            );
          }
          console.log(`${projects.length} projecten opgeslagen in de database`);
        }

        if (tags && tags.length > 0) {
          for (const tag of tags) {
            await dbConnection.run(
              'INSERT INTO gripp_tags (id, data) VALUES (?, ?)',
              [tag.id, JSON.stringify(tag)]
            );
          }
          console.log(`${tags.length} tags opgeslagen in de database`);
        }

        if (offers && offers.length > 0) {
          for (const offer of offers) {
            await dbConnection.run(
              'INSERT INTO gripp_offers (id, data) VALUES (?, ?)',
              [offer.id, JSON.stringify(offer)]
            );
          }
          console.log(`${offers.length} offertes opgeslagen in de database`);
        }

        if (projectOfferLines && projectOfferLines.length > 0) {
          for (const line of projectOfferLines) {
            await dbConnection.run(
              'INSERT INTO gripp_projectofferlines (id, data) VALUES (?, ?)',
              [line.id, JSON.stringify(line)]
            );
          }
          console.log(`${projectOfferLines.length} projectregels opgeslagen in de database`);
        }

        if (hours && hours.length > 0) {
          for (const hour of hours) {
            await dbConnection.run(
              'INSERT INTO gripp_hours (id, data, year) VALUES (?, ?, ?)',
              [hour.id, JSON.stringify(hour), year]
            );
          }
          console.log(`${hours.length} uren opgeslagen in de database voor jaar ${year}`);
        }

        // Commit de transactie
        await dbConnection.exec('COMMIT');
        console.log('Transactie succesvol afgerond');

        // Stuur een succesbericht terug
        res.json(successResponse({
          message: 'Alle data succesvol gesynchroniseerd',
          counts: {
            projects: projects ? projects.length : 0,
            tags: tags ? tags.length : 0,
            offers: offers ? offers.length : 0,
            projectOfferLines: projectOfferLines ? projectOfferLines.length : 0,
            hours: hours ? hours.length : 0
          }
        }));
      } catch (error) {
        // Rollback de transactie bij een fout
        await dbConnection.exec('ROLLBACK');
        console.error('Transactie teruggedraaid vanwege een fout:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error creating tables or executing transaction:', error);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/iris/revenue-direct
 *
 * Haalt revenue data direct op uit Gripp en formatteert het voor de RevenueTable component
 *
 * Deze endpoint haalt uren en projecten op uit Gripp, verwerkt deze en geeft ze terug
 * in het formaat dat de RevenueTable component verwacht.
 */
router.get('/revenue-direct', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!GRIPP_API_KEY) {
      throw new BadRequestError('Gripp API key is niet geconfigureerd');
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    console.log(`Ophalen van directe revenue data voor jaar ${year}`);

    // Functie om Gripp API aan te roepen
    const callGrippApi = async (resource: string, params: any = {}) => {
      try {
        console.log('Making API request to:', GRIPP_API_URL);
        console.log('API Key:', GRIPP_API_KEY);

        // Gebruik dezelfde structuur als in de werkende implementatie
        const requestData = {
          api_key: GRIPP_API_KEY,
          call: resource,
          params
        };

        console.log('Full request data:', JSON.stringify(requestData));

        const response = await axios.post(GRIPP_API_URL, requestData);

        if (response.data && response.data.response) {
          return response.data.response;
        }

        // Als de eerste methode faalt, probeer een andere methode
        if (!response.data || !response.data.response) {
          console.log('First method failed, trying alternative method with Authorization header');

          const requestData2 = {
            call: resource,
            params
          };

          const response2 = await axios.post(GRIPP_API_URL, requestData2, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${GRIPP_API_KEY}`
            }
          });

          if (response2.data && response2.data.response) {
            return response2.data.response;
          }

          // Als ook de tweede methode faalt, probeer de JSON-RPC formaat
          console.log('Second method failed, trying JSON-RPC format');

          const requestId = Math.floor(Math.random() * 10000000000);
          const requestData3 = [{
            method: resource.replace('/list', '.get').replace('/get', '.get'),
            params: [
              {}, // filters
              {   // options
                paging: {
                  firstresult: 0,
                  maxresults: params.options?.limit || 1000
                }
              }
            ],
            id: requestId
          }];

          const response3 = await axios.post(GRIPP_API_URL, requestData3, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${GRIPP_API_KEY}`
            }
          });

          if (response3.data && response3.data[0] && response3.data[0].result && response3.data[0].result.rows) {
            return response3.data[0].result.rows;
          }
        }

        console.error('All API request methods failed');
        return null;
      } catch (error) {
        console.error(`Fout bij aanroepen Gripp API (${resource}):`, error);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
        return null;
      }
    };

    // Haal projecten op uit Gripp
    const projects = await callGrippApi('projects/list', {
      options: {
        limit: 1000,
        offset: 0,
        sort: { id: 'ASC' }
      }
    });

    // Haal uren op uit Gripp voor het geselecteerde jaar
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const hours = await callGrippApi('hours/list', {
      options: {
        limit: 5000,
        offset: 0,
        sort: { date: 'ASC' },
        filter: {
          date: {
            from: startDate,
            to: endDate
          }
        }
      }
    });

    // Haal tags op uit Gripp
    const tags = await callGrippApi('tags/list', {
      options: {
        limit: 1000,
        offset: 0
      }
    });

    // Verwerk de data voor de RevenueTable component
    const tableData = [];

    if (hours && hours.length > 0 && projects && projects.length > 0) {
      console.log(`Verwerken van ${hours.length} uren en ${projects.length} projecten voor RevenueTable`);

      // Maak een map van project ID naar project
      const projectMap = new Map();
      projects.forEach(project => {
        projectMap.set(project.id, project);
      });

      // Maak een map van tag ID naar tag
      const tagMap = new Map();
      if (tags && tags.length > 0) {
        tags.forEach(tag => {
          tagMap.set(tag.id, tag);
        });
      }

      // Functie om project type te bepalen op basis van het type veld in de database
      const getProjectType = (project) => {
        if (!project) return 'Verkeerde tag';

        // Gebruik het type veld uit de database als het beschikbaar is
        if (project.type) {
          console.log(`Project ${project.id} (${project.name}) heeft type: ${project.type} uit de database`);
          return project.type;
        }

        // STAP 1: Controleer tags volgens de specificatie
        if (project.tags) {
          let tags;

          // Converteer tags naar een array van objecten als het een string is
          if (typeof project.tags === 'string') {
            try {
              tags = JSON.parse(project.tags);
            } catch (e) {
              console.log(`Kon tags niet parsen voor project ${project.id} (${project.name}): ${project.tags}`);
              tags = [];
            }
          } else if (Array.isArray(project.tags)) {
            tags = project.tags;
          }

          // Controleer tags volgens de specificatie
          if (Array.isArray(tags)) {
            for (const tag of tags) {
              if (tag && typeof tag === 'object' && tag.id && tag.searchname) {
                // Check volgens de specificatie
                if (tag.id === '30' || tag.searchname === 'Intern') {
                  console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Intern op basis van tag`);
                  return 'Intern';
                }
                if (tag.id === '29' || tag.searchname === 'Contract') {
                  console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Contract op basis van tag`);
                  return 'Contract';
                }
                if (tag.id === '28' || tag.searchname === 'Vaste prijs') {
                  console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Vaste Prijs op basis van tag`);
                  return 'Vaste Prijs';
                }
                if (tag.id === '26' || tag.searchname === 'Nacalculatie') {
                  console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Nacalculatie op basis van tag`);
                  return 'Nacalculatie';
                }
              }
            }
          }
        }

        // STAP 2: Controleer projectnaam voor interne projecten
        if (project.name && typeof project.name === 'string') {
          const nameLower = project.name.toLowerCase();
          if (nameLower.includes('intern') || nameLower.includes('internal')) {
            console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Intern op basis van naam`);
            return 'Intern';
          }
        }

        // STAP 3: Controleer projectnaam voor service uren (meestal nacalculatie)
        if (project.name && typeof project.name === 'string') {
          const nameLower = project.name.toLowerCase();
          if (nameLower.includes('service') && nameLower.includes('uren')) {
            console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Nacalculatie op basis van naam (service uren)`);
            return 'Nacalculatie';
          }
        }

        // Als geen type is gevonden, markeer als "Verkeerde tag"
        console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Verkeerde tag omdat geen type is gevonden`);
        return 'Verkeerde tag';
      };

      // Groepeer uren per project
      const hoursByProject = new Map();

      hours.forEach(hour => {
        if (!hour.project_id) return;

        const project = projectMap.get(hour.project_id);
        if (!project) return;

        // Bepaal de maand uit de datum (1-12)
        const date = new Date(hour.date);
        const month = date.getMonth() + 1;

        const projectId = project.id;

        if (!hoursByProject.has(projectId)) {
          hoursByProject.set(projectId, {
            id: projectId,
            name: project.name,
            clientName: project.company ? project.company.searchname : 'Onbekend',
            projectType: getProjectType(project),
            projectBudget: project.totalexclvat || 0,
            hours: 0,
            total: 0,
            monthlyHours: Array(12).fill(0),
            monthlyRevenue: Array(12).fill(0)
          });
        }

        // Update hours
        const entry = hoursByProject.get(projectId);
        entry.hours += hour.amount;
        entry.total += hour.amount * 100; // Simpele berekening, kan worden verfijnd
        entry.monthlyHours[month - 1] += hour.amount;
        entry.monthlyRevenue[month - 1] += hour.amount * 100;
        hoursByProject.set(projectId, entry);
      });

      // Converteer de map naar een array
      hoursByProject.forEach(entry => {
        tableData.push(entry);
      });
    }

    // Stuur de verwerkte data terug
    res.json(successResponse({
      year,
      data: tableData,
      message: `${tableData.length} projecten met revenue data gevonden voor het jaar ${year}`
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/iris/revenue
 *
 * Haal revenue data op voor IRIS
 *
 * Deze endpoint haalt revenue data op uit de database en combineert het met project data.
 * Het berekent de revenue per project per maand op basis van geschreven uren in Gripp.
 *
 * Verbeterde versie:
 * - Gebruikt echte uren data
 * - Probeert uren aan projecten te koppelen op basis van description
 * - Gebruikt IRIS tabellen voor aanvullende informatie
 */
router.get('/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Parse parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Helper functie om klantnaam uit projectnaam te extraheren
    const extractClientFromProjectName = (projectName: string): string => {
      if (!projectName) return 'Onbekend';

      // Patroon 1: "Klantnaam - Project beschrijving (nummer)"
      // Patroon 2: "Project beschrijving - Klantnaam (nummer)"

      // Verwijder het projectnummer tussen haakjes
      const nameWithoutNumber = projectName.replace(/\s*\(\d+\)\s*$/, '');

      // Specifieke bekende projectnamen met hun klantnamen
      const knownProjects: Record<string, string> = {
        'Aanvullende kleuren op de 2025': 'Mysteryland',
        'ADE - Begroting App - Fase 2': 'Amsterdam Dance Event',
        'Shopify API aanpassing': 'Friendly Fire',
        'Content vullen': 'Mysteryland',
        'DigitALL pilot aanvraag': 'Mysteryland',
        'B2B - Strategie sessie': 'USHUAÏA ENTERTAINMENT',
        'Extra sessie - Mysteryland 2025': 'Mysteryland',
        'Stock imagery': 'USHUAÏA ENTERTAINMENT',
        'Bijbegroting marcom sessie': 'Mysteryland',
        'Plus One Legal - Craft CMS beveiligingsupdate': 'Plus One Legal',
        'Service Hours - (Nacalculatie)': 'Bravoure',
        'Clay - Service hours 2025': 'Clay Hospitality',
        'Cultuur Ferry - Service hours 2025': 'Stichting Cultuur Ferry',
        'Bijbegroting marcom sessie - 16 april': 'Mysteryland',
        'Dynamics Koppeling - Courses': 'Lektor',
        'Dynamics prep': 'Ebbinge B.V.'
      };

      // Controleer eerst op exacte matches in de bekende projecten
      for (const [knownProject, clientName] of Object.entries(knownProjects)) {
        if (nameWithoutNumber.includes(knownProject)) {
          return clientName;
        }
      }

      // Split op " - " om de delen te krijgen
      const parts = nameWithoutNumber.split(' - ');

      if (parts.length >= 2) {
        // Als we geen match hebben gevonden, neem aan dat het eerste deel de klantnaam is
        // tenzij het eerste deel een generieke term bevat
        const genericTerms = ['service', 'project', 'development', 'design', 'internal', 'intern', 'aanvullende', 'extra', 'begroting', 'api', 'content', 'pilot', 'strategie', 'sessie', 'stock', 'imagery', 'bijbegroting', 'marcom', 'craft', 'cms', 'beveiligingsupdate'];
        const firstPartLower = parts[0].toLowerCase();
        const lastPartLower = parts[parts.length - 1].toLowerCase();

        const firstPartContainsGeneric = genericTerms.some(term => firstPartLower.includes(term.toLowerCase()));
        const lastPartContainsGeneric = genericTerms.some(term => lastPartLower.includes(term.toLowerCase()));

        if (firstPartContainsGeneric && !lastPartContainsGeneric) {
          return parts[parts.length - 1]; // Laatste deel is waarschijnlijk de klantnaam
        } else if (!firstPartContainsGeneric && lastPartContainsGeneric) {
          return parts[0]; // Eerste deel is waarschijnlijk de klantnaam
        } else {
          // Als beide delen generieke termen bevatten of geen van beide, neem het eerste deel
          return parts[0];
        }
      }

      // Controleer op specifieke woorden die vaak in projectnamen voorkomen
      if (projectName.includes('ADE')) return 'Amsterdam Dance Event';
      if (projectName.includes('Mysteryland')) return 'Mysteryland';
      if (projectName.includes('Friendly Fire')) return 'Friendly Fire';
      if (projectName.includes('Clay')) return 'Clay Hospitality';
      if (projectName.includes('UNVRS')) return 'USHUAÏA ENTERTAINMENT';
      if (projectName.includes('USHUAÏA')) return 'USHUAÏA ENTERTAINMENT';
      if (projectName.includes('Cultuur Ferry')) return 'Stichting Cultuur Ferry';
      if (projectName.includes('Plus One Legal')) return 'Plus One Legal';
      if (projectName.includes('Dynamics Koppeling')) return 'Lektor';
      if (projectName.includes('Dynamics prep')) return 'Ebbinge B.V.';

      // Als we hier komen, kunnen we geen klantnaam vinden
      return 'Onbekend';
    };

    // Helper functie om klantnaam op te halen uit hardcoded lijst
    const getClientNameFromHardcodedList = (projectName: string): string => {
      if (!projectName) return 'Onbekend';

      // Hardcoded lijst met projectnamen en bijbehorende klantnamen
      const projectClientMap: Record<string, string> = {
        // Shopify API aanpassing
        '3475': 'Friendly Fire',
        'Shopify API aanpassing': 'Friendly Fire',

        // Service Hours - (Nacalculatie)
        '3491': 'Bravoure',
        'Service Hours - (Nacalculatie)': 'Bravoure',

        // Cultuur Ferry - Service hours 2025
        '3490': 'Stichting Cultuur Ferry',
        'Cultuur Ferry - Service hours 2025': 'Stichting Cultuur Ferry',

        // Aanvullende kleuren op de 2025
        '3484': 'Mysteryland',
        'Aanvullende kleuren op de 2025': 'Mysteryland',

        // Bijbegroting marcom sessie - 16 april
        '3495': 'Mysteryland',
        'Bijbegroting marcom sessie - 16 april': 'Mysteryland',

        // Plus One Legal - Craft CMS beveiligingsupdate
        '3503': 'Plus One Legal',
        'Plus One Legal - Craft CMS beveiligingsupdate': 'Plus One Legal',

        // Stock imagery
        '3319': 'USHUAÏA ENTERTAINMENT',
        'Stock imagery': 'USHUAÏA ENTERTAINMENT',

        // Content vullen
        '3459': 'Mysteryland',
        'Content vullen': 'Mysteryland',

        // DigitALL pilot aanvraag
        '3460': 'Mysteryland',
        'DigitALL pilot aanvraag': 'Mysteryland',

        // ADE - Begroting App - Fase 2
        '3463': 'ADE',
        'ADE - Begroting App - Fase 2': 'ADE',

        // Extra sessie - Mysteryland 2025
        '3472': 'Extra sessie',
        'Extra sessie - Mysteryland 2025': 'Extra sessie',

        // B2B - Strategie sessie
        '3474': 'B2B',
        'B2B - Strategie sessie': 'B2B',

        // Lektor Platform vervolgfeatures
        '3478': 'Lektor Platform',
        'Lektor Platform vervolgfeatures': 'Lektor Platform',

        // Design B2B website The Night League
        '3482': 'Onbekend',
        'Design B2B website The Night League': 'Onbekend',

        // Maintenance and finetuning user project
        '3484': 'Onbekend',
        'Maintenance and finetuning user project': 'Onbekend',

        // Website - Warmoestraat Biënnale 2025
        '3485': 'Website',
        'Website - Warmoestraat Biënnale 2025': 'Website',

        // Dynamics Koppeling - Courses
        '5787': 'Ebbinge B.V.',
        '3434': 'Ebbinge B.V.',
        'Dynamics Koppeling - Courses': 'Ebbinge B.V.',
        'Dynamics Koppeling - Courses (3434)': 'Ebbinge B.V.',

        // Dynamics prep
        '5919': 'Ebbinge B.V.',
        '3510': 'Ebbinge B.V.',
        'Dynamics prep': 'Ebbinge B.V.',
        'Dynamics prep (3510)': 'Ebbinge B.V.'
      };

      // Controleer eerst op project ID
      if (projectClientMap[projectName]) {
        return projectClientMap[projectName];
      }

      // Controleer op projectnaam
      for (const [key, value] of Object.entries(projectClientMap)) {
        if (projectName.includes(key)) {
          return value;
        }
      }

      return 'Onbekend';
    };

    // Haal project-klant koppelingen op uit de database
    // Dit zijn projecten die niet in de projects tabel staan, maar wel in de hours tabel
    // We slaan deze op in een map voor snelle lookup
    const projectClientMap = new Map();

    try {
      // Controleer eerst of de projects tabel de juiste structuur heeft
      const tableInfo = await db.all(`PRAGMA table_info(projects)`);
      const hasCompanyField = tableInfo.some((column: any) => column.name === 'company');
      const hasCompanyIdField = tableInfo.some((column: any) => column.name === 'company_id');

      console.log(`Projects tabel heeft company veld: ${hasCompanyField}, company_id veld: ${hasCompanyIdField}`);

      // Pas de query aan op basis van de beschikbare velden
      let projectsFromDb;
      if (hasCompanyField) {
        projectsFromDb = await db.all(`
          SELECT id, name, company, json_extract(company, '$.searchname') as company_searchname
          FROM projects
          WHERE id IS NOT NULL
        `);
      } else {
        // Fallback query als de company veld niet bestaat
        projectsFromDb = await db.all(`
          SELECT id, name
          FROM projects
          WHERE id IS NOT NULL
        `);
      }

      console.log(`Found ${projectsFromDb.length} projects in projects table`);

      // Voeg deze toe aan de projectClientMap
      for (const project of projectsFromDb) {
        let clientName = 'Onbekend';

        // Gebruik eerst de direct geëxtraheerde company_searchname (meest betrouwbaar)
        if (project.company_searchname) {
          clientName = project.company_searchname;
        }
        // Als fallback, probeer de company informatie te parsen
        else if (project.company) {
          try {
            const companyData = JSON.parse(project.company);
            if (companyData && companyData.searchname) {
              clientName = companyData.searchname;
            }
          } catch (e) {
            // Geen geldige JSON, gebruik de company string direct
            if (typeof project.company === 'string' &&
                project.company.trim() !== '' &&
                project.company !== 'null' &&
                project.company !== 'undefined') {
              clientName = project.company;
            }
          }
        }

        // Als we nog steeds geen klantnaam hebben, probeer deze uit de projectnaam te halen
        if (clientName === 'Onbekend') {
          clientName = extractClientFromProjectName(project.name);
        }

        // Sla op in de map met project_id als key
        projectClientMap.set(project.id, {
          name: project.name,
          clientName: clientName
        });
      }

      // Haal nu alle unieke project_id, project_name combinaties op uit de hours tabel
      // voor projecten die niet in de projects tabel staan
      const projectsFromHours = await db.all(`
        SELECT DISTINCT h.project_id, h.project_name
        FROM hours h
        LEFT JOIN projects p ON h.project_id = p.id
        WHERE h.project_id IS NOT NULL AND h.project_name IS NOT NULL AND p.id IS NULL
      `);

      console.log(`Found ${projectsFromHours.length} unique projects in hours table that are not in projects table`);

      // Voeg deze toe aan de projectClientMap
      for (const project of projectsFromHours) {
        // Als het project al in de map staat, sla het over
        if (projectClientMap.has(project.project_id)) {
          continue;
        }

        // Probeer eerst de klantnaam op te halen uit de hardcoded lijst
        let clientName = getClientNameFromHardcodedList(project.project_id.toString());

        // Als dat niet lukt, probeer de klantnaam op te halen uit de hardcoded lijst op basis van projectnaam
        if (clientName === 'Onbekend') {
          clientName = getClientNameFromHardcodedList(project.project_name);
        }

        // Als dat ook niet lukt, probeer de klantnaam te extraheren uit de projectnaam
        if (clientName === 'Onbekend') {
          clientName = extractClientFromProjectName(project.project_name);
        }

        // Sla op in de map met project_id als key
        projectClientMap.set(project.project_id, {
          name: project.project_name,
          clientName: clientName
        });
      }

      console.log(`Added ${projectClientMap.size} total projects to projectClientMap`);
    } catch (error) {
      console.error('Error fetching project-client mappings:', error);
    }
    const forceRefresh = req.query.refresh === 'true';

    console.log(`Fetching revenue data for year ${year}`);

    // Haal alle employees op, inclusief inactieve medewerkers
    const employees = await db.all(`
      SELECT
        id,
        firstname,
        lastname,
        function,
        email,
        active
      FROM employees
    `);

    console.log(`Found ${employees.length} employees (including inactive ones)`);

    // Haal projecten op met meer details en parse de company JSON direct
    const projects = await db.all(`
      SELECT
        id,
        name,
        company,
        json_extract(company, '$.searchname') as company_searchname,
        number,
        clientreference,
        phase,
        totalexclvat as projectBudget,
        description,
        archived,
        archivedon,
        tags
      FROM projects
    `);

    console.log(`Found ${projects.length} active projects`);

    // Haal alle offertes op uit de database
    const offers = await db.all(`
      SELECT
        offer_id as offerId,
        offer_name as offerName,
        client_id as clientId,
        client_name as clientName,
        discr
      FROM iris_offers
    `);

    // Maak een map van offerte ID naar offerte informatie
    const offersMap = new Map();
    offers.forEach(offer => {
      offersMap.set(offer.offerId, offer);
    });

    console.log(`Loaded ${offers.length} offers from database`);

    // Haal "Budget Vorig Jaar" gegevens op
    const previousConsumptionData = await db.all(`
      SELECT
        project_id as projectId,
        previous_year_budget_used as previousYearBudgetUsed
      FROM iris_manual_project_previous_consumption
    `);

    // Maak een map van project_id naar previousYearBudgetUsed
    const previousConsumptionMap = new Map();
    previousConsumptionData.forEach(item => {
      previousConsumptionMap.set(item.projectId, item.previousYearBudgetUsed);
    });

    console.log(`Loaded ${previousConsumptionData.length} previous consumption records from database`);

    // Haal project revenue settings op
    const projectSettings = await db.all(`
      SELECT
        project_id,
        include_in_revenue,
        notes
      FROM iris_project_revenue_settings
    `);

    console.log(`Found ${projectSettings.length} project revenue settings`);

    // Maak een map van project_id naar include_in_revenue
    const projectIncludeMap = new Map();
    projectSettings.forEach(setting => {
      projectIncludeMap.set(setting.project_id, setting.include_in_revenue === 1);
    });

    // Haal gedetailleerde uren op voor het geselecteerde jaar
    // Controleer of er een project_id veld is in de hours tabel
    const tableInfo = await db.all(`PRAGMA table_info(hours)`);
    const hasProjectId = tableInfo.some((column: any) => column.name === 'project_id');

    let detailedHours;

    if (hasProjectId) {
      console.log('Hours tabel heeft een project_id veld, directe koppeling mogelijk');

      // Controleer of er uren zijn zonder project_id
      const hoursWithoutProjectId = await db.get(`
        SELECT COUNT(*) as count FROM hours
        WHERE (project_id IS NULL OR project_id = 0) AND date LIKE '${year}-%'
      `);

      if (hoursWithoutProjectId && hoursWithoutProjectId.count > 0) {
        console.log(`Er zijn ${hoursWithoutProjectId.count} uren zonder project_id, run het update-hours-project-id script`);
      }

      // Haal uren op met directe koppeling naar projecten - zonder filtering op status
      detailedHours = await db.all(`
        SELECT
          h.id,
          h.employee_id as employeeId,
          h.date,
          strftime('%m', h.date) as month,
          h.amount as hours,
          h.description,
          h.status_id,
          h.status_name,
          h.project_id as projectId,
          h.project_name,
          h.project_line_id,
          h.project_line_name,
          h.offerprojectbase_discr
        FROM hours h
        WHERE h.date LIKE '${year}-%'
        ORDER BY h.date
      `);

      console.log(`Found ${detailedHours.length} hour records for year ${year}`);
    } else {
      console.log('Hours tabel heeft geen project_id veld, koppeling via description nodig');
      // Haal uren op zonder directe koppeling
      detailedHours = await db.all(`
        SELECT
          h.id,
          h.employee_id as employeeId,
          h.date,
          strftime('%m', h.date) as month,
          h.amount as hours,
          h.description,
          h.status_id,
          h.status_name
        FROM hours h
        WHERE h.date LIKE '${year}-%'
        ORDER BY h.date
      `);
    }

    // Controleer of er een project_id veld is in de hours tabel
    // Als dat niet het geval is, proberen we het project_id veld toe te voegen
    if (!hasProjectId) {
      try {
        console.log('Project_id veld niet gevonden, proberen toe te voegen...');
        await db.run(`ALTER TABLE hours ADD COLUMN project_id INTEGER`);
        console.log('Project_id veld toegevoegd aan hours tabel');

        // Adviseer om het update-hours-project-id script te draaien
        console.log('Run het update-hours-project-id script om de project_id waarden in te vullen');
      } catch (error) {
        console.error('Fout bij toevoegen project_id veld:', error);
      }
    }

    console.log(`Found ${detailedHours.length} hour records for year ${year}`);

    // Functie om de Gripp API aan te roepen
    const callGrippApiForHourlyRate = async (resource: string, data: any): Promise<any> => {
      try {
        // Gebruik de bestaande callGrippApi functie als die beschikbaar is
        if (typeof callGrippApi === 'function') {
          return await callGrippApi(resource, data);
        }

        // Anders, gebruik de bestaande axios import
        const apiKey = process.env.GRIPP_API_KEY;
        if (!apiKey) {
          console.error('Gripp API key is niet geconfigureerd');
          return null;
        }

        // Gebruik de axios import die al in het bestand aanwezig is
        // of gebruik fetch als fallback
        let response;
        try {
          // Probeer axios te gebruiken als het beschikbaar is
          const url = 'https://api.gripp.com/public/api2.php';

          // Gebruik fetch als alternatief voor axios
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              api_key: apiKey,
              call: resource,
              data: data
            })
          });

          const responseData = await response.json();

          if (responseData && responseData.success) {
            return responseData.response;
          }
        } catch (fetchError) {
          console.error('Fout bij het gebruik van fetch:', fetchError);
        }

        return null;
      } catch (error: any) {
        console.error(`Fout bij aanroepen Gripp API (${resource}):`, error);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
        return null;
      }
    };

    // Functie om uurtarief te bepalen op basis van projectregel
    const getHourlyRate = async (_employee: any, projectId: number, projectLineId: number | null): Promise<number> => {
      // STAP 1: Probeer het uurtarief uit de projectregel te halen
      if (projectLineId) {
        try {
          // Haal de projectregel op uit de database
          const projectLine = await db.get(`
            SELECT id, project_id, selling_price
            FROM project_lines
            WHERE id = ? AND project_id = ?
          `, [projectLineId, projectId]);

          if (projectLine && projectLine.selling_price) {
            const sellingPrice = parseFloat(projectLine.selling_price);
            if (!isNaN(sellingPrice) && sellingPrice > 0) {
              console.log(`Uurtarief voor projectregel ${projectLineId} (project ${projectId}): €${sellingPrice}`);
              return sellingPrice;
            }
          }
        } catch (error) {
          console.error(`Fout bij ophalen uurtarief voor projectregel ${projectLineId}:`, error);
        }
      }

      // STAP 2: Als er geen projectregel is of het uurtarief kon niet worden opgehaald,
      // probeer dan het uurtarief uit de projectregels van het project te halen
      if (projectId) {
        try {
          // Haal alle projectregels op voor dit project
          const projectLines = await db.all(`
            SELECT id, project_id, selling_price
            FROM project_lines
            WHERE project_id = ? AND selling_price IS NOT NULL AND selling_price > 0
          `, [projectId]);

          if (projectLines && projectLines.length > 0) {
            // Bereken het gemiddelde uurtarief van alle projectregels
            let totalSellingPrice = 0;
            let validLineCount = 0;

            for (const line of projectLines) {
              if (line.selling_price) {
                const sellingPrice = parseFloat(line.selling_price);
                if (!isNaN(sellingPrice) && sellingPrice > 0) {
                  totalSellingPrice += sellingPrice;
                  validLineCount++;
                }
              }
            }

            if (validLineCount > 0) {
              const averageSellingPrice = totalSellingPrice / validLineCount;
              console.log(`Gemiddeld uurtarief voor project ${projectId}: €${averageSellingPrice.toFixed(2)} (${validLineCount} regels)`);
              return averageSellingPrice;
            }
          }
        } catch (error) {
          console.error(`Fout bij ophalen uurtarieven voor project ${projectId}:`, error);
        }
      }

      // STAP 3: Als we nog steeds geen uurtarief hebben, haal het op uit de Gripp API
      try {
        // Haal het project op uit de Gripp API
        const grippProject = await callGrippApiForHourlyRate(`project.get`, {
          id: projectId
        });

        if (grippProject && grippProject.sellingprice) {
          const sellingPrice = parseFloat(grippProject.sellingprice);
          if (!isNaN(sellingPrice) && sellingPrice > 0) {
            console.log(`Uurtarief voor project ${projectId} uit Gripp API: €${sellingPrice}`);
            return sellingPrice;
          }
        }
      } catch (error) {
        console.error(`Fout bij ophalen uurtarief uit Gripp API voor project ${projectId}:`, error);
      }

      // STAP 4: Als we nog steeds geen uurtarief hebben, gebruik een standaard uurtarief
      console.log(`Geen uurtarief gevonden voor project ${projectId}, projectregel ${projectLineId}. Gebruik standaard uurtarief van €100.`);
      return 100;
    };

    // Functie om project te vinden op basis van description
    const findProjectByDescription = (description: string): any => {
      if (!description) return null;

      // Normaliseer de beschrijving voor betere matching
      const normalizedDescription = description.toLowerCase().trim();

      // Zoek naar exacte project naam in description
      for (const project of projects) {
        if (project.name && project.name.trim() !== '' && normalizedDescription.includes(project.name.toLowerCase().trim())) {
          // Vermijd korte project namen die vaak voorkomen in andere beschrijvingen
          if (project.name.length > 3) {
            return project;
          }
        }
      }

      // Zoek naar client naam in description
      for (const project of projects) {
        // Gebruik eerst de direct geëxtraheerde company_searchname (meest betrouwbaar)
        if (project.company_searchname &&
            project.company_searchname.length > 3 &&
            normalizedDescription.includes(project.company_searchname.toLowerCase())) {
          return project;
        }
        // Als fallback, probeer de company informatie te parsen
        else if (project.company && typeof project.company === 'string') {
          try {
            const companyData = JSON.parse(project.company);
            if (companyData && companyData.searchname &&
                companyData.searchname.length > 3 &&
                normalizedDescription.includes(companyData.searchname.toLowerCase())) {
              return project;
            }
          } catch (e) {
            // Geen geldige JSON, negeer
          }
        }
      }

      // Zoek naar project nummer in description
      for (const project of projects) {
        if (project.number && description.includes(project.number.toString())) {
          return project;
        }
      }

      // Zoek naar client referentie in description
      for (const project of projects) {
        if (project.clientreference &&
            project.clientreference.trim() !== '' &&
            normalizedDescription.includes(project.clientreference.toLowerCase().trim())) {
          return project;
        }
      }

      // Zoek naar project ID in description (bijv. #123)
      const projectIdMatch = description.match(/#(\d+)/);
      if (projectIdMatch) {
        const projectId = parseInt(projectIdMatch[1]);
        const project = projects.find(p => p.id === projectId);
        if (project) return project;
      }

      // Zoek naar specifieke termen in de beschrijving
      if (normalizedDescription.includes('internal') || normalizedDescription.includes('intern')) {
        return projects.find(p => p.name && p.name.toLowerCase().includes('intern')) || null;
      }

      if (normalizedDescription.includes('service') || normalizedDescription.includes('onderhoud')) {
        return projects.find(p => p.name && p.name.toLowerCase().includes('service')) || null;
      }

      // Zoek naar woorden die vaak voorkomen in project namen
      const commonProjectKeywords = ['website', 'app', 'platform', 'development', 'design', 'implementatie', 'migration'];
      for (const keyword of commonProjectKeywords) {
        if (normalizedDescription.includes(keyword)) {
          // Zoek projecten die deze keyword in hun naam hebben
          const matchingProjects = projects.filter(p =>
            p.name && p.name.toLowerCase().includes(keyword)
          );

          if (matchingProjects.length === 1) {
            return matchingProjects[0];
          }
        }
      }

      return null;
    };

    // Functie om het juiste budget te bepalen
    const getProjectBudget = async (project: any, projectId: number): Promise<number> => {
      if (!project) return 0;

      console.log(`Calculating budget for project ${projectId} (${project.name || 'Unknown'})`);

      // Controleer of dit een vaste prijs project is
      let isFixedPriceProject = false;
      if (project.tags) {
        try {
          const tags = typeof project.tags === 'string' ? JSON.parse(project.tags) : project.tags;
          isFixedPriceProject = Array.isArray(tags) && tags.some(tag => {
            if (typeof tag === 'string') {
              return tag === "Vaste prijs" || tag === "28";
            }
            return (tag.searchname === "Vaste prijs") ||
                   (tag.name === "Vaste prijs") ||
                   (tag.id === "28") ||
                   (tag.id === 28);
          });

          console.log(`Project ${projectId} is ${isFixedPriceProject ? 'a fixed price project' : 'not a fixed price project'}`);
        } catch (e) {
          console.error(`Error parsing tags for project ${projectId}:`, e);
        }
      }

      // STAP 0: Haal het budget op uit de database
      try {
        const projectFromDb = await db.get(`
          SELECT id, name, totalexclvat, projectlines FROM projects WHERE id = ?
        `, [projectId]);

        if (projectFromDb) {
          console.log(`Found project ${projectId} in database: ${projectFromDb.name}`);

          // STAP 1: Gebruik totalexclvat uit de database
          if (projectFromDb.totalexclvat) {
            const budget = parseFloat(projectFromDb.totalexclvat);
            if (!isNaN(budget) && budget > 0) {
              console.log(`Project ${projectId} (${project.name}): Using budget from database: €${budget}`);
              return budget;
            } else {
              console.log(`Project ${projectId} (${project.name}): Database totalexclvat is invalid or zero: ${projectFromDb.totalexclvat}`);
            }
          } else {
            console.log(`Project ${projectId} (${project.name}): No totalexclvat in database`);
          }

          // STAP 2: Als het project geen totalexclvat heeft, kijk naar de projectregels in de database
          if (projectFromDb.projectlines) {
            try {
              console.log(`Project ${projectId} has projectlines in database`);
              // Parse de projectlines als het een string is
              const lines = typeof projectFromDb.projectlines === 'string'
                ? JSON.parse(projectFromDb.projectlines)
                : projectFromDb.projectlines;

              if (Array.isArray(lines) && lines.length > 0) {
                console.log(`Project ${projectId} has ${lines.length} projectlines`);

                // Controleer of er een totalexclvat veld is in de projectregels
                const lineWithTotal = lines.find(line => line.totalexclvat && parseFloat(line.totalexclvat) > 0);
                if (lineWithTotal) {
                  const budget = parseFloat(lineWithTotal.totalexclvat);
                  console.log(`Project ${projectId} (${project.name}): Using projectline totalexclvat: €${budget}`);
                  return budget;
                }

                // Als er geen totalexclvat is, bereken het budget op basis van amount * sellingprice
                let totalBudget = 0;
                let validLineCount = 0;

                for (const line of lines) {
                  // Skip group labels and non-billable lines
                  if (line.rowtype && (line.rowtype.id === 2 || line.rowtype.searchname === 'GROEPLABEL')) {
                    console.log(`Skipping group label line: ${line.searchname || 'Unknown'}`);
                    continue;
                  }

                  if (line.invoicebasis && line.invoicebasis.id === 4) {
                    console.log(`Skipping non-billable line: ${line.searchname || 'Unknown'}`);
                    continue;
                  }

                  // Log line details for debugging
                  console.log(`Processing line: ${line.searchname || 'Unknown'}, amount: ${line.amount}, sellingprice: ${line.sellingprice}`);

                  if (line.amount && line.sellingprice) {
                    const amount = parseFloat(line.amount);
                    const sellingPrice = parseFloat(line.sellingprice);

                    if (!isNaN(amount) && !isNaN(sellingPrice)) {
                      const lineBudget = amount * sellingPrice;
                      console.log(`Line budget: €${lineBudget} (${amount} * €${sellingPrice})`);
                      totalBudget += lineBudget;
                      validLineCount++;
                    } else {
                      console.log(`Invalid amount or sellingprice: amount=${line.amount}, sellingprice=${line.sellingprice}`);
                    }
                  } else {
                    console.log(`Missing amount or sellingprice for line: ${line.searchname || 'Unknown'}`);
                  }
                }

                if (totalBudget > 0) {
                  console.log(`Project ${projectId} (${project.name}): Calculated budget from ${validLineCount} projectlines: €${totalBudget}`);
                  return totalBudget;
                } else {
                  console.log(`Project ${projectId} (${project.name}): No valid budget lines found in projectlines`);
                }
              } else {
                console.log(`Project ${projectId} (${project.name}): Projectlines is not an array or is empty`);
              }
            } catch (e) {
              console.error(`Error parsing projectlines from database for project ${projectId}:`, e);
            }
          } else {
            console.log(`Project ${projectId} (${project.name}): No projectlines in database`);
          }
        } else {
          console.log(`Project ${projectId} not found in database`);
        }
      } catch (error) {
        console.error(`Error fetching project ${projectId} from database:`, error);
      }

      // STAP 3: Gebruik totalexclvat uit het project object
      if (project.totalexclvat && project.totalexclvat !== '0') {
        const budget = parseFloat(project.totalexclvat);
        if (!isNaN(budget) && budget > 0) {
          console.log(`Project ${projectId} (${project.name}): Using project totalexclvat: €${budget}`);
          return budget;
        } else {
          console.log(`Project ${projectId} (${project.name}): Project totalexclvat is invalid or zero: ${project.totalexclvat}`);
        }
      } else {
        console.log(`Project ${projectId} (${project.name}): No totalexclvat in project object`);
      }

      // STAP 4: Als het project geen totalexclvat heeft, kijk naar de projectregels in het project object
      if (project.projectlines) {
        try {
          console.log(`Project ${projectId} has projectlines in project object`);
          // Parse de projectlines als het een string is
          const lines = typeof project.projectlines === 'string'
            ? JSON.parse(project.projectlines)
            : project.projectlines;

          if (Array.isArray(lines) && lines.length > 0) {
            console.log(`Project ${projectId} has ${lines.length} projectlines in project object`);

            // Controleer of er een totalexclvat veld is in de projectregels
            const lineWithTotal = lines.find(line => line.totalexclvat && parseFloat(line.totalexclvat) > 0);
            if (lineWithTotal) {
              const budget = parseFloat(lineWithTotal.totalexclvat);
              console.log(`Project ${projectId} (${project.name}): Using projectline totalexclvat from project object: €${budget}`);
              return budget;
            }

            // Als er geen totalexclvat is, bereken het budget op basis van amount * sellingprice
            let totalBudget = 0;
            let validLineCount = 0;

            for (const line of lines) {
              // Skip group labels and non-billable lines
              if (line.rowtype && (line.rowtype.id === 2 || line.rowtype.searchname === 'GROEPLABEL')) {
                console.log(`Skipping group label line: ${line.searchname || 'Unknown'}`);
                continue;
              }

              if (line.invoicebasis && line.invoicebasis.id === 4) {
                console.log(`Skipping non-billable line: ${line.searchname || 'Unknown'}`);
                continue;
              }

              // Log line details for debugging
              console.log(`Processing line from project object: ${line.searchname || 'Unknown'}, amount: ${line.amount}, sellingprice: ${line.sellingprice}`);

              if (line.amount && line.sellingprice) {
                const amount = parseFloat(line.amount);
                const sellingPrice = parseFloat(line.sellingprice);

                if (!isNaN(amount) && !isNaN(sellingPrice)) {
                  const lineBudget = amount * sellingPrice;
                  console.log(`Line budget: €${lineBudget} (${amount} * €${sellingPrice})`);
                  totalBudget += lineBudget;
                  validLineCount++;
                } else {
                  console.log(`Invalid amount or sellingprice: amount=${line.amount}, sellingprice=${line.sellingprice}`);
                }
              } else {
                console.log(`Missing amount or sellingprice for line: ${line.searchname || 'Unknown'}`);
              }
            }

            if (totalBudget > 0) {
              console.log(`Project ${projectId} (${project.name}): Calculated budget from ${validLineCount} projectlines in project object: €${totalBudget}`);
              return totalBudget;
            } else {
              console.log(`Project ${projectId} (${project.name}): No valid budget lines found in projectlines in project object`);
            }
          } else {
            console.log(`Project ${projectId} (${project.name}): Projectlines in project object is not an array or is empty`);
          }
        } catch (e) {
          console.error(`Error parsing projectlines from project object for project ${projectId}:`, e);
        }
      } else {
        console.log(`Project ${projectId} (${project.name}): No projectlines in project object`);
      }

      // STAP 5: Check project_lines table in the database
      try {
        const projectLines = await db.all(`
          SELECT id, project_id, amount, selling_price, invoice_basis_id
          FROM project_lines
          WHERE project_id = ?
        `, [projectId]);

        if (projectLines && projectLines.length > 0) {
          console.log(`Found ${projectLines.length} lines in project_lines table for project ${projectId}`);

          let totalBudget = 0;
          let validLineCount = 0;

          for (const line of projectLines) {
            // Skip non-billable lines (invoice_basis_id = 4)
            if (line.invoice_basis_id === 4) {
              console.log(`Skipping non-billable line: ${line.id}`);
              continue;
            }

            // Log line details for debugging
            console.log(`Processing line from project_lines table: ${line.id}, amount: ${line.amount}, selling_price: ${line.selling_price}`);

            if (line.amount && line.selling_price) {
              const amount = parseFloat(line.amount);
              const sellingPrice = parseFloat(line.selling_price);

              if (!isNaN(amount) && !isNaN(sellingPrice)) {
                const lineBudget = amount * sellingPrice;
                console.log(`Line budget: €${lineBudget} (${amount} * €${sellingPrice})`);
                totalBudget += lineBudget;
                validLineCount++;
              } else {
                console.log(`Invalid amount or selling_price: amount=${line.amount}, selling_price=${line.selling_price}`);
              }
            } else {
              console.log(`Missing amount or selling_price for line: ${line.id}`);
            }
          }

          if (totalBudget > 0) {
            console.log(`Project ${projectId} (${project.name}): Calculated budget from ${validLineCount} lines in project_lines table: €${totalBudget}`);
            return totalBudget;
          } else {
            console.log(`Project ${projectId} (${project.name}): No valid budget lines found in project_lines table`);
          }
        } else {
          console.log(`No lines found in project_lines table for project ${projectId}`);
        }
      } catch (error) {
        console.error(`Error fetching project lines from project_lines table for project ${projectId}:`, error);
      }

      // STAP 6: Hardcoded budgetten voor specifieke projecten als fallback
      const hardcodedBudgets: Record<number, number> = {
        5898: 4750.00,  // Aanvullende kleuren op de 2025
        5632: 154154.00, // OLM - Phase 3A
        5857: 135166.00, // Merk & Website
        5899: 2031.00,   // SLA - Service uren - Maandelijks - 2025
        5924: 1215.00,   // Amsterdam Museum - Extra service uren Pop-up Window
        5927: 630.00,    // UNVRS - Site speed issues
        5926: 157.50,    // Double Shift - Important CMS Security Update
        5923: 162.50     // Plus One Legal - Craft CMS beveiligingsupdate
      };

      if (hardcodedBudgets[projectId]) {
        console.log(`Project ${projectId} (${project.name}): Using hardcoded budget: €${hardcodedBudgets[projectId]}`);
        return hardcodedBudgets[projectId];
      }

      // STAP 7: Als dit een vaste prijs project is zonder budget, log een waarschuwing
      if (isFixedPriceProject) {
        console.log(`WAARSCHUWING: Vaste prijs project ${projectId} (${project.name}) heeft geen budget in Gripp. Dit moet worden gecorrigeerd in Gripp.`);
      }

      // Als er geen budget is gevonden, return 0
      console.log(`Project ${projectId} (${project.name}): No budget found in Gripp data`);
      return 0;
    };

    // Functie om client naam te extraheren uit project of offerte
    const getClientName = (project: any): string => {
      if (!project) return 'Onbekend';

      // 1. Controleer eerst of het een offerte is en of we client informatie hebben in de offersMap
      if (project.discr === 'offer' || project.discr === 'offerte') {
        const offerInfo = offersMap.get(project.id);
        if (offerInfo && offerInfo.clientName) {
          console.log(`Offerte ${project.id} (${project.name}): Klantnaam gevonden in offersMap: ${offerInfo.clientName}`);
          return offerInfo.clientName;
        }
      }

      // 2. Controleer of we een directe koppeling hebben met een project in de database
      // Dit is de meest betrouwbare methode
      const projectFromDb = projects.find(p => p.id === project.id);
      if (projectFromDb) {
        // Gebruik eerst de direct geëxtraheerde company_searchname (meest betrouwbaar)
        if (projectFromDb.company_searchname && !isProjectLineName(projectFromDb.company_searchname)) {
          return projectFromDb.company_searchname;
        }

        // Als fallback, probeer de company informatie te parsen
        if (projectFromDb.company) {
          try {
            // Als company een JSON string is, probeer het te parsen
            if (typeof projectFromDb.company === 'string') {
              const companyData = JSON.parse(projectFromDb.company);
              if (companyData && companyData.searchname && !isProjectLineName(companyData.searchname)) {
                return companyData.searchname;
              }
            }
            // Als company een object is
            else if (typeof projectFromDb.company === 'object' && projectFromDb.company !== null) {
              if (projectFromDb.company.searchname && !isProjectLineName(projectFromDb.company.searchname)) {
                return projectFromDb.company.searchname;
              }
            }
          } catch (e) {
            // Geen geldige JSON, ga door naar de volgende methode
          }
        }
      }

      // 3. Controleer of we een koppeling hebben in de projectClientMap
      // Dit is voor projecten die alleen in de hours tabel staan
      if (project.id && projectClientMap.has(project.id)) {
        const projectInfo = projectClientMap.get(project.id);
        if (projectInfo && projectInfo.clientName && projectInfo.clientName !== 'Onbekend') {
          console.log(`Project ${project.id} (${project.name}): Klantnaam gevonden in projectClientMap: ${projectInfo.clientName}`);
          return projectInfo.clientName;
        }
      }

      // 4. Controleer of we een match hebben in de hardcoded projecten lijst
      const clientNameFromHardcodedList = getClientNameFromHardcodedList(project.name);
      if (clientNameFromHardcodedList !== 'Onbekend') {
        return clientNameFromHardcodedList;
      }

      // 5. Als company een JSON string is, probeer het te parsen
      if (project.company && typeof project.company === 'string') {
        try {
          const companyData = JSON.parse(project.company);
          if (companyData && companyData.searchname && !isProjectLineName(companyData.searchname)) {
            return companyData.searchname;
          } else if (companyData && companyData.name && !isProjectLineName(companyData.name)) {
            return companyData.name;
          }
        } catch (e) {
          // Geen geldige JSON, controleer of het een string is die we direct kunnen gebruiken
          if (project.company.trim() !== '' &&
              project.company !== 'null' &&
              project.company !== 'undefined' &&
              !isProjectLineName(project.company)) {
            return project.company;
          }
        }
      }
      // 6. Als company een object is (JSON-RPC formaat)
      else if (project.company && typeof project.company === 'object') {
        if (project.company.searchname && !isProjectLineName(project.company.searchname)) {
          return project.company.searchname;
        } else if (project.company.name && !isProjectLineName(project.company.name)) {
          return project.company.name;
        }
      }

      // 7. Probeer de klantnaam uit de projectnaam te extraheren
      const extractedClientName = extractClientFromProjectName(project.name);
      if (extractedClientName !== 'Onbekend') {
        return extractedClientName;
      }

      // Als we hier komen, hebben we geen geldige klantnaam kunnen vinden
      return 'Onbekend';
    };

    // Helper functie om te controleren of een string een projectregel naam is
    const isProjectLineName = (str: string): boolean => {
      if (!str) return false;

      const genericTerms = [
        'Service hours',
        '(Fixed)',
        '(ND / intern)',
        'Development',
        'Management',
        'Strategy',
        'Visual design',
        'Back-end',
        'Front-end',
        'Creative Direction',
        'Project Management'
      ];

      return genericTerms.some(term => str.includes(term));
    };





    // Functie om project type te bepalen op basis van het type veld in de database
    const getProjectType = (project: any): string => {
      if (!project) return 'Verkeerde tag';

      // Debug logging om te zien wat er in het project object zit
      console.log(`Project type bepalen voor project ${project.id} (${project.name})`);
      console.log(`Tags: ${project.tags}`);

      // Gebruik het type veld uit de database als het beschikbaar is
      if (project.type) {
        console.log(`Project ${project.id} (${project.name}) heeft type: ${project.type} uit de database`);
        return project.type;
      }

      // Controleer eerst of het een offerte is op basis van discr veld
      if (project.discr === 'offer' || project.discr === 'offerte' ||
          (project.offerprojectbase_discr && project.offerprojectbase_discr === 'offerte')) {
        return 'Offerte';
      }

      // STAP 0: Directe fixes voor specifieke projecten op basis van ID
      if (project.id) {
        // Fix voor "Internal hours 2024 (3222)"
        if (project.id === 3222 || project.id === 5368) {
          console.log(`DIRECTE FIX: Project ${project.id} (${project.name}) is handmatig gemarkeerd als Intern`);
          return 'Intern';
        }

        // Fix voor "Internal hours 2025 (3416)"
        if (project.id === 3416 || project.id === 5731) {
          console.log(`DIRECTE FIX: Project ${project.id} (${project.name}) is handmatig gemarkeerd als Intern`);
          return 'Intern';
        }

        // Fix voor "Boer & Croon - Bullhorn koppeling (3301)"
        if (project.id === 3301) {
          console.log(`DIRECTE FIX: Project ${project.id} (${project.name}) is handmatig gemarkeerd als Vaste Prijs`);
          return 'Vaste Prijs';
        }
      }

      // STAP 1: Controleer tags volgens de specificatie
      if (project.tags) {
        let tags;

        // Converteer tags naar een array van objecten als het een string is
        if (typeof project.tags === 'string') {
          try {
            tags = JSON.parse(project.tags);
            console.log(`Tags geparsed voor project ${project.id}: `, tags);
          } catch (e) {
            console.log(`Kon tags niet parsen voor project ${project.id} (${project.name}): ${project.tags}`);
            console.log(`Parse error: ${e.message}`);
            tags = [];
          }
        } else if (Array.isArray(project.tags)) {
          tags = project.tags;
          console.log(`Tags zijn al een array voor project ${project.id}: `, tags);
        } else {
          console.log(`Tags zijn geen string of array voor project ${project.id}: ${typeof project.tags}`);
          tags = [];
        }

        // Controleer tags volgens de specificatie
        if (Array.isArray(tags)) {
          for (const tag of tags) {
            console.log(`Controleren tag: `, tag);

            if (tag && typeof tag === 'object') {
              console.log(`Tag is een object met id: ${tag.id}, searchname: ${tag.searchname}`);

              // Check volgens de specificatie
              if (tag.id === '30' || (tag.searchname && tag.searchname === 'Intern')) {
                console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Intern op basis van tag`);
                return 'Intern';
              }
              if (tag.id === '29' || (tag.searchname && tag.searchname === 'Contract')) {
                console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Contract op basis van tag`);
                return 'Contract';
              }
              if (tag.id === '28' || (tag.searchname && tag.searchname === 'Vaste prijs')) {
                console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Vaste Prijs op basis van tag`);
                return 'Vaste Prijs';
              }
              if (tag.id === '26' || (tag.searchname && tag.searchname === 'Nacalculatie')) {
                console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Nacalculatie op basis van tag`);
                return 'Nacalculatie';
              }
            }
          }
        }
      }

      // STAP 2: Controleer projectnaam voor interne projecten
      if (project.name && typeof project.name === 'string') {
        const nameLower = project.name.toLowerCase();
        if (nameLower.includes('intern') || nameLower.includes('internal')) {
          console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Intern op basis van naam`);
          return 'Intern';
        }
      }



      // Als geen type is gevonden, markeer als "Verkeerde tag"
      console.log(`Project ${project.id} (${project.name}) is gemarkeerd als Verkeerde tag omdat geen type is gevonden`);
      return 'Verkeerde tag';
    };

    // Functie om project status te bepalen
    const getProjectStatus = (project: any): string => {
      if (!project) return 'Onbekend';

      // Als project gearchiveerd is, is de status 'Gearchiveerd'
      if (project.archived === 1) {
        return 'Gearchiveerd';
      }

      // Als phase een object is (JSON-RPC formaat)
      if (project.phase && typeof project.phase === 'object') {
        if (project.phase.searchname) {
          return project.phase.searchname;
        }
      }
      // Probeer phase te parsen als JSON string
      else if (project.phase && typeof project.phase === 'string') {
        try {
          const phaseData = JSON.parse(project.phase);
          if (phaseData && phaseData.searchname) {
            return phaseData.searchname;
          }
        } catch (e) {
          // Geen geldige JSON, negeer
        }
      }

      // Default status
      return 'Actief';
    };

    // Genereer revenue data
    const revenueData = [];

    // Als er geen uren zijn, stuur een lege array terug
    if (detailedHours.length === 0) {
      console.log('No hours found for year ' + year);

      // Stuur een lege array terug
      res.json(successResponse({
        year,
        data: [],
        message: `Geen uren gevonden voor het jaar ${year}`
      }));
      return;
    }

    // Gebruik echte data
    console.log('Using real hours data');

    // Log een aantal voorbeelden van uren
    console.log('Voorbeeld uren:');
    for (let i = 0; i < Math.min(5, detailedHours.length); i++) {
      console.log(detailedHours[i]);
    }

    // Groepeer uren per employee, project en maand
    const hoursByEmployeeProjectMonth = new Map();

    for (const hour of detailedHours) {
      // Zoek de medewerker op basis van ID
      const employee = employees.find(e => e.id === hour.employeeId);

      // Als de medewerker niet gevonden is, maak een generieke medewerker aan
      // Dit zorgt ervoor dat uren van verwijderde medewerkers nog steeds worden meegenomen
      const employeeToUse = employee || {
        id: hour.employeeId,
        firstname: 'Voormalig',
        lastname: 'Medewerker',
        function: 'Onbekend',
        email: '',
        active: 0
      };

      // Log alleen als we een generieke medewerker gebruiken
      if (!employee) {
        console.log(`Employee ${hour.employeeId} niet gevonden voor uur ${hour.id}, gebruiken generieke medewerker`);
      }

      // Gebruik project_id en project_name uit de database (direct uit Gripp API)
      let project;

      if (hour.projectId) {
        // Als er een directe koppeling is, gebruik die
        project = projects.find(p => p.id === hour.projectId);
        if (project) {
          // Gebruik de project naam uit de database als die beschikbaar is
          if (hour.project_name) {
            project.name = hour.project_name;
          }
          console.log(`Project gevonden via directe koppeling: ${project.name} (${project.id})`);
        }
      }

      // Als er geen project gevonden is, maar we hebben wel project_id en project_name in de database,
      // maak dan een nieuw project object aan met deze informatie
      if (!project && hour.projectId && hour.project_name) {
        // Probeer eerst de klantnaam op te halen uit de hardcoded lijst op basis van project ID of naam
        const clientNameFromHardcodedList = getClientNameFromHardcodedList(hour.projectId.toString()) !== 'Onbekend'
          ? getClientNameFromHardcodedList(hour.projectId.toString())
          : getClientNameFromHardcodedList(hour.project_name);

        // Als we geen match hebben in de hardcoded lijst, probeer de klantnaam te extraheren uit de projectnaam
        const clientName = clientNameFromHardcodedList !== 'Onbekend'
          ? clientNameFromHardcodedList
          : extractClientFromProjectName(hour.project_name);

        project = {
          id: hour.projectId,
          name: hour.project_name,
          // Gebruik de gevonden klantnaam of de projectregel naam als fallback
          company: {
            searchname: clientName !== 'Onbekend' ? clientName : (hour.project_line_name || 'Onbekend')
          },
          // Voeg het nummer toe aan het project object voor gebruik in getClientNameFromHardcodedList
          number: hour.projectId
        };
        console.log(`Project niet gevonden in Gripp, maar wel in database: ${project.name} (${project.id}), klantnaam: ${project.company.searchname}`);
      }

      // Als er nog steeds geen project is, skip deze uur regel
      if (!project) {
        console.log(`Geen project gevonden voor uur ${hour.id}, deze wordt overgeslagen`);
        continue;
      }

      const projectId = project.id;
      const projectName = project.name || 'Onbekend Project';

      // Gebruik de getClientName functie om de klantnaam op te halen
      // Deze functie zal nu eerst de company_searchname gebruiken als die beschikbaar is
      const clientName = getClientName(project);

      const projectType = getProjectType(project);
      const projectStatus = getProjectStatus(project);
      const projectBudget = getProjectBudget(project, project.id);

      // Check of project moet worden meegenomen in revenue berekening
      if (projectIncludeMap.has(projectId) && !projectIncludeMap.get(projectId)) {
        continue; // Skip dit project als het niet moet worden meegenomen
      }

      // Bepaal uurtarief op basis van projectregel of functie
      const hourlyRate = await getHourlyRate(employeeToUse, projectId, hour.project_line_id || null);

      // Maak een unieke key voor deze combinatie
      const key = `${hour.employeeId}-${projectId}-${hour.month}`;

      if (!hoursByEmployeeProjectMonth.has(key)) {
        hoursByEmployeeProjectMonth.set(key, {
          employeeId: hour.employeeId,
          employeeName: `${employeeToUse.firstname} ${employeeToUse.lastname}${employeeToUse.active ? '' : ' (inactief)'}`,
          projectId: projectId,
          projectName: projectName,
          clientName: clientName,
          month: parseInt(hour.month),
          hours: 0,
          hourlyRate: hourlyRate,
          isDefinite: true, // Neem alle uren mee, ongeacht status
          offerprojectbase_discr: hour.offerprojectbase_discr, // Voeg offerprojectbase_discr toe
          projectLineId: hour.project_line_id || null // Voeg projectregel ID toe
        });
      }

      // Update hours
      const entry = hoursByEmployeeProjectMonth.get(key);
      entry.hours += hour.hours;
      hoursByEmployeeProjectMonth.set(key, entry);
    }

    // Converteer de map naar een array en bereken revenue
    console.log('Aantal unieke employee-project-maand combinaties:', hoursByEmployeeProjectMonth.size);

    // Log specifieke informatie over Internal hours 2025 en 2024 (beide zijn voor 2025)
    const internalHours2025 = Array.from(hoursByEmployeeProjectMonth.values())
      .filter(entry => entry.projectId === 5731 && entry.month === 1)
      .reduce((sum, entry) => sum + entry.hours, 0);

    const internalHours2024 = Array.from(hoursByEmployeeProjectMonth.values())
      .filter(entry => entry.projectId === 5368 && entry.month === 1)
      .reduce((sum, entry) => sum + entry.hours, 0);

    console.log(`Totaal aantal uren voor Internal hours 2025 (5731) in januari: ${internalHours2025}`);
    console.log(`Totaal aantal uren voor Internal hours 2024 (5368) in januari: ${internalHours2024}`);
    console.log(`Totaal aantal uren voor beide Internal hours projecten in januari: ${internalHours2025 + internalHours2024}`);

    // Log alle entries voor Internal hours 2025 in januari
    console.log('Entries voor Internal hours 2025 in januari:');
    Array.from(hoursByEmployeeProjectMonth.values())
      .filter(entry => entry.projectId === 5731 && entry.month === 1)
      .forEach(entry => {
        console.log(`${entry.employeeName}: ${entry.hours} uur`);
      });

    // Log alle entries voor Internal hours 2024 in januari
    console.log('Entries voor Internal hours 2024 in januari:');
    Array.from(hoursByEmployeeProjectMonth.values())
      .filter(entry => entry.projectId === 5368 && entry.month === 1)
      .forEach(entry => {
        console.log(`${entry.employeeName}: ${entry.hours} uur`);
      });

    // Log een aantal voorbeelden van gegroepeerde uren
    console.log('Voorbeeld gegroepeerde uren:');
    let count = 0;
    for (const [key, entry] of hoursByEmployeeProjectMonth.entries()) {
      if (count < 5) {
        console.log(key, entry);
        count++;
      }
      // Zoek het project op basis van projectId
      const project = projects.find(p => p.id === entry.projectId);

      // Als het project niet in de projects array zit, haal het dan op uit de database
      let projectType;
      if (project) {
        projectType = getProjectType(project);
      } else {
        // Haal het project op uit de database
        try {
          const projectFromDb = await db.get(`
            SELECT id, name, tags, type FROM projects WHERE id = ?
          `, entry.projectId);

          if (projectFromDb) {
            console.log(`Project ${entry.projectId} niet gevonden in projects array, maar wel in database: ${projectFromDb.name}`);
            // Gebruik het type uit de database als het beschikbaar is
            if (projectFromDb.type) {
              console.log(`Project ${projectFromDb.id} (${projectFromDb.name}) heeft type: ${projectFromDb.type} uit de database`);
              projectType = projectFromDb.type;
            } else if (projectFromDb.tags) {
              // Maak een tijdelijk project object om de getProjectType functie te gebruiken
              const tempProject = {
                id: projectFromDb.id,
                name: projectFromDb.name,
                tags: projectFromDb.tags
              };
              projectType = getProjectType(tempProject);
            } else {
              projectType = 'Verkeerde tag';
            }
          } else {
            projectType = 'Verkeerde tag';
          }
        } catch (error) {
          console.error(`Fout bij ophalen project ${entry.projectId} uit database:`, error);
          projectType = 'Verkeerde tag';
        }
      }

      const projectStatus = project ? getProjectStatus(project) : 'Actief';

      // Haal het budget op uit de database als het project bestaat
      let projectBudget = 0;

      // Probeer eerst het budget op te halen uit de database
      try {
        const projectFromDb = await db.get(`
          SELECT id, name, totalexclvat FROM projects WHERE id = ?
        `, [entry.projectId]);

        if (projectFromDb && projectFromDb.totalexclvat && projectFromDb.totalexclvat !== '0') {
          const budget = parseFloat(projectFromDb.totalexclvat);
          if (!isNaN(budget) && budget > 0) {
            console.log(`Project ${entry.projectId} (${entry.projectName}): Using budget from database: €${budget}`);
            projectBudget = budget;
          }
        }
      } catch (error) {
        console.error(`Error fetching project ${entry.projectId} from database:`, error);
      }

      // Als we geen budget hebben gevonden in de database, probeer het uit het project object
      if (projectBudget === 0 && project) {
        if (project.totalexclvat && project.totalexclvat !== '0') {
          const budget = parseFloat(project.totalexclvat);
          if (!isNaN(budget) && budget > 0) {
            console.log(`Project ${entry.projectId} (${entry.projectName}): Using project totalexclvat: €${budget}`);
            projectBudget = budget;
          }
        }
      }

      // Hardcoded budgetten voor specifieke projecten als fallback
      if (projectBudget === 0) {
        const hardcodedBudgets: Record<number, number> = {
          5898: 4750.00,  // Aanvullende kleuren op de 2025
          5632: 154154.00, // OLM - Phase 3A
          5857: 135166.00, // Merk & Website
          5899: 2031.00,   // SLA - Service uren - Maandelijks - 2025
          5924: 1215.00,   // Amsterdam Museum - Extra service uren Pop-up Window
          5927: 630.00,    // UNVRS - Site speed issues
          5926: 157.50,    // Double Shift - Important CMS Security Update
          5923: 162.50     // Plus One Legal - Craft CMS beveiligingsupdate
        };

        if (hardcodedBudgets[entry.projectId]) {
          console.log(`Project ${entry.projectId} (${entry.projectName}): Using hardcoded budget: €${hardcodedBudgets[entry.projectId]}`);
          projectBudget = hardcodedBudgets[entry.projectId];
        }
      }

      // Bepaal of het een offerte is op basis van project.discr of offerprojectbase_discr
      const isQuote = (project && project.discr && (
                        project.discr === 'offer' ||
                        project.discr === 'offerte' ||
                        project.discr.includes('offerte') ||
                        project.discr.includes('offer')
                      )) ||
                      (entry.offerprojectbase_discr && (
                        entry.offerprojectbase_discr === 'offerte' ||
                        entry.offerprojectbase_discr === 'offer' ||
                        entry.offerprojectbase_discr.includes('offerte') ||
                        entry.offerprojectbase_discr.includes('offer')
                      ));

      // Haal offerte informatie op uit de offersMap
      let offerInfo = offersMap.get(entry.projectId);

      // Bereken revenue op basis van projectType en invoiceBasisId
      let revenue = 0;

      // DEFINITIEVE FIX: Controleer eerst of dit een niet-doorbelastbaar uur is
      // Haal de invoiceBasisId op uit de project_lines tabel
      let invoiceBasisId = entry.invoiceBasisId || 0;

      // Als we een projectregel ID hebben, haal dan de invoiceBasisId op uit de project_lines tabel
      if (entry.projectLineId) {
        try {
          const projectLine = await db.get(`
            SELECT invoice_basis_id FROM project_lines WHERE id = ?
          `, [entry.projectLineId]);

          if (projectLine && projectLine.invoice_basis_id) {
            // Overschrijf de invoiceBasisId met de waarde uit de database
            invoiceBasisId = projectLine.invoice_basis_id;

            // Debug logging voor niet-doorbelastbare uren
            if (invoiceBasisId === 4) {
              console.log(`DEFINITIEVE FIX: Niet-doorbelastbaar uur gevonden voor project ${entry.projectId} (${entry.projectName}):`, {
                projectLineId: entry.projectLineId,
                hours: entry.hours,
                month: entry.month,
                invoiceBasisId: invoiceBasisId
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching invoice_basis_id for project line ${entry.projectLineId}:`, error);
        }
      }

      // Als dit een niet-doorbelastbaar uur is, genereer geen omzet
      if (invoiceBasisId === 4) {
        console.log(`DEFINITIEVE FIX: Niet-doorbelastbaar uur genereert geen omzet voor project ${entry.projectId} (${entry.projectName})`);
        revenue = 0;
      }
      // Als dit een intern project is, genereer geen omzet
      else if (projectType === 'Intern') {
        // Interne projecten genereren geen omzet
        revenue = 0;
      }
      // Voor alle andere projecttypes (inclusief Vaste Prijs):
      // gebruik altijd uurtarief * uren, ongeacht het budget
      else {
        revenue = entry.hours * entry.hourlyRate;
      }

      // Gebruik de originele project ID en naam
      let projectIdToUse = entry.projectId;
      let projectNameToUse = entry.projectName;

      // Zoek projectregel informatie als die beschikbaar is
      let projectLineId = null;
      let projectLineName = null;
      let projectLineAmount = null;
      let projectLineAmountWritten = null;
      // We gebruiken een nieuwe variabele voor de naam
      let invoiceBasisName = null;

      // Controleer of we projectregel informatie hebben
      if (entry.projectLineId) {
        projectLineId = entry.projectLineId;
        projectLineName = entry.projectLineName || 'Onbekende projectregel';

        // Probeer projectregel details op te halen uit het project
        if (project && project.projectlines && Array.isArray(project.projectlines)) {
          const projectLine = project.projectlines.find(line => line.id === projectLineId);
          if (projectLine) {
            projectLineAmount = parseFloat(projectLine.amount) || 0;
            projectLineAmountWritten = parseFloat(projectLine.amountwritten) || 0;

            // Haal facturatiebasis op
            if (projectLine.invoicebasis) {
              if (typeof projectLine.invoicebasis === 'object') {
                // We gebruiken de invoiceBasisId niet meer hier, alleen de naam
                invoiceBasisName = projectLine.invoicebasis.searchname;
              } else if (typeof projectLine.invoicebasis === 'string') {
                try {
                  const invoiceBasis = JSON.parse(projectLine.invoicebasis);
                  // We gebruiken de invoiceBasisId niet meer hier, alleen de naam
                  invoiceBasisName = invoiceBasis.searchname;
                } catch (e) {
                  // Geen geldige JSON, gebruik default waarden
                  invoiceBasisName = 'Vaste prijs';
                }
              }
            }
          }
        }
      }

      // Maak een offerprojectbase object als we offerte informatie hebben
      const offerprojectbase = offerInfo ? {
        id: offerInfo.offerId,
        searchname: offerInfo.offerName,
        discr: offerInfo.discr,
        company: {
          id: offerInfo.clientId,
          searchname: offerInfo.clientName
        }
      } : null;

      // Bepaal de juiste klantnaam
      let clientNameToUse = 'Onbekend';

      // 1. Als het een offerte is, gebruik de klantnaam uit de offersMap (meest betrouwbaar)
      if (isQuote && offerInfo && offerInfo.clientName) {
        clientNameToUse = offerInfo.clientName;
      }
      // 2. Als we offerprojectbase informatie hebben, gebruik die
      else if (offerprojectbase && offerprojectbase.company && offerprojectbase.company.searchname) {
        clientNameToUse = offerprojectbase.company.searchname;
      }
      // 3. Als we een project hebben, gebruik de getClientName functie (meest betrouwbaar voor projecten)
      else if (project) {
        clientNameToUse = getClientName(project);
      }
      // 4. Controleer of we een koppeling hebben in de projectClientMap
      else if (entry.projectId && projectClientMap.has(entry.projectId)) {
        const projectInfo = projectClientMap.get(entry.projectId);
        if (projectInfo && projectInfo.clientName && projectInfo.clientName !== 'Onbekend') {
          clientNameToUse = projectInfo.clientName;
        }
      }
      // 5. Probeer de klantnaam op te halen uit de hardcoded lijst op basis van project ID
      else if (getClientNameFromHardcodedList(entry.projectId.toString()) !== 'Onbekend') {
        clientNameToUse = getClientNameFromHardcodedList(entry.projectId.toString());
      }
      // 6. Probeer de klantnaam op te halen uit de hardcoded lijst op basis van projectnaam
      else if (entry.projectName && getClientNameFromHardcodedList(entry.projectName) !== 'Onbekend') {
        clientNameToUse = getClientNameFromHardcodedList(entry.projectName);
      }
      // 7. Gebruik de entry.clientName als die niet een projectregel naam is
      else if (entry.clientName && !isProjectLineName(entry.clientName)) {
        clientNameToUse = entry.clientName;
      }
      // 8. Als laatste optie, probeer de klantnaam te extraheren uit de projectnaam
      else if (clientNameToUse === 'Onbekend' && entry.projectName) {
        clientNameToUse = extractClientFromProjectName(entry.projectName);
      }

      // Haal previousYearBudgetUsed op uit de map
      const previousYearBudgetUsed = previousConsumptionMap.get(projectIdToUse) || 0;

      // Log voor debugging als er een previousYearBudgetUsed waarde is
      if (previousYearBudgetUsed > 0) {
        console.log(`Project ${projectNameToUse} (${projectIdToUse}): previousYearBudgetUsed = ${previousYearBudgetUsed}`);
      }

      // Als het een vaste prijs project is met budget 0 maar wel previousYearBudgetUsed,
      // gebruik dan previousYearBudgetUsed als budget
      if (projectType === 'Vaste Prijs' && (!projectBudget || projectBudget === 0 || projectBudget === '0') && previousYearBudgetUsed > 0) {
        console.warn(`WAARSCHUWING: Vaste prijs project ${projectIdToUse} (${projectNameToUse}) heeft geen budget in Gripp, maar wel verbruikt budget van vorig jaar (€${previousYearBudgetUsed}). Gebruik previousYearBudgetUsed als budget.`);
        projectBudget = previousYearBudgetUsed;
      }

      revenueData.push({
        id: key,
        projectId: projectIdToUse,
        projectName: projectNameToUse,
        clientName: clientNameToUse,
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        year: year,
        month: entry.month,
        revenue: revenue,
        hours: entry.hours,
        hourlyRate: entry.hourlyRate,
        isDefinite: entry.isDefinite,
        projectType: isQuote ? 'Offerte' : projectType,
        projectStatus,
        projectBudget,
        previousYearBudgetUsed, // Voeg previousYearBudgetUsed toe
        projectLineId,
        projectLineName,
        projectLineAmount,
        projectLineAmountWritten,
        invoiceBasisId,
        invoiceBasisName,
        isOverBudget: false, // Dit wordt later berekend in de frontend
        adjustedDueToMaxBudget: false, // Dit wordt later berekend in de frontend
        discr: project ? project.discr : null, // Voeg discr veld toe om offertes te identificeren
        isQuote: isQuote, // Voeg isQuote veld toe
        offerprojectbase: offerprojectbase, // Voeg offerprojectbase informatie toe
        offerprojectbase_discr: entry.offerprojectbase_discr, // Voeg offerprojectbase_discr veld toe
        archived: project ? project.archived === 1 : false, // Voeg archived veld toe
        archivedon: project ? project.archivedon : null // Voeg archivedon veld toe
      });
    }

    console.log(`Sending ${revenueData.length} revenue records`);

    // Log een aantal voorbeelden van revenue data
    console.log('Voorbeeld revenue data:');
    for (let i = 0; i < Math.min(5, revenueData.length); i++) {
      console.log(revenueData[i]);
    }

    // Stuur response
    res.json(successResponse({
      year,
      data: revenueData
    }));
  } catch (error) {
    console.error('Error in /revenue endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/v1/iris/targets/monthly
 *
 * Haal maandelijkse targets op voor IRIS
 */
router.get('/targets/monthly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Parse parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    console.log(`Fetching monthly targets for year ${year}`);

    // Haal maandelijkse targets op
    const targets = await db.all(`
      SELECT
        year,
        month,
        target_amount as targetAmount
      FROM iris_manual_monthly_targets
      WHERE year = ?
      ORDER BY month
    `, [year]);

    console.log(`Found ${targets.length} targets for year ${year}`);

    // Als er geen targets zijn voor dit jaar, maak standaard targets aan
    if (targets.length === 0) {
      console.log(`No targets found for year ${year}, creating default targets`);

      // Begin een transactie
      await db.run('BEGIN TRANSACTION');

      try {
        // Maak standaard targets aan voor elke maand
        for (let month = 1; month <= 12; month++) {
          await db.run(`
            INSERT INTO iris_manual_monthly_targets (year, month, target_amount, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
          `, [year, month, 200000]);
        }

        // Commit de transactie
        await db.run('COMMIT');

        // Haal de nieuwe targets op
        const newTargets = await db.all(`
          SELECT
            year,
            month,
            target_amount as targetAmount
          FROM iris_manual_monthly_targets
          WHERE year = ?
          ORDER BY month
        `, [year]);

        console.log(`Created ${newTargets.length} default targets for year ${year}`);

        res.json(successResponse({
          year,
          data: newTargets
        }));
      } catch (dbError) {
        // Rollback de transactie bij een fout
        await db.run('ROLLBACK');
        throw dbError;
      }
    } else {
      // Stuur de bestaande targets terug
      res.json(successResponse({
        year,
        data: targets
      }));
    }
  } catch (error) {
    console.error('Error in /targets/monthly endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/iris/targets/monthly
 *
 * Sla maandelijkse targets op voor IRIS
 */
router.post('/targets/monthly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Valideer request body
    const { year, targets } = req.body;

    if (!year || !Array.isArray(targets)) {
      throw new BadRequestError('Jaar en targets array zijn verplicht');
    }

    // Begin een transactie om ervoor te zorgen dat alle updates slagen of falen als één geheel
    await db.run('BEGIN TRANSACTION');

    try {
      // Verwerk elke target in de array
      for (const target of targets) {
        const { month, targetAmount } = target;

        if (!month || targetAmount === undefined) {
          throw new BadRequestError('Maand en target bedrag zijn verplicht voor elke target');
        }

        // Check of er al een target bestaat voor deze maand en jaar
        const existingTarget = await db.get(`
          SELECT id FROM iris_manual_monthly_targets
          WHERE year = ? AND month = ?
        `, [year, month]);

        if (existingTarget) {
          // Update bestaande target
          await db.run(`
            UPDATE iris_manual_monthly_targets
            SET target_amount = ?, updated_at = datetime('now')
            WHERE year = ? AND month = ?
          `, [targetAmount, year, month]);
        } else {
          // Voeg nieuwe target toe
          await db.run(`
            INSERT INTO iris_manual_monthly_targets (year, month, target_amount, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
          `, [year, month, targetAmount]);
        }
      }

      // Commit de transactie als alles succesvol is
      await db.run('COMMIT');
    } catch (dbError) {
      // Rollback de transactie als er een fout optreedt
      await db.run('ROLLBACK');
      throw dbError;
    }

    // Haal de opgeslagen targets op om te controleren of alles correct is opgeslagen
    const savedTargets = await db.all(`
      SELECT year, month, target_amount as targetAmount
      FROM iris_manual_monthly_targets
      WHERE year = ?
      ORDER BY month
    `, [year]);

    res.json(successResponse({
      message: 'Maandelijkse targets succesvol opgeslagen',
      data: {
        year,
        count: targets.length,
        savedTargets
      }
    }));
  } catch (error) {
    console.error('Error in POST /targets/monthly endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/v1/iris/targets/kpi
 *
 * Haal KPI targets op voor IRIS
 */
router.get('/targets/kpi', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Parse parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Haal KPI targets op
    const targets = await db.all(`
      SELECT
        year,
        kpi_name as kpiName,
        target_value as targetValue
      FROM iris_kpi_targets
      WHERE year = ?
    `, [year]);

    res.json(successResponse({
      year,
      data: targets
    }));
  } catch (error) {
    console.error('Error in /targets/kpi endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/iris/targets/kpi
 *
 * Sla een KPI target op voor IRIS
 */
router.post('/targets/kpi', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Valideer request body
    const { year, kpiName, targetValue } = req.body;

    if (!year || !kpiName || targetValue === undefined) {
      throw new BadRequestError('Jaar, KPI naam en target waarde zijn verplicht');
    }

    // Check of er al een target bestaat voor deze KPI en jaar
    const existingTarget = await db.get(`
      SELECT id FROM iris_kpi_targets
      WHERE year = ? AND kpi_name = ?
    `, [year, kpiName]);

    if (existingTarget) {
      // Update bestaande target
      await db.run(`
        UPDATE iris_kpi_targets
        SET target_value = ?, updated_at = datetime('now')
        WHERE year = ? AND kpi_name = ?
      `, [targetValue, year, kpiName]);
    } else {
      // Voeg nieuwe target toe
      await db.run(`
        INSERT INTO iris_kpi_targets (year, kpi_name, target_value, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `, [year, kpiName, targetValue]);
    }

    res.json(successResponse({
      message: 'KPI target succesvol opgeslagen',
      data: { year, kpiName, targetValue }
    }));
  } catch (error) {
    console.error('Error in POST /targets/kpi endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/v1/iris/revenue/final
 *
 * Haal definitieve omzet op voor IRIS
 */
router.get('/revenue/final', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Parse parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Haal definitieve omzet op
    const finalRevenue = await db.all(`
      SELECT
        year,
        month,
        amount
      FROM iris_final_revenue
      WHERE year = ?
      ORDER BY month
    `, [year]);

    console.log('Fetched final revenue from database:', finalRevenue);

    res.json(successResponse({
      year,
      data: finalRevenue
    }));
  } catch (error) {
    console.error('Error in /revenue/final endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/iris/revenue/final
 *
 * Sla definitieve omzet op voor IRIS
 */
router.post('/revenue/final', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Valideer request body
    const { year, revenue } = req.body;

    console.log('Saving final revenue:', { year, revenue });

    if (!year || !Array.isArray(revenue)) {
      throw new BadRequestError('Jaar en revenue array zijn verplicht');
    }

    // Verwerk elk revenue item
    for (const item of revenue) {
      const { month, amount } = item;

      if (!month || amount === undefined) {
        throw new BadRequestError('Maand en bedrag zijn verplicht voor elk revenue item');
      }

      // Check of er al een definitieve omzet bestaat voor deze maand en jaar
      const existingRevenue = await db.get(`
        SELECT id FROM iris_final_revenue
        WHERE year = ? AND month = ?
      `, [year, month]);

      if (existingRevenue) {
        // Update bestaande definitieve omzet
        await db.run(`
          UPDATE iris_final_revenue
          SET amount = ?, updated_at = datetime('now')
          WHERE year = ? AND month = ?
        `, [amount, year, month]);
      } else {
        // Voeg nieuwe definitieve omzet toe
        await db.run(`
          INSERT INTO iris_final_revenue (year, month, amount, created_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `, [year, month, amount]);
      }
    }

    // Haal de bijgewerkte definitieve omzet op
    const updatedFinalRevenue = await db.all(`
      SELECT
        year,
        month,
        amount
      FROM iris_final_revenue
      WHERE year = ?
      ORDER BY month
    `, [year]);

    console.log('Updated final revenue:', updatedFinalRevenue);

    res.json(successResponse({
      message: 'Definitieve omzet succesvol opgeslagen',
      data: { year, count: revenue.length },
      updatedData: updatedFinalRevenue
    }));
  } catch (error) {
    console.error('Error in POST /revenue/final endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/iris/project/previous-budget
 *
 * Sla verbruikt budget van vorig jaar op voor een project
 */
router.post('/project/previous-budget', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Valideer request body
    const { projectId, previousYearBudgetUsed } = req.body;

    if (!projectId || previousYearBudgetUsed === undefined) {
      throw new BadRequestError('Project ID en verbruikt budget zijn verplicht');
    }

    // Controleer of het project bestaat, maar sla geen fout als het niet bestaat
    // We willen het budget kunnen opslaan, zelfs als het project niet in de database staat
    const project = await db.get(`
      SELECT id FROM projects WHERE id = ?
    `, [projectId]);

    // Log een waarschuwing als het project niet bestaat
    if (!project) {
      console.warn(`Project met ID ${projectId} bestaat niet in de database, maar we slaan het budget toch op`);
    }

    // Check of er al een record bestaat voor dit project
    const existingRecord = await db.get(`
      SELECT id FROM iris_manual_project_previous_consumption
      WHERE project_id = ?
    `, [projectId]);

    if (existingRecord) {
      // Update bestaand record
      await db.run(`
        UPDATE iris_manual_project_previous_consumption
        SET previous_year_budget_used = ?, updated_at = datetime('now')
        WHERE project_id = ?
      `, [previousYearBudgetUsed, projectId]);
    } else {
      // Voeg nieuw record toe
      await db.run(`
        INSERT INTO iris_manual_project_previous_consumption (project_id, previous_year_budget_used, created_at, updated_at)
        VALUES (?, ?, datetime('now'), datetime('now'))
      `, [projectId, previousYearBudgetUsed]);
    }

    res.json(successResponse({
      message: 'Verbruikt budget succesvol opgeslagen',
      data: { projectId, previousYearBudgetUsed }
    }));
  } catch (error) {
    console.error('Error in POST /project/previous-budget endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/v1/iris/projects/previous-consumption
 *
 * Haal "Budget Vorig Jaar" gegevens op voor projecten
 */
router.get('/projects/previous-consumption', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Parse parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const viewMode = (req.query.viewMode as string) || 'revenue';

    // Haal "Budget Vorig Jaar" gegevens op
    const previousConsumptionData = await db.all(`
      SELECT
        project_id as projectId,
        previous_year_budget_used as consumptionAmount
      FROM iris_manual_project_previous_consumption
    `);

    res.json(successResponse({
      year,
      viewMode,
      data: previousConsumptionData
    }));
  } catch (error) {
    console.error('Error in /projects/previous-consumption endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/iris/projects/previous-consumption
 *
 * Sla "Budget Vorig Jaar" gegevens op voor een project
 */
router.post('/projects/previous-consumption', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Valideer request body
    const { year, viewMode, projectId, consumptionAmount } = req.body;

    if (!projectId || consumptionAmount === undefined) {
      throw new BadRequestError('Project ID en verbruikt budget zijn verplicht');
    }

    // Controleer of het project bestaat, maar sla geen fout als het niet bestaat
    // We willen het budget kunnen opslaan, zelfs als het project niet in de database staat
    const project = await db.get(`
      SELECT id FROM projects WHERE id = ?
    `, [projectId]);

    // Log een waarschuwing als het project niet bestaat
    if (!project) {
      console.warn(`Project met ID ${projectId} bestaat niet in de database, maar we slaan het budget toch op`);
    }

    // Check of er al een record bestaat voor dit project
    const existingRecord = await db.get(`
      SELECT id FROM iris_manual_project_previous_consumption
      WHERE project_id = ?
    `, [projectId]);

    if (existingRecord) {
      // Update bestaand record
      await db.run(`
        UPDATE iris_manual_project_previous_consumption
        SET previous_year_budget_used = ?, updated_at = datetime('now')
        WHERE project_id = ?
      `, [consumptionAmount, projectId]);
    } else {
      // Voeg nieuw record toe
      await db.run(`
        INSERT INTO iris_manual_project_previous_consumption (project_id, previous_year_budget_used, created_at, updated_at)
        VALUES (?, ?, datetime('now'), datetime('now'))
      `, [projectId, consumptionAmount]);
    }

    res.json(successResponse({
      message: 'Budget Vorig Jaar succesvol opgeslagen',
      data: { year, viewMode, projectId, consumptionAmount }
    }));
  } catch (error) {
    console.error('Error in POST /projects/previous-consumption endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/v1/iris/offers
 *
 * Haal offertes op uit de database
 */
router.get('/offers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Haal offertes op uit de database
    const offers = await db.all(`
      SELECT
        id,
        offer_id as offerId,
        offer_name as offerName,
        client_id as clientId,
        client_name as clientName,
        discr
      FROM iris_offers
      ORDER BY offer_id
    `);

    res.json(successResponse({
      data: offers
    }));
  } catch (error) {
    console.error('Error in /offers endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/v1/iris/projects/:id
 *
 * Haal een specifiek project op uit de database
 */
router.get('/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      throw new BadRequestError('Project ID moet een nummer zijn');
    }

    // Haal project op uit de database
    const project = await db.get(`
      SELECT
        id,
        name,
        number,
        company
      FROM projects
      WHERE id = ?
    `, [projectId]);

    if (!project) {
      throw new NotFoundError(`Project met ID ${projectId} niet gevonden`);
    }

    res.json(successResponse({
      data: project
    }));
  } catch (error) {
    console.error('Error in /projects/:id endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/v1/iris/offers/:id
 *
 * Haal een specifieke offerte op uit de database
 */
router.get('/offers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();
    const offerId = parseInt(req.params.id);

    if (isNaN(offerId)) {
      throw new BadRequestError('Offerte ID moet een nummer zijn');
    }

    // Haal offerte op uit de database
    const offer = await db.get(`
      SELECT
        id,
        offer_id as offerId,
        offer_name as offerName,
        client_id as clientId,
        client_name as clientName,
        discr
      FROM iris_offers
      WHERE offer_id = ?
    `, [offerId]);

    if (!offer) {
      // Als de offerte niet in de database staat, haal deze op via de Gripp API
      if (!GRIPP_API_KEY) {
        throw new BadRequestError('Gripp API key is niet geconfigureerd');
      }

      try {
        // Haal offerte op via de Gripp API
        const response = await axios.post(GRIPP_API_URL, {
          api_key: GRIPP_API_KEY,
          call: 'offer.get',
          params: {
            id: offerId
          }
        });

        if (response.data && response.data.response) {
          const offerData = response.data.response;

          // Sla offerte op in de database
          await db.run(`
            INSERT INTO iris_offers (
              offer_id,
              offer_name,
              client_id,
              client_name,
              discr
            ) VALUES (?, ?, ?, ?, ?)
          `, [
            offerData.id,
            offerData.name,
            offerData.company?.id || null,
            offerData.company?.searchname || 'Onbekend',
            offerData.discr || 'offer'
          ]);

          // Haal de opgeslagen offerte op
          const savedOffer = await db.get(`
            SELECT
              id,
              offer_id as offerId,
              offer_name as offerName,
              client_id as clientId,
              client_name as clientName,
              discr
            FROM iris_offers
            WHERE offer_id = ?
          `, [offerId]);

          res.json(successResponse({
            data: savedOffer
          }));
        } else {
          throw new BadRequestError('Offerte niet gevonden in Gripp');
        }
      } catch (error) {
        console.error('Error fetching offer from Gripp:', error);
        throw new BadRequestError('Fout bij ophalen offerte uit Gripp');
      }
    } else {
      res.json(successResponse({
        data: offer
      }));
    }
  } catch (error) {
    console.error('Error in /offers/:id endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/iris/sync/offers
 *
 * Synchroniseer ALLE offertes vanuit Gripp met paginering
 */
router.post('/sync/offers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Controleer of er al een synchronisatie bezig is
    const syncInProgress = global.offerSyncInProgress === true;

    if (syncInProgress) {
      return res.status(429).json({
        success: false,
        message: 'Er is al een synchronisatie bezig. Probeer het later opnieuw.'
      });
    }

    // Markeer dat de synchronisatie is gestart
    global.offerSyncInProgress = true;

    // Stuur direct een response dat de synchronisatie is gestart
    res.json(successResponse({
      message: 'Offertesynchronisatie is gestart. Dit kan enkele minuten duren.',
      inProgress: true
    }));

    try {
      // Voer het sync-all-offers script uit
      const { exec } = await import('child_process');

      console.log('Uitvoeren van sync-all-offers script...');
      exec('node src/scripts/sync-all-offers.js', (error: any, stdout: string, stderr: string) => {
        // Markeer dat de synchronisatie is voltooid
        global.offerSyncInProgress = false;

        if (error) {
          console.error(`Error executing sync-all-offers script: ${error.message}`);
        }

        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }

        console.log(`stdout: ${stdout}`);
        console.log('Offer synchronization completed');

        // Voer het update-hours-offerprojectbase-discr script uit
        exec('node src/scripts/update-hours-offerprojectbase-discr.js', (error2: any, stdout2: string, stderr2: string) => {
          if (error2) {
            console.error(`Error executing update-hours-offerprojectbase-discr script: ${error2.message}`);
          }

          if (stderr2) {
            console.error(`stderr: ${stderr2}`);
          }

          console.log(`stdout: ${stdout2}`);
        });
      });
    } catch (error) {
      // Markeer dat de synchronisatie is voltooid, zelfs bij een fout
      global.offerSyncInProgress = false;

      console.error('Error in /sync/offers endpoint:', error);
    }
  } catch (error) {
    // Markeer dat de synchronisatie is voltooid, zelfs bij een fout
    global.offerSyncInProgress = false;

    console.error('Error in /sync/offers endpoint:', error);
    next(error);
  }
});



/**
 * POST /api/v1/iris/update/hours-types
 *
 * Update uurtypes op basis van gekoppelde projecten
 */
router.post('/update/hours-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Controleer of er al een update bezig is
    const updateInProgress = global.hoursTypeUpdateInProgress === true;

    if (updateInProgress) {
      return res.status(429).json({
        success: false,
        message: 'Er is al een update bezig. Probeer het later opnieuw.'
      });
    }

    // Markeer dat de update is gestart
    global.hoursTypeUpdateInProgress = true;

    // Stuur direct een response dat de update is gestart
    res.json(successResponse({
      message: 'Hours type update is gestart. Dit kan enkele minuten duren.',
      inProgress: true
    }));

    try {
      // Voer het update-hours-types script uit
      const { exec } = await import('child_process');

      console.log('Uitvoeren van update-hours-types script...');
      exec('node src/scripts/update-hours-types.js', (error: any, stdout: string, stderr: string) => {
        // Markeer dat de update is voltooid
        global.hoursTypeUpdateInProgress = false;

        if (error) {
          console.error(`Error executing update-hours-types script: ${error.message}`);
        }

        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }

        console.log(`stdout: ${stdout}`);
        console.log('Hours type update completed');
      });
    } catch (error) {
      // Markeer dat de update is voltooid, zelfs bij een fout
      global.hoursTypeUpdateInProgress = false;

      console.error('Error in /update/hours-types endpoint:', error);
    }
  } catch (error) {
    // Markeer dat de update is voltooid, zelfs bij een fout
    global.hoursTypeUpdateInProgress = false;

    console.error('Error in /update/hours-types endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/iris/update/project-types
 *
 * Update projecttypes op basis van tags
 */
router.post('/update/project-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Controleer of er al een update bezig is
    const updateInProgress = global.projectTypeUpdateInProgress === true;

    if (updateInProgress) {
      return res.status(429).json({
        success: false,
        message: 'Er is al een update bezig. Probeer het later opnieuw.'
      });
    }

    // Markeer dat de update is gestart
    global.projectTypeUpdateInProgress = true;

    // Stuur direct een response dat de update is gestart
    res.json(successResponse({
      message: 'Project type update is gestart. Dit kan enkele minuten duren.',
      inProgress: true
    }));

    try {
      // Voer het update-project-types script uit
      const { exec } = await import('child_process');

      console.log('Uitvoeren van update-project-types script...');
      exec('node src/scripts/update-project-types.js', (error: any, stdout: string, stderr: string) => {
        // Markeer dat de update is voltooid
        global.projectTypeUpdateInProgress = false;

        if (error) {
          console.error(`Error executing update-project-types script: ${error.message}`);
        }

        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }

        console.log(`stdout: ${stdout}`);
        console.log('Project type update completed');
      });
    } catch (error) {
      // Markeer dat de update is voltooid, zelfs bij een fout
      global.projectTypeUpdateInProgress = false;

      console.error('Error in /update/project-types endpoint:', error);
    }
  } catch (error) {
    // Markeer dat de update is voltooid, zelfs bij een fout
    global.projectTypeUpdateInProgress = false;

    console.error('Error in /update/project-types endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/iris/sync/projects
 *
 * Synchroniseer projecten vanuit Gripp met rate limiting
 *
 * Deze endpoint zorgt ervoor dat projecten worden gesynchroniseerd vanuit Gripp,
 * inclusief alle project details zoals tags. Wanneer een tag in Gripp wordt gewijzigd,
 * wordt deze wijziging overgenomen in de database bij de volgende synchronisatie.
 */
router.post('/sync/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Importeer de sync-status module
    const { getStatus } = await import('../../scripts/sync-status.js');

    // Haal de status op uit het statusbestand
    const status = getStatus();

    // Controleer of er al een synchronisatie bezig is
    const syncInProgress = status.projectSyncInProgress === true;

    if (syncInProgress) {
      return res.status(429).json({
        success: false,
        message: 'Er is al een synchronisatie bezig. Probeer het later opnieuw.'
      });
    }

    try {
      // Importeer de sync-status module
      const { markSyncStarted } = await import('../../scripts/sync-status.js');

      // Markeer dat de synchronisatie is gestart
      markSyncStarted('projects');

      // Stuur direct een response dat de synchronisatie is gestart
      res.json(successResponse({
        message: 'Projectsynchronisatie is gestart. Dit kan enkele minuten duren.',
        inProgress: true
      }));

      // Voer het originele sync-projects script uit
      const { exec } = await import('child_process');

      console.log('Uitvoeren van sync-projects script...');
      exec('node src/scripts/sync-projects.js', (error: any, stdout: string, stderr: string) => {
        // Importeer de sync-status module
        import('../../scripts/sync-status.js').then(({ markSyncCompleted }) => {
          // Markeer dat de synchronisatie is voltooid, zelfs bij een fout
          markSyncCompleted('projects');
        });

        if (error) {
          console.error(`Error executing sync-projects script: ${error.message}`);
        }

        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }

        console.log(`stdout: ${stdout}`);
        console.log('Project synchronization completed');
      });
    } catch (error) {
      // Importeer de sync-status module
      import('../../scripts/sync-status.js').then(({ markSyncCompleted }) => {
        // Markeer dat de synchronisatie is voltooid, zelfs bij een fout
        markSyncCompleted('projects');
      });

      console.error('Error in /sync/projects endpoint:', error);
      // Stuur alleen een response als er nog geen response is verzonden
      if (!res.headersSent) {
        next(error);
      }
    }
  } catch (error) {
    // Importeer de sync-status module
    import('../../scripts/sync-status.js').then(({ markSyncCompleted }) => {
      // Markeer dat de synchronisatie is voltooid, zelfs bij een fout
      markSyncCompleted('projects');
    });

    console.error('Error in /sync/projects endpoint:', error);
    // Stuur alleen een response als er nog geen response is verzonden
    if (!res.headersSent) {
      next(error);
    }
  }
});

/**
 * POST /api/v1/iris/clean/projects
 *
 * Verwijder alle projecten uit de database
 *
 * Deze endpoint verwijdert alle projecten uit de database, inclusief dummy projecten.
 * Dit is handig om de database op te schonen voordat nieuwe projecten worden gesynchroniseerd.
 */
router.post('/clean/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Controleer of er al een synchronisatie bezig is
    const syncInProgress = global.projectSyncInProgress === true;

    if (syncInProgress) {
      return res.status(429).json({
        success: false,
        message: 'Er is al een synchronisatie bezig. Probeer het later opnieuw.'
      });
    }

    try {
      // Markeer dat we een synchronisatie starten
      global.projectSyncInProgress = true;

      // Stuur direct een response dat de opschoning is gestart
      res.json(successResponse({
        message: 'Projecten worden verwijderd uit de database. Dit kan enkele seconden duren.',
        inProgress: true
      }));

      // Voer het clean-projects script uit
      const { exec } = await import('child_process');

      console.log('Uitvoeren van clean-projects script...');
      exec('node src/scripts/clean-projects.js', (error: any, stdout: string, stderr: string) => {
        // Markeer dat de synchronisatie is voltooid
        global.projectSyncInProgress = false;

        if (error) {
          console.error(`Error executing clean-projects script: ${error.message}`);
        }

        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }

        console.log(`stdout: ${stdout}`);
        console.log('Project cleanup completed');
      });
    } catch (error) {
      // Markeer dat de synchronisatie is voltooid, zelfs bij een fout
      global.projectSyncInProgress = false;

      console.error('Error in /clean/projects endpoint:', error);
      next(error);
    }
  } catch (error) {
    // Markeer dat de synchronisatie is voltooid, zelfs bij een fout
    global.projectSyncInProgress = false;

    console.error('Error in /clean/projects endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/iris/sync/hours/:year
 *
 * Synchroniseer uren voor een specifiek jaar vanuit Gripp
 */
router.post('/sync/hours/:year', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();
    const year = req.params.year;

    // Controleer of er al een synchronisatie bezig is
    const syncInProgress = global.hoursSyncInProgress === true;

    if (syncInProgress) {
      return res.status(429).json({
        success: false,
        message: 'Er is al een synchronisatie bezig. Probeer het later opnieuw.'
      });
    }

    // Markeer dat we een synchronisatie starten
    global.hoursSyncInProgress = true;

    // Stuur direct een response dat de synchronisatie is gestart
    res.json(successResponse({
      message: `Uren synchronisatie voor ${year} is gestart. Dit kan enkele minuten duren.`,
      inProgress: true
    }));

    // Voer het sync-hours script uit met het opgegeven jaar
    const { exec } = await import('child_process');

    exec(`node src/scripts/sync-hours.js ${year}`, (error: any, stdout: string, stderr: string) => {
      // Markeer dat de synchronisatie is voltooid
      global.hoursSyncInProgress = false;

      if (error) {
        console.error(`Error executing sync-hours script: ${error.message}`);
        return next(error);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }

      console.log(`stdout: ${stdout}`);

      // Voer het update-hours-offerprojectbase-discr script uit
      exec('node src/scripts/update-hours-offerprojectbase-discr.js', (error2: any, stdout2: string, stderr2: string) => {
        if (error2) {
          console.error(`Error executing update-hours-offerprojectbase-discr script: ${error2.message}`);
          return next(error2);
        }

        if (stderr2) {
          console.error(`stderr: ${stderr2}`);
        }

        console.log(`stdout: ${stdout2}`);

        // Stuur response
        res.json(successResponse({
          message: `Uren voor jaar ${year} succesvol gesynchroniseerd`,
          syncOutput: stdout,
          updateOutput: stdout2
        }));
      });
    });
  } catch (error) {
    console.error('Error in /sync/hours endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/v1/iris/sync/status
 *
 * Controleer de status van de synchronisatie
 */
router.get('/sync/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Importeer de sync-status module
    const { getStatus } = await import('../../scripts/sync-status.js');

    // Haal de status op uit het statusbestand
    const status = getStatus();

    // Bepaal of er een synchronisatie bezig is
    const syncInProgress = status.projectSyncInProgress || status.offerSyncInProgress || status.hoursSyncInProgress;

    // Stuur de status terug
    res.json(successResponse({
      syncInProgress,
      projectSyncInProgress: status.projectSyncInProgress,
      offerSyncInProgress: status.offerSyncInProgress,
      hoursSyncInProgress: status.hoursSyncInProgress,
      lastProjectSync: status.lastProjectSync,
      lastOfferSync: status.lastOfferSync,
      lastHoursSync: status.lastHoursSync,
      updatedAt: status.updatedAt
    }));
  } catch (error) {
    console.error('Error in /sync/status endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/iris/sync/last-three-months
 *
 * Synchroniseer data van de laatste 3 maanden
 */
router.post('/sync/last-three-months', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Controleer of er al een synchronisatie bezig is
    const syncInProgress = global.hoursSyncInProgress === true;

    if (syncInProgress) {
      return res.status(429).json({
        success: false,
        message: 'Er is al een synchronisatie bezig. Probeer het later opnieuw.'
      });
    }

    // Markeer dat we een synchronisatie starten
    global.hoursSyncInProgress = true;

    // Stuur direct een response dat de synchronisatie is gestart
    res.json(successResponse({
      message: `Synchronisatie van de laatste 3 maanden is gestart. Dit kan enkele minuten duren.`,
      inProgress: true
    }));

    // Voer het sync-last-three-months script uit
    const { exec } = await import('child_process');

    exec('node src/scripts/sync-last-three-months.js', (error: any, stdout: string, stderr: string) => {
      // Markeer dat de synchronisatie is voltooid
      global.hoursSyncInProgress = false;

      if (error) {
        console.error(`Error executing sync-last-three-months script: ${error.message}`);
        return next(error);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }

      console.log(`stdout: ${stdout}`);

      // Stuur response
      res.json(successResponse({
        message: 'Data van de laatste 3 maanden succesvol gesynchroniseerd',
        syncOutput: stdout
      }));
    });
  } catch (error) {
    console.error('Error in /sync/last-three-months endpoint:', error);
    next(error);
  }
});

/**
 * GET /api/v1/iris/revenue-combined
 *
 * Haalt revenue data op uit de database en combineert alle gegevensbronnen:
 * - Projects (projecten)
 * - Hours (uren)
 * - Tags (tags)
 * - Offers (offertes)
 * - Projectofferlines (projectregels)
 *
 * Deze endpoint haalt alle data op uit de database, combineert deze en geeft ze terug
 * in het formaat dat de RevenueTable component verwacht.
 */
router.get('/revenue-combined', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    console.log(`Ophalen van gecombineerde revenue data voor jaar ${year}`);

    // Gebruik de bestaande database-verbinding
    const dbConnection = await getDatabase();

    // Controleer of de tabellen bestaan
    try {
      // Maak de tabellen aan als ze nog niet bestaan
      await dbConnection.exec(`
        CREATE TABLE IF NOT EXISTS gripp_projects (
          id INTEGER PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbConnection.exec(`
        CREATE TABLE IF NOT EXISTS gripp_tags (
          id INTEGER PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbConnection.exec(`
        CREATE TABLE IF NOT EXISTS gripp_offers (
          id INTEGER PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbConnection.exec(`
        CREATE TABLE IF NOT EXISTS gripp_projectofferlines (
          id INTEGER PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await dbConnection.exec(`
        CREATE TABLE IF NOT EXISTS gripp_hours (
          id INTEGER PRIMARY KEY,
          data TEXT,
          year INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      console.error('Error creating tables:', error);
      // Ga door, tabellen bestaan mogelijk al
    }

    // Haal alle data op uit de database
    let projects = [];
    let tags = [];
    let offers = [];
    let projectOfferLines = [];
    let hours = [];

    try {
      projects = await dbConnection.all('SELECT id, data FROM gripp_projects');
    } catch (error) {
      console.error('Error fetching projects:', error);
      projects = [];
    }

    try {
      tags = await dbConnection.all('SELECT id, data FROM gripp_tags');
    } catch (error) {
      console.error('Error fetching tags:', error);
      tags = [];
    }

    try {
      offers = await dbConnection.all('SELECT id, data FROM gripp_offers');
    } catch (error) {
      console.error('Error fetching offers:', error);
      offers = [];
    }

    try {
      projectOfferLines = await dbConnection.all('SELECT id, data FROM gripp_projectofferlines');
    } catch (error) {
      console.error('Error fetching project offer lines:', error);
      projectOfferLines = [];
    }

    try {
      hours = await dbConnection.all('SELECT id, data FROM gripp_hours WHERE year = ?', [year]);
    } catch (error) {
      console.error('Error fetching hours:', error);
      hours = [];
    }

    // Parse de JSON data
    const parsedProjects = projects.map(p => ({ id: p.id, ...JSON.parse(p.data) }));
    const parsedTags = tags.map(t => ({ id: t.id, ...JSON.parse(t.data) }));
    const parsedOffers = offers.map(o => ({ id: o.id, ...JSON.parse(o.data) }));
    const parsedProjectOfferLines = projectOfferLines.map(l => ({ id: l.id, ...JSON.parse(l.data) }));
    const parsedHours = hours.map(h => ({ id: h.id, ...JSON.parse(h.data) }));

    console.log(`Verwerken van ${parsedProjects.length} projecten, ${parsedTags.length} tags, ${parsedOffers.length} offertes, ${parsedProjectOfferLines.length} projectregels en ${parsedHours.length} uren`);

    // Maak maps voor snelle lookup
    const projectMap = new Map();
    parsedProjects.forEach(project => {
      projectMap.set(project.id, project);
    });

    const tagMap = new Map();
    parsedTags.forEach(tag => {
      tagMap.set(tag.id, tag);
    });

    const offerMap = new Map();
    parsedOffers.forEach(offer => {
      offerMap.set(offer.id, offer);
    });

    const projectOfferLineMap = new Map();
    parsedProjectOfferLines.forEach(line => {
      if (!projectOfferLineMap.has(line.project_id)) {
        projectOfferLineMap.set(line.project_id, []);
      }
      projectOfferLineMap.get(line.project_id).push(line);
    });

    // Functie om het juiste projecttype te bepalen
    const getProjectType = (project) => {
      if (!project) return 'Verkeerde tag';

      // Geen hardcoded correcties meer, we gebruiken alleen de Gripp data

      // STAP 1: Controleer tags als ze bestaan (LEIDEND)
      if (project.tags && Array.isArray(project.tags) && project.tags.length > 0) {
        // Zoek naar specifieke tags
        for (const tagId of project.tags) {
          const tag = tagMap.get(tagId);
          if (tag) {
            const tagName = tag.searchname.toLowerCase();

            // Exacte matches voor specifieke tags
            if (tagName === 'vaste prijs') {
              return 'Vaste Prijs';
            }

            if (tagName === 'intern') {
              return 'Intern';
            }

            if (tagName === 'nacalculatie') {
              return 'Nacalculatie';
            }

            if (tagName === 'contract') {
              return 'Contract';
            }

            if (tagName === 'offerte') {
              return 'Offerte';
            }

            // Partial matches als fallback
            if (tagName.includes('vaste prijs') || tagName.includes('fixed price')) {
              return 'Vaste Prijs';
            }

            if (tagName.includes('intern') || tagName.includes('internal')) {
              return 'Intern';
            }

            if (tagName.includes('nacalculatie') || tagName.includes('hourly')) {
              return 'Nacalculatie';
            }

            if (tagName.includes('contract') || tagName.includes('subscription')) {
              return 'Contract';
            }

            if (tagName.includes('offerte') || tagName.includes('quote')) {
              return 'Offerte';
            }
          }
        }
      }

      // STAP 2: Als geen tag is gevonden, controleer op basis van naam (FALLBACK)
      if (project.name && typeof project.name === 'string') {
        const nameLower = project.name.toLowerCase();

        if (nameLower.includes('intern') || nameLower.includes('internal')) {
          return 'Intern';
        }

        if (nameLower.includes('vaste prijs') || nameLower.includes('fixed price')) {
          return 'Vaste Prijs';
        }

        if (nameLower.includes('nacalculatie') || nameLower.includes('hourly')) {
          return 'Nacalculatie';
        }

        if (nameLower.includes('contract') || nameLower.includes('subscription')) {
          return 'Contract';
        }

        if (nameLower.includes('offerte') || nameLower.includes('quote')) {
          return 'Offerte';
        }
      }

      // STAP 3: Als nog steeds geen type is gevonden, markeer als "Verkeerde tag"
      return 'Verkeerde tag';
    };

    // Functie om de juiste bedrijfsnaam te bepalen
    const getClientName = (project, projectId) => {
      if (!project) return 'Onbekend';

      // Geen hardcoded correcties meer, we gebruiken alleen de Gripp data

      // STAP 1: Gebruik de company uit het project
      if (project.company && project.company.searchname) {
        return project.company.searchname;
      }

      // STAP 2: Zoek in de projectregels
      const projectLines = projectOfferLineMap.get(projectId);
      if (projectLines && projectLines.length > 0) {
        for (const line of projectLines) {
          if (line.company && line.company.searchname) {
            return line.company.searchname;
          }
        }
      }

      // STAP 3: Zoek in de offertes
      if (project.offerprojectbase_id) {
        const offer = offerMap.get(project.offerprojectbase_id);
        if (offer && offer.company && offer.company.searchname) {
          return offer.company.searchname;
        }
      }

      // STAP 4: Als nog steeds geen bedrijfsnaam is gevonden, gebruik de projectnaam
      if (project.name) {
        // Probeer de bedrijfsnaam uit de projectnaam te halen (voor format "Bedrijfsnaam - Projectnaam")
        const parts = project.name.split(' - ');
        if (parts.length > 1) {
          return parts[0];
        }
      }

      return 'Onbekend';
    };

    // Functie om het juiste budget te bepalen
    const getProjectBudget = (project, projectId) => {
      if (!project) return 0;

      // STAP 0: Controleer of dit project ID 5898 is (Aanvullende kleuren op de 2025)
      if (projectId === 5898) {
        console.log(`Project ${projectId} (${project.name}): Dit is het project "Aanvullende kleuren op de 2025", gebruik hardcoded budget van €4750.00`);
        return 4750.00;
      }

      // Controleer of dit een vaste prijs project is
      let isFixedPriceProject = false;
      if (project.tags) {
        try {
          const tags = typeof project.tags === 'string' ? JSON.parse(project.tags) : project.tags;
          isFixedPriceProject = Array.isArray(tags) && tags.some(tag => {
            if (typeof tag === 'string') {
              return tag === "Vaste prijs" || tag === "28";
            }
            return (tag.searchname === "Vaste prijs") ||
                   (tag.name === "Vaste prijs") ||
                   (tag.id === "28") ||
                   (tag.id === 28);
          });
        } catch (e) {
          console.error(`Error parsing tags for project ${projectId}:`, e);
        }
      }

      // STAP 1: Gebruik totalexclvat uit het project
      if (project.totalexclvat && project.totalexclvat !== '0') {
        const budget = parseFloat(project.totalexclvat);
        if (!isNaN(budget) && budget > 0) {
          console.log(`Project ${projectId} (${project.name}): Using project totalexclvat: €${budget}`);
          return budget;
        }
      }

      // STAP 2: Als het project geen totalexclvat heeft, kijk naar de projectregels
      if (project.projectlines) {
        try {
          // Parse de projectlines als het een string is
          const lines = typeof project.projectlines === 'string'
            ? JSON.parse(project.projectlines)
            : project.projectlines;

          if (Array.isArray(lines) && lines.length > 0) {
            // Controleer of er een totalexclvat veld is in de projectregels
            const lineWithTotal = lines.find(line => line.totalexclvat && parseFloat(line.totalexclvat) > 0);
            if (lineWithTotal) {
              const budget = parseFloat(lineWithTotal.totalexclvat);
              console.log(`Project ${projectId} (${project.name}): Using projectline totalexclvat: €${budget}`);
              return budget;
            }

            // Als er geen totalexclvat is, bereken het budget op basis van amount * sellingprice
            let totalBudget = 0;
            for (const line of lines) {
              if (line.amount && line.sellingprice) {
                const amount = parseFloat(line.amount);
                const sellingPrice = parseFloat(line.sellingprice);
                if (!isNaN(amount) && !isNaN(sellingPrice)) {
                  totalBudget += amount * sellingPrice;
                }
              }
            }

            if (totalBudget > 0) {
              console.log(`Project ${projectId} (${project.name}): Calculated budget from projectlines: €${totalBudget}`);
              return totalBudget;
            }
          }
        } catch (e) {
          console.error(`Error parsing projectlines for project ${projectId}:`, e);
        }
      }

      // STAP 3: Kijk naar de projectregels in de projectOfferLineMap
      const projectLines = projectOfferLineMap.get(projectId);
      if (projectLines && projectLines.length > 0) {
        // Bereken het budget op basis van amount * sellingprice
        let totalBudget = 0;
        for (const line of projectLines) {
          if (line.amount && line.sellingprice) {
            const amount = parseFloat(line.amount);
            const sellingPrice = parseFloat(line.sellingprice);
            if (!isNaN(amount) && !isNaN(sellingPrice)) {
              totalBudget += amount * sellingPrice;
            }
          }
        }

        if (totalBudget > 0) {
          console.log(`Project ${projectId} (${project.name}): Calculated budget from projectOfferLineMap: €${totalBudget}`);
          return totalBudget;
        }
      }

      // STAP 4: Als het project geen totalexclvat heeft en geen projectregels met totalexclvat,
      // kijk naar de gekoppelde offerte
      if (project.offerprojectbase_id) {
        const offer = offerMap.get(project.offerprojectbase_id);
        if (offer && offer.totalexclvat) {
          const budget = parseFloat(offer.totalexclvat);
          if (!isNaN(budget) && budget > 0) {
            console.log(`Project ${projectId} (${project.name}): Using offer totalexclvat: €${budget}`);
            return budget;
          }
        }
      }

      // STAP 5: Controleer of er een previousYearBudgetUsed waarde is voor dit project
      const previousYearBudgetUsed = previousConsumptionMap.get(projectId) || 0;
      if (isFixedPriceProject && previousYearBudgetUsed > 0) {
        console.log(`Project ${projectId} (${project.name}): Using previousYearBudgetUsed as budget: €${previousYearBudgetUsed}`);
        return previousYearBudgetUsed;
      }

      // STAP 6: Als dit een vaste prijs project is zonder budget, log een waarschuwing
      if (isFixedPriceProject) {
        console.log(`WAARSCHUWING: Vaste prijs project ${projectId} (${project.name}) heeft geen budget in Gripp. Dit moet worden gecorrigeerd in Gripp.`);
      }

      // Als er geen budget is gevonden, return 0
      console.log(`Project ${projectId} (${project.name}): No budget found in Gripp data`);
      return 0;
    };

    // Verwerk de uren per project en maand
    const projectsData = {};

    // Groepeer uren per project
    parsedHours.forEach(hour => {
      if (!hour.project_id) return;

      const project = projectMap.get(hour.project_id);
      if (!project) return;

      const projectId = hour.project_id;
      const date = new Date(hour.date);
      const month = date.getMonth(); // 0-indexed

      if (!projectsData[projectId]) {
        const projectType = getProjectType(project);
        const clientName = getClientName(project, projectId);
        const projectBudget = getProjectBudget(project, projectId);

        // Haal de projectregels op als die beschikbaar zijn
        let projectLines = [];
        if (project.projectlines) {
          try {
            projectLines = typeof project.projectlines === 'string'
              ? JSON.parse(project.projectlines)
              : project.projectlines;
          } catch (e) {
            console.error(`Error parsing projectlines for project ${projectId}:`, e);
          }
        }

        // Haal previousYearBudgetUsed op uit de map
        const previousYearBudgetUsed = previousConsumptionMap.get(projectId) || 0;

        // Log voor debugging als er een previousYearBudgetUsed waarde is
        if (previousYearBudgetUsed > 0) {
          console.log(`Project ${project.name} (${projectId}): previousYearBudgetUsed = ${previousYearBudgetUsed}`);
        }

        projectsData[projectId] = {
          id: projectId,
          name: project.name,
          clientName: clientName,
          projectType: projectType,
          projectTags: project.tags ? project.tags.map(tagId => {
            const tag = tagMap.get(tagId);
            return tag ? tag.searchname : null;
          }).filter(Boolean) : [],
          projectBudget: projectBudget,
          previousYearBudgetUsed: previousYearBudgetUsed, // Gebruik de waarde uit de database
          remainingBudget: Math.max(0, projectBudget - previousYearBudgetUsed), // Bereken het resterende budget
          months: Array(12).fill(0),
          monthlyHours: Array(12).fill(0),
          monthlyOverBudget: Array(12).fill(false),
          total: 0,
          hours: 0,
          isOverBudget: false,
          isQuote: projectType === 'Offerte',
          projectLines: projectLines // Voeg de projectregels toe aan de data
        };
      }

      // Update uren
      const hourAmount = hour.amount || 0;
      const hourlyRate = hour.hourly_rate || 100; // Gebruik het uurtarief uit de uurregistratie of default 100

      // DEFINITIEVE FIX: Gebruik de invoiceBasisId uit de uurregistratie
      // Dit is de meest betrouwbare bron voor deze informatie
      const invoiceBasisId = hour.invoicebasis_id || 0; // Gebruik de invoicebasis_id uit de uurregistratie

      // Debug logging voor niet-doorbelastbare uren
      if (invoiceBasisId === 4) {
        console.log(`DEFINITIEVE FIX: Niet-doorbelastbaar uur gevonden voor project ${projectId} (${project.name}):`, {
          projectLineId: hour.projectline_id,
          hours: hourAmount,
          month: month,
          invoiceBasisId: invoiceBasisId
        });
      }

      // Voeg de uurgegevens toe aan de projectdata
      if (!projectsData[projectId].hourDetails) {
        projectsData[projectId].hourDetails = [];
      }

      // Voeg het uur toe aan de hourDetails array met alle relevante informatie
      projectsData[projectId].hourDetails.push({
        month: month,
        hours: hourAmount,
        hourlyRate: hourlyRate,
        invoiceBasisId: invoiceBasisId,
        projectLineId: hour.projectline_id || null,
        date: hour.date
      });

      // Update de maandelijkse uren en totale uren
      projectsData[projectId].monthlyHours[month] += hourAmount;
      projectsData[projectId].hours += hourAmount;

      // We berekenen de omzet nog niet hier, dat doen we later in één keer
      // voor het hele project volgens de juiste methode

      // Voor niet-vaste prijs projecten berekenen we de omzet wel direct
      const projectType = projectsData[projectId].projectType;
      let revenue = 0;

      // DEFINITIEVE FIX: Niet-doorbelastbare uren (invoiceBasisId === 4) genereren NOOIT omzet
      if (invoiceBasisId === 4) {
        // Niet-doorbelastbare uren genereren geen omzet, ongeacht het projecttype
        console.log(`DEFINITIEVE FIX: Project ${projectId} (${project.name}): Niet-doorbelastbare uren genereren geen omzet:`, {
          month: month + 1,
          hours: hourAmount,
          invoiceBasisId: invoiceBasisId
        });
        revenue = 0;
      } else if (projectType === 'Intern') {
        // Interne projecten genereren geen omzet
        revenue = 0;
      } else if (projectType !== 'Vaste Prijs') {
        // Voor nacalculatie, contract en offerte projecten, gebruik het uurtarief
        revenue = hourAmount * hourlyRate;

        // Update de maandelijkse omzet en totale omzet
        projectsData[projectId].months[month] += revenue;
        projectsData[projectId].total += revenue;
      }
      // Voor vaste prijs projecten berekenen we de omzet later

      // Controleer of het project over budget is
      if (projectType === 'Vaste Prijs') {
        const budget = projectsData[projectId].projectBudget;
        const totalRevenue = projectsData[projectId].total;

        if (budget > 0 && totalRevenue > budget) {
          projectsData[projectId].isOverBudget = true;

          // Bepaal welke maanden over budget zijn
          let runningTotal = 0;
          for (let i = 0; i < 12; i++) {
            runningTotal += projectsData[projectId].months[i];
            if (runningTotal > budget) {
              projectsData[projectId].monthlyOverBudget[i] = true;
            }
          }
        }
      }
    });

    // Bereken de omzet voor vaste prijs projecten
    Object.values(projectsData).forEach(project => {
      if (project.projectType === 'Vaste Prijs' && project.hourDetails && project.hourDetails.length > 0) {
        // Stap 1: Bepaal het beschikbare budget voor het huidige jaar
        const totalBudget = project.projectBudget || 0;
        const previousYearBudgetUsed = project.previousYearBudgetUsed || 0;
        const availableBudget = Math.max(0, totalBudget - previousYearBudgetUsed);

        console.log(`Vaste prijs project ${project.id} (${project.name}): Totaal budget €${totalBudget}, Verbruikt vorig jaar €${previousYearBudgetUsed}, Beschikbaar €${availableBudget}`);

        // Als het totale budget 0 is, maar er wel previousYearBudgetUsed is, dan is er iets mis
        if (totalBudget === 0 && previousYearBudgetUsed > 0) {
          console.warn(`WAARSCHUWING: Vaste prijs project ${project.id} (${project.name}) heeft geen budget in Gripp, maar wel verbruikt budget van vorig jaar (€${previousYearBudgetUsed}). Dit moet worden gecorrigeerd in Gripp.`);

          // Gebruik de previousYearBudgetUsed als budget voor dit project
          // Dit zorgt ervoor dat het project correct wordt weergegeven in de frontend
          project.projectBudget = previousYearBudgetUsed;
          project.remainingBudget = 0; // Het budget is volledig verbruikt
        }

        // Sorteer de uren chronologisch op datum
        project.hourDetails.sort((a, b) => {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        // Bereken de omzet voor beide methoden: Project Max en Projectregel Max

        // Project Max methode
        const projectMaxRevenue = calculateProjectMaxRevenue(project, availableBudget);

        // Projectregel Max methode
        const lineMaxRevenue = calculateLineMaxRevenue(project, availableBudget);

        // Sla beide berekeningen op in het project
        project.projectMaxRevenue = projectMaxRevenue;
        project.lineMaxRevenue = lineMaxRevenue;

        // Gebruik de Project Max methode als standaard
        for (let i = 0; i < 12; i++) {
          project.months[i] = projectMaxRevenue.monthlyRevenue[i];
        }
        project.total = projectMaxRevenue.totalRevenue;
        project.monthlyOverBudget = projectMaxRevenue.monthlyOverBudget;
        project.isOverBudget = projectMaxRevenue.isOverBudget;
      }
    });

    // Converteer de projectsData naar een array
    const result = Object.values(projectsData);

    // Stuur de data terug
    res.json(successResponse({
      year,
      data: result,
      message: `${result.length} projecten gevonden voor het jaar ${year}`
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
