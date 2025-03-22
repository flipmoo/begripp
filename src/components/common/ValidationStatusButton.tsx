import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import ValidationDashboard from '../validation/ValidationDashboard';
import DataCorrectionStatus from '../dashboard/DataCorrectionStatus';
import { ValidationObserver, ValidationResult } from '../../utils/data-validator';
import { isFeatureEnabled } from '../../utils/feature-flags';
import { Badge } from '../ui/badge';

const ValidationStatusButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [hasIssues, setHasIssues] = useState(false);
  const [issueCount, setIssueCount] = useState(0);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);

  // Subscribe to ValidationObserver to receive new validation results
  useEffect(() => {
    const unsubscribe = ValidationObserver.subscribe((result) => {
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

  // Update issue count and status whenever validation results change
  useEffect(() => {
    if (validationResults.length === 0) {
      setHasIssues(false);
      setIssueCount(0);
      return;
    }

    // Count all issues from all validation results
    let count = 0;
    for (const result of validationResults) {
      // Only count issues that are not calculationMethod (which is just informational)
      const relevantIssues = result.issues.filter(issue => issue.field !== 'calculationMethod');
      count += relevantIssues.length;
    }
    
    setHasIssues(count > 0);
    setIssueCount(count);
  }, [validationResults]);

  // If validation feature is disabled, don't show anything
  if (!isFeatureEnabled('ENABLE_DATA_VALIDATION') && !isFeatureEnabled('ENABLE_DATA_CORRECTION')) {
    return null;
  }

  return (
    <>
      <Button
        variant={hasIssues ? "destructive" : "ghost"}
        size="sm"
        onClick={() => setOpen(true)}
        className="relative"
      >
        {hasIssues ? (
          <>
            <AlertCircle className="h-4 w-4 mr-1" />
            <span>Validatie</span>
            {issueCount > 0 && (
              <Badge variant="destructive" className="ml-1 absolute -top-2 -right-2 text-[10px] min-w-5 h-5 flex items-center justify-center">
                {issueCount}
              </Badge>
            )}
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>Validatie</span>
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex items-center justify-between">
            <DialogTitle>Data Validatie & Correctie</DialogTitle>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          
          <div className="space-y-6">
            {isFeatureEnabled('ENABLE_DATA_VALIDATION') && (
              <ValidationDashboard title="Data Validatie Monitor" />
            )}
            
            {isFeatureEnabled('ENABLE_DATA_CORRECTION') && (
              <DataCorrectionStatus />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ValidationStatusButton; 