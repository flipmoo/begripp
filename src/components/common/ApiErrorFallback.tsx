import React from 'react';
import { Button } from '../ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ApiErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

/**
 * ApiErrorFallback Component
 * 
 * A component to display when an API error occurs.
 * Provides options to retry the request or navigate to the dashboard.
 */
const ApiErrorFallback: React.FC<ApiErrorFallbackProps> = ({
  title = 'API Server Error',
  message = 'Er is een probleem met de verbinding naar de API server. Probeer het later opnieuw.',
  onRetry,
  isRetrying = false
}) => {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-6 my-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-lg font-medium text-red-800">{title}</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{message}</p>
          </div>
          <div className="mt-4 flex space-x-3">
            {onRetry && (
              <Button 
                variant="outline" 
                onClick={onRetry}
                disabled={isRetrying}
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Opnieuw proberen...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Opnieuw proberen
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              Naar dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiErrorFallback;
