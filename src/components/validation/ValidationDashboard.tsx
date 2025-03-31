import React, { useState, useEffect } from 'react';
import { ValidationObserver, ValidationResult } from '../../utils/data-validator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface ValidationDashboardProps {
  title?: string;
}

const ValidationDashboard: React.FC<ValidationDashboardProps> = ({ title = "Validatie Dashboard" }) => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

  // Subscribe to ValidationObserver to receive new validation results
  useEffect(() => {
    const unsubscribe = ValidationObserver.subscribe((result: ValidationResult) => {
      setValidationResults(prev => {
        // Only add new results (avoid duplicates)
        const exists = prev.some(r => 
          r.metadata.timestamp === result.metadata.timestamp && 
          r.metadata.source === result.metadata.source && 
          r.metadata.target === result.metadata.target
        );
        
        if (exists) return prev;
        
        // Limit to last 100 results
        const newResults = [result, ...prev];
        if (newResults.length > 100) {
          return newResults.slice(0, 100);
        }
        return newResults;
      });
    });
    
    return unsubscribe;
  }, []);

  // Group validation results by source system
  const groupedResults = validationResults.reduce((groups, result) => {
    const source = result.metadata.source || 'Onbekend';
    if (!groups[source]) {
      groups[source] = [];
    }
    groups[source].push(result);
    return groups;
  }, {} as Record<string, ValidationResult[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Overzicht van data validatie resultaten
        </CardDescription>
      </CardHeader>
      <CardContent>
        {Object.keys(groupedResults).length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mb-2" />
            <p>Geen validatie resultaten beschikbaar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedResults).map(([source, results]) => (
              <div key={source} className="border rounded-md p-4">
                <h3 className="font-medium mb-2">{source}</h3>
                <div className="space-y-2">
                  {results.map((result: ValidationResult, index: number) => (
                    <div key={`${result.metadata.timestamp}-${index}`} className="text-sm">
                      <div className="flex items-center gap-2">
                        {result.issues.length > 0 ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <span>
                          {result.metadata.target || 'Onbekend'} - 
                          {new Date(result.metadata.timestamp).toLocaleString('nl-NL')}
                        </span>
                      </div>
                      {result.issues.length > 0 && (
                        <ul className="ml-6 mt-1 list-disc">
                          {result.issues.map((issue, i: number) => (
                            <li key={i} className="text-destructive">
                              {issue.field}: {issue.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ValidationDashboard; 