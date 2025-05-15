/**
 * Synchroniseer data van de laatste 3 maanden
 *
 * Dit script synchroniseert projecten, offertes en uren van de laatste 3 maanden.
 * Het script kan worden uitgevoerd met: node src/scripts/sync-last-three-months.js
 */

import { exec } from 'child_process';
import { promisify } from 'util';
const execPromise = promisify(exec);

async function syncLastThreeMonths() {
  try {
    console.log('Synchroniseren van data van de laatste 3 maanden...');

    // Bereken de datum van 3 maanden geleden
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    // Formatteer de datum als YYYY-MM-DD
    const startDate = threeMonthsAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    console.log(`Synchroniseren van data van ${startDate} tot ${endDate}...`);

    // Stap 1: Synchroniseer projecten
    console.log('Stap 1: Synchroniseren van projecten...');
    await execPromise('node src/scripts/sync-projects.js');

    // Stap 2: Synchroniseer offertes
    console.log('Stap 2: Synchroniseren van offertes...');
    await execPromise('node src/scripts/sync-offers.js');

    // Stap 3: Synchroniseer uren van de laatste 3 maanden
    console.log('Stap 3: Synchroniseren van uren van de laatste 3 maanden...');

    // Haal de huidige jaar op
    const currentYear = now.getFullYear();

    // Als de periode over meerdere jaren gaat, synchroniseer alle betrokken jaren
    const years = new Set();

    // Voeg het jaar van 3 maanden geleden toe
    years.add(threeMonthsAgo.getFullYear());

    // Voeg het huidige jaar toe
    years.add(currentYear);

    // Synchroniseer alle unieke jaren
    for (const yearToSync of years) {
      console.log(`Synchroniseren van uren voor jaar ${yearToSync}...`);
      await execPromise(`node src/scripts/sync-hours.js ${yearToSync}`);
    }

    // Stap 4: Update offerprojectbase_discr in hours tabel
    console.log('Stap 4: Bijwerken van offerprojectbase_discr in hours tabel...');
    await execPromise('node src/scripts/update-hours-offerprojectbase-discr.js');

    console.log('Synchronisatie van data van de laatste 3 maanden voltooid!');

  } catch (error) {
    console.error('Fout bij synchroniseren van data van de laatste 3 maanden:', error);
    process.exit(1);
  }
}

// Voer de synchronisatie uit
syncLastThreeMonths();
