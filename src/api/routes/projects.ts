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
    
    // Clear de project cache als nodig
    if (forceRefresh) {
      console.log('Force refresh requested, clearing project cache');
      cacheService.clearProjectData();
    }
    
    // Haal projecten op
    const projects = await projectService.getActiveProjects(db);
    
    // Stuur response
    res.json(successResponse(projects, {
      fromCache: !forceRefresh && cacheService.hasProjectData()
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

export default router;
