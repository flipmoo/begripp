import express from 'express';

const router = express.Router();

// Basic endpoint that just proxies to the original API
router.get('/', async (req, res) => {
  try {
    // Transparant doorsturen met query parameters
    const url = new URL(`http://localhost:3002/api/employees`);
    
    // Kopieer alle query parameters
    Object.entries(req.query).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    
    console.log(`Employees proxy to: ${url.toString()}`);
    
    const response = await fetch(url);
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('Error in employees proxy:', error);
    return res.status(500).json({ 
      error: 'API request failed', 
      details: error.message 
    });
  }
});

export default router; 