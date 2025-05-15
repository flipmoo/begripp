import express from 'express';

const router = express.Router();

// Basic endpoint that just proxies to the original API
router.get('/', async (req, res) => {
  try {
    // Transparant doorsturen met query parameters
    const url = new URL(`http://localhost:3004/api/projects`);

    // Kopieer alle query parameters
    Object.entries(req.query).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    console.log(`Projects proxy to: ${url.toString()}`);

    const response = await fetch(url);
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('Error in projects proxy:', error);
    return res.status(500).json({
      error: 'API request failed',
      details: error.message
    });
  }
});

// Project details endpoint
router.get('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    console.log(`Fetching project details for ID: ${projectId}`);

    const url = `http://localhost:3004/api/projects/${projectId}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch project with ID ${projectId}`
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error(`Error fetching project ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'API request failed',
      details: error.message
    });
  }
});

export default router;