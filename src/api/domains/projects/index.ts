import { Router, Request, Response } from 'express';
import { handleError } from '../../shared/error';

const router = Router();

// Begin met één basis endpoint om te valideren
router.get('/', async (req: Request, res: Response) => {
  try {
    // Simpele proxy naar bestaande projecten functionaliteit om te beginnen
    // In toekomstige iteraties kunnen we de volledige logica hier implementeren
    const response = await fetch('http://localhost:3002/api/projects');
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    return handleError(res, error as Error, 'projects');
  }
});

export default router; 