/**
 * Project Routes
 *
 * Dit bestand bevat alle routes voor het werken met projecten.
 */
import express, { Request, Response, NextFunction } from 'express';
import { projectService } from '../gripp/services/project';
import { optimizedProjectService } from '../gripp/services/optimized-project';
import { cacheService } from '../gripp/cache-service';
import { successResponse } from '../utils/response';
import { NotFoundError, BadRequestError } from '../middleware/error-handler';
import { getDatabase } from '../../db/database';

const router = express.Router();

/**
 * GET /api/v1/projects
 *
 * Haal alle projecten op
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db;

    // Optioneel forceren van refresh door query parameter
    const forceRefresh = req.query.refresh === 'true';

    // Optioneel alleen actieve projecten ophalen
    const activeOnly = req.query.status === 'active';

    // Clear de project cache als nodig
    if (forceRefresh) {
      console.log('Force refresh requested, clearing project cache');
      cacheService.clearProjectData();
    }

    // Haal projecten op
    const projects = await projectService.getActiveProjects(db);

    // Filter op actieve projecten als dat is gevraagd
    const filteredProjects = activeOnly ? projects.filter(project => !project.archived) : projects;

    // Stuur response
    res.json(successResponse(filteredProjects, {
      fromCache: !forceRefresh && cacheService.hasProjectData && cacheService.hasProjectData()
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/:id
 *
 * Haal een specifiek project op
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db;

    // Parse project ID
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      throw new BadRequestError('Invalid project ID');
    }

    // Haal project op
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      throw new NotFoundError(`Project with ID ${projectId} not found`);
    }

    // Stuur response
    res.json(successResponse(project));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/company/:companyId
 *
 * Haal projecten op voor een specifiek bedrijf
 */
router.get('/company/:companyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db;

    // Parse company ID
    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) {
      throw new BadRequestError('Invalid company ID');
    }

    // Gebruik de geoptimaliseerde project service
    const projects = await optimizedProjectService.getProjectsByCompany(db, companyId);

    // Stuur response
    res.json(successResponse(projects));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/phase/:phaseId
 *
 * Haal projecten op voor een specifieke fase
 */
router.get('/phase/:phaseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db;

    // Parse phase ID
    const phaseId = parseInt(req.params.phaseId);
    if (isNaN(phaseId)) {
      throw new BadRequestError('Invalid phase ID');
    }

    // Gebruik de geoptimaliseerde project service
    const projects = await optimizedProjectService.getProjectsByPhase(db, phaseId);

    // Stuur response
    res.json(successResponse(projects));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/projects/sync
 *
 * Synchroniseer projecten met Gripp
 */
router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db;

    console.log('Syncing projects data');

    // Clear project cache before syncing
    cacheService.clearProjectData();

    // Gebruik de geoptimaliseerde project service
    const success = await optimizedProjectService.syncProjects(db);

    // Stuur response
    res.json(successResponse({
      message: success ? 'Projects synced successfully' : 'Failed to sync projects'
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/over-budget
 *
 * Haal projecten op die over budget zijn
 */
router.get('/over-budget', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();

    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // Get projects over budget
    const projectsWithBudget = await db.all(`
      SELECT p.id, p.name, p.number, p.totalexclvat,
             SUM(pl.amount) as total_amount,
             SUM(pl.amountwritten) as total_written
      FROM projects p
      JOIN projectlines pl ON p.id = pl.project_id
      WHERE p.archived = 0
      GROUP BY p.id
      HAVING total_written > total_amount
    `);

    res.json({
      success: true,
      data: projectsWithBudget,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching over-budget projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch over-budget projects',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/projects/rules-over-budget
 *
 * Haal projecten op met regels die over budget zijn
 */
router.get('/rules-over-budget', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();

    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // Get projects with rules over budget
    const projectsWithRulesOverBudget = await db.all(`
      SELECT DISTINCT p.id, p.name, p.number,
             json_extract(p.company, '$.searchname') as company_name
      FROM projects p
      JOIN project_lines pl ON p.id = pl.project_id
      WHERE p.archived = 0 AND pl.amount_written > pl.amount
    `);

    res.json({
      success: true,
      data: projectsWithRulesOverBudget,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching projects with rules over budget:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects with rules over budget',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/projects/:id/lines
 *
 * Haal projectregels op voor een specifiek project
 */
router.get('/:id/lines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Parse project ID
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      throw new BadRequestError('Invalid project ID');
    }

    // Controleer of het project bestaat
    const project = await db.get(`
      SELECT id, name, number
      FROM projects
      WHERE id = ?
    `, [projectId]);

    if (!project) {
      throw new NotFoundError(`Project with ID ${projectId} not found`);
    }

    // Haal projectregels op uit de database
    const projectLines = await db.all(`
      SELECT
        id,
        project_id,
        ordering,
        internal_note,
        amount,
        amount_written,
        hide_for_timewriting,
        selling_price,
        discount,
        buying_price,
        additional_subject,
        description,
        hide_details,
        created_on,
        updated_on,
        searchname,
        unit_id,
        unit_name,
        invoice_basis_id,
        invoice_basis_name,
        vat_id,
        vat_name,
        row_type_id,
        row_type_name,
        offerprojectbase_id,
        offerprojectbase_name,
        offerprojectbase_discr,
        contract_line_id,
        product_id,
        product_name,
        product_discr
      FROM project_lines
      WHERE project_id = ?
      ORDER BY ordering
    `, [projectId]);

    // Stuur response
    res.json(successResponse({
      project,
      projectLines
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/projects/:id/sync-lines
 *
 * Synchroniseer projectregels voor een specifiek project
 */
router.post('/:id/sync-lines', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Parse project ID
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      throw new BadRequestError('Invalid project ID');
    }

    // Controleer of het project bestaat
    const project = await db.get(`
      SELECT id, name, number
      FROM projects
      WHERE id = ?
    `, [projectId]);

    if (!project) {
      throw new NotFoundError(`Project with ID ${projectId} not found`);
    }

    // Voer het sync-project-lines.js script uit voor dit project
    const { spawn } = require('child_process');
    const syncProcess = spawn('node', [
      'src/scripts/sync-project-lines.js',
      '--project-id', projectId.toString()
    ]);

    let output = '';
    syncProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    syncProcess.stderr.on('data', (data) => {
      console.error(`Sync error: ${data}`);
    });

    await new Promise((resolve, reject) => {
      syncProcess.on('close', (code) => {
        if (code === 0) {
          resolve(null);
        } else {
          reject(new Error(`Sync process exited with code ${code}`));
        }
      });
    });

    // Stuur response
    res.json(successResponse({
      message: `Project lines for project ${projectId} synced successfully`,
      output
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
