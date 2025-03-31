// Define types for validation
export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'warning' | 'error' | 'info';
  code?: string;
}

export interface ValidationMetadata {
  timestamp: number;
  source: string;
  target?: string;
}

export interface ValidationResult {
  metadata: ValidationMetadata;
  issues: ValidationIssue[];
}

type ValidationCallback = (result: ValidationResult) => void;

// Singleton pattern for the ValidationObserver
class ValidationObserverClass {
  private listeners: ValidationCallback[] = [];

  // Add a listener to be notified of validation issues
  subscribe(callback: ValidationCallback): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Report a validation issue
  report(result: ValidationResult): void {
    // Notify all listeners
    this.listeners.forEach(callback => callback(result));
  }

  // Helper to create and report a validation result
  reportIssue(
    source: string, 
    issues: ValidationIssue[], 
    target?: string
  ): void {
    const result: ValidationResult = {
      metadata: {
        timestamp: Date.now(),
        source,
        target
      },
      issues
    };
    
    this.report(result);
  }

  // Validate that a value is not null or undefined
  validateRequired(
    source: string,
    field: string,
    value: any,
    target?: string
  ): boolean {
    if (value === null || value === undefined) {
      this.reportIssue(
        source,
        [{
          field,
          message: `${field} is verplicht`,
          severity: 'error',
          code: 'REQUIRED'
        }],
        target
      );
      return false;
    }
    return true;
  }

  // Validate a date is within a valid range
  validateDateRange(
    source: string,
    field: string,
    value: Date,
    minDate?: Date,
    maxDate?: Date,
    target?: string
  ): boolean {
    if (!value || !(value instanceof Date)) {
      this.reportIssue(
        source,
        [{
          field,
          message: `${field} moet een geldige datum zijn`,
          severity: 'error',
          code: 'INVALID_DATE'
        }],
        target
      );
      return false;
    }

    if (minDate && value < minDate) {
      this.reportIssue(
        source,
        [{
          field,
          message: `${field} mag niet voor ${minDate.toLocaleDateString('nl-NL')} liggen`,
          severity: 'error',
          code: 'DATE_TOO_EARLY'
        }],
        target
      );
      return false;
    }

    if (maxDate && value > maxDate) {
      this.reportIssue(
        source,
        [{
          field,
          message: `${field} mag niet na ${maxDate.toLocaleDateString('nl-NL')} liggen`,
          severity: 'error',
          code: 'DATE_TOO_LATE'
        }],
        target
      );
      return false;
    }

    return true;
  }
}

// Export a singleton instance of the ValidationObserver
export const ValidationObserver = new ValidationObserverClass(); 