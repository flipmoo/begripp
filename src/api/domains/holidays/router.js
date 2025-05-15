import express from 'express';

const router = express.Router();

// Get all holidays
router.get('/', async (req, res) => {
  try {
    console.log('Fetching all holidays');

    const response = await fetch('http://localhost:3004/api/holidays');

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to fetch holidays'
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return res.status(500).json({
      error: 'API request failed',
      details: error.message
    });
  }
});

// Create new holiday
router.post('/', async (req, res) => {
  try {
    const holidayData = req.body;
    console.log('Creating new holiday:', holidayData);

    const response = await fetch('http://localhost:3004/api/holidays', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(holidayData)
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to create holiday'
      });
    }

    const data = await response.json();
    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating holiday:', error);
    return res.status(500).json({
      error: 'API request failed',
      details: error.message
    });
  }
});

// Delete holiday
router.delete('/:date', async (req, res) => {
  try {
    const date = req.params.date;
    console.log(`Deleting holiday for date: ${date}`);

    const response = await fetch(`http://localhost:3004/api/holidays/${date}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to delete holiday for date ${date}`
      });
    }

    return res.status(204).end();
  } catch (error) {
    console.error(`Error deleting holiday for date ${req.params.date}:`, error);
    return res.status(500).json({
      error: 'API request failed',
      details: error.message
    });
  }
});

// Update holiday
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const holidayData = req.body;
    console.log(`Updating holiday with ID: ${id}`, holidayData);

    const response = await fetch(`http://localhost:3002/api/holidays/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(holidayData)
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to update holiday with ID ${id}`
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error(`Error updating holiday with ID ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'API request failed',
      details: error.message
    });
  }
});

export default router;