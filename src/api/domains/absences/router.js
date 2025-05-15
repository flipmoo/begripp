import express from 'express';

const router = express.Router();

// Get absences endpoint
router.get('/', async (req, res) => {
  try {
    // Transparant doorsturen met query parameters
    const url = new URL(`http://localhost:3004/api/absences`);

    // Kopieer alle query parameters (startDate en endDate)
    Object.entries(req.query).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    console.log(`Absences proxy to: ${url.toString()}`);

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to fetch absences'
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('Error in absences proxy:', error);
    return res.status(500).json({
      error: 'API request failed',
      details: error.message
    });
  }
});

// Create new absence endpoint
router.post('/', async (req, res) => {
  try {
    const absenceData = req.body;
    console.log('Creating new absence:', absenceData);

    const response = await fetch('http://localhost:3004/api/absences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(absenceData)
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to create absence'
      });
    }

    const data = await response.json();
    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating absence:', error);
    return res.status(500).json({
      error: 'API request failed',
      details: error.message
    });
  }
});

export default router;