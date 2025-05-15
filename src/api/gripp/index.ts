/**
 * Gripp API Client
 * 
 * Dit bestand exporteert de Gripp API client. In productie wordt de echte Gripp API gebruikt,
 * maar in ontwikkeling wordt de lokale proxy gebruikt om CORS-problemen te voorkomen.
 */

// Exporteer de client override in plaats van de echte client
export * from './client-override';
