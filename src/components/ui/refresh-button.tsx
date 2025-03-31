import React, { useState } from 'react';
import { Button } from './button';
import { RefreshCcw, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { forceRefreshCache } from '../../api/dashboard/utils';

interface RefreshButtonProps {
  tooltipText?: string;
  onBeforeRefresh?: () => void;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  tooltipText = 'Data verversen',
  onBeforeRefresh,
  onClick,
  variant = 'default',
  size = 'sm'
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    
    try {
      if (onBeforeRefresh) {
        onBeforeRefresh();
      }
      
      // If a custom onClick handler is provided, use it
      if (onClick) {
        await onClick();
      } else {
        // Default behavior: force refresh all data through cache refresh
        await forceRefreshCache();
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      // This may not be called if page refreshes
      setIsRefreshing(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-full"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}; 