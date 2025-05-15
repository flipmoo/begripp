/**
 * Update Hours Project ID Script
 *
 * Dit script is niet meer nodig omdat we nu de project_id direct uit de Gripp API halen.
 * We laten het script staan voor backward compatibility, maar het doet nu niets meer.
 */
import { getDatabase } from '../db/database';
import dotenv from 'dotenv';

// Laad environment variables
dotenv.config();

// Main functie
async function main() {
  console.log('Start update hours project_id script');

  try {
    // Initialiseer database connectie
    const db = await getDatabase();
    console.log('Database connection established');

    // Controleer hoeveel uren er zonder project_id zijn
    const hours = await db.all(`
      SELECT COUNT(*) as count
      FROM hours
      WHERE project_id IS NULL OR project_id = 0
    `);

    console.log(`Found ${hours[0].count} hours without project_id`);

    // We doen niets meer met deze uren, omdat we nu de project_id direct uit de Gripp API halen
    console.log('Dit script is niet meer nodig omdat we nu de project_id direct uit de Gripp API halen.');
    console.log('Gebruik in plaats daarvan het sync-hours script om de uren opnieuw te synchroniseren.');

    console.log('Update completed: 0 hours updated');

  } catch (error) {
    console.error('Error updating hours project_id:', error);
  }
}

// Start het script
main().catch(console.error);
