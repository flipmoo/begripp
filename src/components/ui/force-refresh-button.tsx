/**
 * ForceRefreshButton Component
 * 
 * A button component that triggers a refresh action with visual feedback.
 * Used to force refresh data from the API, bypassing any cache.
 */

import React, { useState } from 'react';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { RefreshCw } from 'lucide-react';

interface ForceRefreshButtonProps {
  tooltipText?: string;
  onRefresh: () => Promise<void>;
  className?: string;
}

export const ForceRefreshButton: React.FC<ForceRefreshButtonProps> = ({
  tooltipText = 'Refresh Data',
  onRefresh,
  className = '',
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className={className}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
