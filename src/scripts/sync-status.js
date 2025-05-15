/**
 * Synchronisatie status helper
 * 
 * Dit script bevat functies om de status van synchronisatieprocessen bij te houden.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name using ES modules approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pad naar het status bestand
const statusFilePath = path.join(__dirname, '../db/sync-status.json');

/**
 * Initialiseer het status bestand als het niet bestaat
 */
export function initStatusFile() {
  try {
    if (!fs.existsSync(statusFilePath)) {
      const initialStatus = {
        projectSyncInProgress: false,
        offerSyncInProgress: false,
        hoursSyncInProgress: false,
        lastProjectSync: null,
        lastOfferSync: null,
        lastHoursSync: null,
        updatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(statusFilePath, JSON.stringify(initialStatus, null, 2));
      console.log('Sync status file initialized');
    }
  } catch (error) {
    console.error('Error initializing sync status file:', error);
  }
}

/**
 * Lees de huidige status
 */
export function getStatus() {
  try {
    initStatusFile();
    
    const statusData = fs.readFileSync(statusFilePath, 'utf8');
    return JSON.parse(statusData);
  } catch (error) {
    console.error('Error reading sync status:', error);
    return {
      projectSyncInProgress: false,
      offerSyncInProgress: false,
      hoursSyncInProgress: false,
      lastProjectSync: null,
      lastOfferSync: null,
      lastHoursSync: null,
      updatedAt: new Date().toISOString()
    };
  }
}

/**
 * Update de status
 */
export function updateStatus(updates) {
  try {
    const currentStatus = getStatus();
    const newStatus = { ...currentStatus, ...updates, updatedAt: new Date().toISOString() };
    
    fs.writeFileSync(statusFilePath, JSON.stringify(newStatus, null, 2));
    console.log('Sync status updated:', updates);
    
    return newStatus;
  } catch (error) {
    console.error('Error updating sync status:', error);
    return null;
  }
}

/**
 * Markeer een synchronisatie als gestart
 */
export function markSyncStarted(type) {
  const updates = {};
  
  if (type === 'projects') {
    updates.projectSyncInProgress = true;
  } else if (type === 'offers') {
    updates.offerSyncInProgress = true;
  } else if (type === 'hours') {
    updates.hoursSyncInProgress = true;
  }
  
  return updateStatus(updates);
}

/**
 * Markeer een synchronisatie als voltooid
 */
export function markSyncCompleted(type) {
  const updates = {};
  const now = new Date().toISOString();
  
  if (type === 'projects') {
    updates.projectSyncInProgress = false;
    updates.lastProjectSync = now;
  } else if (type === 'offers') {
    updates.offerSyncInProgress = false;
    updates.lastOfferSync = now;
  } else if (type === 'hours') {
    updates.hoursSyncInProgress = false;
    updates.lastHoursSync = now;
  }
  
  return updateStatus(updates);
}

// Initialiseer het status bestand bij het importeren van deze module
initStatusFile();
