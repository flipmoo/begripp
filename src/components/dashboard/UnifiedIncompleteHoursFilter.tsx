/**
 * UnifiedIncompleteHoursFilter Component
 * 
 * This component serves as a wrapper around the existing IncompleteHoursFilter component
 * to maintain compatibility with the unified data structure approach.
 */

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import IncompleteHoursFilter from './IncompleteHoursFilter';

export interface UnifiedIncompleteHoursFilterRef {
  refreshData: () => void;
}

const UnifiedIncompleteHoursFilter = forwardRef<UnifiedIncompleteHoursFilterRef>((props, ref) => {
  const incompleteHoursFilterRef = useRef<any>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    refreshData: () => {
      if (incompleteHoursFilterRef.current && incompleteHoursFilterRef.current.refreshData) {
        incompleteHoursFilterRef.current.refreshData();
      }
    }
  }));

  return <IncompleteHoursFilter ref={incompleteHoursFilterRef} />;
});

UnifiedIncompleteHoursFilter.displayName = 'UnifiedIncompleteHoursFilter';

export default UnifiedIncompleteHoursFilter;
