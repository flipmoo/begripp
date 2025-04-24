/**
 * ExampleComponent
 * 
 * Een voorbeeld component dat de component richtlijnen volgt.
 * Dit component is bedoeld als referentie voor het maken van nieuwe componenten.
 */
import React, { useState, useCallback, useMemo } from 'react';

// UI componenten
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

// Utilities
import { formatDate } from '../../utils/date-utils';

// Types
import type { ReactNode } from 'react';

/**
 * Props voor het ExampleComponent
 */
interface ExampleComponentProps {
  /** De titel van het component */
  title: string;
  /** De beschrijving van het component */
  description?: string;
  /** De datum om weer te geven */
  date?: Date;
  /** Callback die wordt aangeroepen wanneer op de knop wordt geklikt */
  onButtonClick?: () => void;
  /** Geeft aan of het component in een loading state is */
  isLoading?: boolean;
  /** Geeft aan of het component in een error state is */
  hasError?: boolean;
  /** Error bericht om weer te geven */
  errorMessage?: string;
  /** Child elementen */
  children?: ReactNode;
}

/**
 * ExampleComponent
 * 
 * Een voorbeeld component dat de component richtlijnen volgt.
 * 
 * @example
 * ```tsx
 * <ExampleComponent 
 *   title="Voorbeeld" 
 *   description="Dit is een voorbeeld component"
 *   date={new Date()}
 *   onButtonClick={() => console.log('Button clicked')}
 * >
 *   <p>Child content</p>
 * </ExampleComponent>
 * ```
 */
export function ExampleComponent({
  title,
  description,
  date,
  onButtonClick,
  isLoading = false,
  hasError = false,
  errorMessage = 'Er is een fout opgetreden',
  children,
}: ExampleComponentProps) {
  // State
  const [isExpanded, setIsExpanded] = useState(false);

  // Event handlers
  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prevExpanded => !prevExpanded);
  }, []);

  const handleButtonClick = useCallback(() => {
    if (onButtonClick) {
      onButtonClick();
    }
  }, [onButtonClick]);

  // Memoized values
  const formattedDate = useMemo(() => {
    if (!date) return '';
    return formatDate(date);
  }, [date]);

  // Render helpers
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="ml-2">Laden...</span>
        </div>
      );
    }

    if (hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-800 rounded-md">
          <p>{errorMessage}</p>
        </div>
      );
    }

    return (
      <>
        {description && <p className="text-gray-500 mb-4">{description}</p>}
        {date && <p className="text-sm text-gray-400 mb-4">Datum: {formattedDate}</p>}
        {isExpanded && children && (
          <div className="mt-4 p-4 border rounded-md">
            {children}
          </div>
        )}
      </>
    );
  };

  // Component render
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderContent()}
        <div className="flex justify-between mt-4">
          {children && (
            <Button variant="outline" onClick={handleToggleExpand}>
              {isExpanded ? 'Verbergen' : 'Tonen'}
            </Button>
          )}
          <Button onClick={handleButtonClick} disabled={isLoading || hasError}>
            Actie
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Memoized versie van ExampleComponent
 * Gebruik deze versie wanneer het component vaak opnieuw rendert maar weinig verandert.
 */
export const MemoizedExampleComponent = React.memo(ExampleComponent);
