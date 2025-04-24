/**
 * Sync API Endpoints
 * 
 * Deze module bevat alle endpoints voor het synchroniseren van data tussen de API en de database.
 */
import { Router, Request, Response } from 'express';
import { syncService } from '../../services/sync-service';

const router = Router();

/**
 * POST /api/sync
 * 
 * Synchroniseert alle data voor een specifieke periode.
 * Body parameters:
 * - startDate: Startdatum in formaat YYYY-MM-DD
 * - endDate: Einddatum in formaat YYYY-MM-DD
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('Received sync request with body:', req.body);
    
    const { startDate, endDate } = req.body;
    
    // Valideer parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Both startDate and endDate are required'
      });
    }
    
    // Valideer datumformaat (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        message: 'Dates must be in YYYY-MM-DD format'
      });
    }
    
    // Valideer dat startDate voor endDate ligt
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range',
        message: 'startDate must be before endDate'
      });
    }
    
    console.log(`Starting synchronization for period ${startDate} to ${endDate}`);
    
    // Start synchronisatie
    const startTime = Date.now();
    const result = await syncService.syncAllData(startDate, endDate);
    const duration = Date.now() - startTime;
    
    // Stuur resultaat terug
    return res.json({
      success: result.success,
      message: result.success 
        ? 'Synchronization completed successfully' 
        : 'Synchronization completed with some errors',
      results: result.results,
      timestamp: new Date().toISOString(),
      duration_ms: duration
    });
  } catch (error) {
    console.error('Error during synchronization:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/sync/employees
 * 
 * Synchroniseert alleen medewerkers.
 */
router.post('/employees', async (req: Request, res: Response) => {
  try {
    console.log('Starting employee synchronization');
    
    // Start synchronisatie
    const startTime = Date.now();
    const success = await syncService.syncEmployees();
    const duration = Date.now() - startTime;
    
    // Stuur resultaat terug
    return res.json({
      success,
      message: success 
        ? 'Employee synchronization completed successfully' 
        : 'Employee synchronization failed',
      timestamp: new Date().toISOString(),
      duration_ms: duration
    });
  } catch (error) {
    console.error('Error during employee synchronization:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/sync/contracts
 * 
 * Synchroniseert alleen contracten.
 */
router.post('/contracts', async (req: Request, res: Response) => {
  try {
    console.log('Starting contract synchronization');
    
    // Start synchronisatie
    const startTime = Date.now();
    const success = await syncService.syncContracts();
    const duration = Date.now() - startTime;
    
    // Stuur resultaat terug
    return res.json({
      success,
      message: success 
        ? 'Contract synchronization completed successfully' 
        : 'Contract synchronization failed',
      timestamp: new Date().toISOString(),
      duration_ms: duration
    });
  } catch (error) {
    console.error('Error during contract synchronization:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/sync/projects
 * 
 * Synchroniseert alleen projecten.
 */
router.post('/projects', async (req: Request, res: Response) => {
  try {
    console.log('Starting project synchronization');
    
    // Start synchronisatie
    const startTime = Date.now();
    const success = await syncService.syncProjects();
    const duration = Date.now() - startTime;
    
    // Stuur resultaat terug
    return res.json({
      success,
      message: success 
        ? 'Project synchronization completed successfully' 
        : 'Project synchronization failed',
      timestamp: new Date().toISOString(),
      duration_ms: duration
    });
  } catch (error) {
    console.error('Error during project synchronization:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/sync/hours
 * 
 * Synchroniseert alleen uren voor een specifieke periode.
 * Body parameters:
 * - startDate: Startdatum in formaat YYYY-MM-DD
 * - endDate: Einddatum in formaat YYYY-MM-DD
 */
router.post('/hours', async (req: Request, res: Response) => {
  try {
    console.log('Received hours sync request with body:', req.body);
    
    const { startDate, endDate } = req.body;
    
    // Valideer parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Both startDate and endDate are required'
      });
    }
    
    // Valideer datumformaat (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        message: 'Dates must be in YYYY-MM-DD format'
      });
    }
    
    // Valideer dat startDate voor endDate ligt
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range',
        message: 'startDate must be before endDate'
      });
    }
    
    console.log(`Starting hours synchronization for period ${startDate} to ${endDate}`);
    
    // Start synchronisatie
    const startTime = Date.now();
    const success = await syncService.syncHours(startDate, endDate);
    const duration = Date.now() - startTime;
    
    // Stuur resultaat terug
    return res.json({
      success,
      message: success 
        ? 'Hours synchronization completed successfully' 
        : 'Hours synchronization failed',
      timestamp: new Date().toISOString(),
      duration_ms: duration
    });
  } catch (error) {
    console.error('Error during hours synchronization:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/sync/absences
 * 
 * Synchroniseert alleen afwezigheidsverzoeken voor een specifieke periode.
 * Body parameters:
 * - startDate: Startdatum in formaat YYYY-MM-DD
 * - endDate: Einddatum in formaat YYYY-MM-DD
 */
router.post('/absences', async (req: Request, res: Response) => {
  try {
    console.log('Received absences sync request with body:', req.body);
    
    const { startDate, endDate } = req.body;
    
    // Valideer parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Both startDate and endDate are required'
      });
    }
    
    // Valideer datumformaat (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        message: 'Dates must be in YYYY-MM-DD format'
      });
    }
    
    // Valideer dat startDate voor endDate ligt
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range',
        message: 'startDate must be before endDate'
      });
    }
    
    console.log(`Starting absences synchronization for period ${startDate} to ${endDate}`);
    
    // Start synchronisatie
    const startTime = Date.now();
    const success = await syncService.syncAbsenceRequests(startDate, endDate);
    const duration = Date.now() - startTime;
    
    // Stuur resultaat terug
    return res.json({
      success,
      message: success 
        ? 'Absences synchronization completed successfully' 
        : 'Absences synchronization failed',
      timestamp: new Date().toISOString(),
      duration_ms: duration
    });
  } catch (error) {
    console.error('Error during absences synchronization:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * POST /api/sync/project/:id
 * 
 * Synchroniseert een specifiek project.
 * URL parameters:
 * - id: Project ID
 */
router.post('/project/:id', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    
    // Valideer project ID
    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID',
        message: 'Project ID must be a number'
      });
    }
    
    console.log(`Starting synchronization for project ${projectId}`);
    
    // Start synchronisatie
    const startTime = Date.now();
    const success = await syncService.syncProjectById(projectId);
    const duration = Date.now() - startTime;
    
    // Stuur resultaat terug
    return res.json({
      success,
      message: success 
        ? `Project ${projectId} synchronized successfully` 
        : `Failed to synchronize project ${projectId}`,
      timestamp: new Date().toISOString(),
      duration_ms: duration
    });
  } catch (error) {
    console.error('Error during project synchronization:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;
