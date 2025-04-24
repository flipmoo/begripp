/**
 * Error Handler Hook
 * 
 * Custom hook voor het afhandelen van fouten en het tonen van foutmeldingen.
 */
import { useCallback } from 'react';
import { useToast } from '../components/ui/use-toast';

/**
 * Interface voor de opties van useErrorHandler
 */
interface ErrorHandlerOptions {
  /** Titel voor de toast melding */
  title?: string;
  /** Beschrijving voor de toast melding (overschrijft de standaard foutmelding) */
  description?: string;
  /** Geeft aan of de error gelogd moet worden naar de console */
  logToConsole?: boolean;
  /** Extra context informatie voor logging */
  context?: Record<string, any>;
  /** Callback functie die wordt aangeroepen na het afhandelen van de error */
  onError?: (error: any) => void;
}

/**
 * Functie voor het genereren van een gebruiksvriendelijke foutmelding
 * @param error De error
 * @returns Een gebruiksvriendelijke foutmelding
 */
export function getUserFriendlyErrorMessage(error: any): string {
  // Als de error een message property heeft, gebruik deze
  if (error?.message) {
    // Verwijder technische details uit de foutmelding
    const message = error.message
      .replace(/^Error: /, '')
      .replace(/\[.*\]/, '')
      .trim();
    
    // Als de foutmelding te technisch lijkt, gebruik een generieke melding
    if (message.includes('TypeError') || 
        message.includes('undefined') || 
        message.includes('null') ||
        message.length > 100) {
      return 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.';
    }
    
    return message;
  }
  
  // Als de error een response property heeft (axios error)
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  // Als de error een status property heeft (fetch error)
  if (error?.status) {
    switch (error.status) {
      case 400:
        return 'De aanvraag bevat ongeldige gegevens.';
      case 401:
        return 'Je bent niet geautoriseerd om deze actie uit te voeren.';
      case 403:
        return 'Je hebt geen toegang tot deze functionaliteit.';
      case 404:
        return 'De gevraagde informatie kon niet worden gevonden.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Er is een probleem met de server. Probeer het later opnieuw.';
      default:
        return `Er is een fout opgetreden (status ${error.status}).`;
    }
  }
  
  // Fallback voor onbekende errors
  return 'Er is een onverwachte fout opgetreden. Probeer het later opnieuw.';
}

/**
 * Functie voor het loggen van errors naar de console
 * @param error De error om te loggen
 * @param context Extra context informatie
 */
export function logError(error: any, context: Record<string, any> = {}): void {
  console.error('Error:', error);
  
  if (Object.keys(context).length > 0) {
    console.error('Error context:', context);
  }
  
  if (error?.stack) {
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Hook voor het afhandelen van fouten
 * @returns Een functie voor het afhandelen van fouten
 */
export function useErrorHandler() {
  const { toast } = useToast();

  /**
   * Functie voor het afhandelen van fouten
   * @param error De error om af te handelen
   * @param options Opties voor error handling
   */
  const handleError = useCallback((error: any, options: ErrorHandlerOptions = {}) => {
    const {
      title = 'Er is een fout opgetreden',
      description,
      logToConsole = true,
      context = {},
      onError,
    } = options;

    // Log de error als logToConsole true is
    if (logToConsole) {
      logError(error, context);
    }

    // Toon een toast melding
    toast({
      title,
      description: description || getUserFriendlyErrorMessage(error),
      variant: 'destructive',
    });

    // Roep de onError callback aan als die bestaat
    if (onError) {
      onError(error);
    }
  }, [toast]);

  return handleError;
}

/**
 * Hook voor het maken van een error handler voor een specifieke operatie
 * @param operationName Naam van de operatie
 * @param options Opties voor error handling
 * @returns Een functie voor het afhandelen van fouten
 */
export function useOperationErrorHandler(operationName: string, options: Omit<ErrorHandlerOptions, 'context'> = {}) {
  const handleError = useErrorHandler();

  return useCallback((error: any) => {
    handleError(error, {
      title: options.title || `Fout bij ${operationName}`,
      description: options.description,
      logToConsole: options.logToConsole,
      context: { operation: operationName },
      onError: options.onError,
    });
  }, [handleError, operationName, options]);
}
