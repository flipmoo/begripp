import { NextApiRequest, NextApiResponse } from 'next';
import { getGrippClient } from '../../../../services/gripp.service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const grippClient = await getGrippClient();
    
    // Haal facturen op van de Gripp API
    const response = await grippClient.get('/invoice', {
      params: {
        // Optionele parameters zoals limiet of filters kunnen hier worden toegevoegd
        limit: 500, // Haal een redelijk aantal facturen op
      }
    });

    const invoices = response.data?.items || [];
    
    return res.status(200).json({ invoices });
  } catch (error) {
    console.error('Error fetching invoices from Gripp API:', error);
    return res.status(500).json({ error: 'Failed to fetch invoices' });
  }
} 