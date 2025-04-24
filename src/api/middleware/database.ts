/**
 * Database Middleware
 * 
 * Dit bestand bevat middleware voor het controleren van de database connectie.
 */
import { Request, Response, NextFunction } from 'express';
import { Database } from 'sqlite';
import { DatabaseError } from './error-handler';

/**
 * Middleware voor het controleren van de database connectie
 * 
 * @param db De database connectie
 * @returns Middleware functie
 */
export function requireDatabase(db: Database | null) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!db) {
      next(new DatabaseError('Database not initialized'));
      return;
    }
    
    // Voeg de database toe aan de request
    (req as any).db = db;
    next();
  };
}
