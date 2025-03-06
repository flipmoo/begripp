import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';

const app = express();
const port = 3002;

// Enable CORS
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Parse JSON bodies
app.use(express.json());

// Check if API key is present
const apiKey = process.env.VITE_GRIPP_API_KEY;
console.log('API Key present:', !!apiKey);

if (!apiKey) {
  throw new Error('VITE_GRIPP_API_KEY is required');
}

// Proxy endpoint
app.post('/public/api3.php', async (req, res) => {
  try {
    const response = await fetch('https://api.gripp.com/public/api3.php', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Minimal proxy running at http://localhost:${port}`);
}); 