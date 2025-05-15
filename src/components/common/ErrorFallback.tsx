import React, { useState } from 'react';
import { Button } from '../ui/button';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, Home, Server } from 'lucide-react';
import { getApiStatus } from '../../services/api';

interface ErrorFallbackProps {
  error?: Error;
  resetErrorBoundary?: () => void;
  message?: string;
}

/**
 * ErrorFallback Component
 *
 * A reusable error fallback component to display when an error occurs.
 * Can be used with ErrorBoundary components.
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetErrorBoundary,
  message = 'Er is een onverwachte fout opgetreden.'
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isCheckingApi, setIsCheckingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<{
    isOnline?: boolean;
    message?: string;
    details?: string;
    responseTime?: number;
  }>({});

  // Function to check API status
  const checkApiStatus = async () => {
    setIsCheckingApi(true);
    try {
      const status = await getApiStatus();

      if (status.isOnline) {
        setApiStatus({
          isOnline: true,
          message: 'API is online',
          responseTime: status.responseTime,
          details: status.data ? JSON.stringify(status.data, null, 2) : undefined
        });
      } else {
        setApiStatus({
          isOnline: false,
          message: status.error || `API returned status: ${status.statusCode} ${status.statusText}`,
          responseTime: status.responseTime
        });
      }
    } catch (err) {
      setApiStatus({
        isOnline: false,
        message: err instanceof Error ? err.message : 'Unknown error checking API'
      });
    } finally {
      setIsCheckingApi(false);
    }
  };

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl p-8 bg-white rounded-lg shadow-lg border border-red-200">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-red-700 mb-2">
              Er is een fout opgetreden
            </h2>

            <p className="text-gray-700 mb-6">{message}</p>

            {error && (
              <div className="mb-6">
                <div
                  className="flex items-center justify-between cursor-pointer bg-red-50 p-3 rounded-t-md border border-red-200"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  <span className="font-medium text-red-800">Foutdetails</span>
                  {showDetails ? (
                    <ChevronUp className="h-5 w-5 text-red-600" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-red-600" />
                  )}
                </div>

                {showDetails && (
                  <div className="bg-red-50 p-4 rounded-b-md border-x border-b border-red-200 overflow-auto max-h-60">
                    <p className="font-bold text-red-800 mb-2">Foutmelding:</p>
                    <p className="text-red-800 font-mono text-sm mb-4">{error.message}</p>

                    {error.stack && (
                      <>
                        <p className="font-bold text-red-800 mb-2">Stack trace:</p>
                        <pre className="text-red-800 font-mono text-xs whitespace-pre-wrap">
                          {error.stack}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => window.location.reload()}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Pagina verversen
                </Button>

                {resetErrorBoundary && (
                  <Button
                    onClick={resetErrorBoundary}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Opnieuw proberen
                  </Button>
                )}

                <Button
                  onClick={() => window.location.href = '/'}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Naar dashboard
                </Button>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <Button
                  onClick={checkApiStatus}
                  variant="outline"
                  size="sm"
                  disabled={isCheckingApi}
                  className="w-full justify-start text-left flex items-center gap-2"
                >
                  <Server className="h-4 w-4" />
                  {isCheckingApi ? 'API-status controleren...' : 'API-status controleren'}
                </Button>

                {apiStatus.isOnline !== undefined && (
                  <div className={`mt-2 p-3 rounded-md text-sm ${
                    apiStatus.isOnline ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}>
                    <div className="font-medium mb-1">
                      {apiStatus.isOnline
                        ? '✅ API-server is online en reageert correct.'
                        : `❌ API-server is niet bereikbaar: ${apiStatus.message}`
                      }
                    </div>

                    {apiStatus.responseTime && (
                      <div className="text-xs opacity-80 mt-1">
                        Responstijd: {Math.round(apiStatus.responseTime)}ms
                      </div>
                    )}

                    {apiStatus.details && (
                      <div className="mt-2">
                        <div
                          className="flex items-center justify-between cursor-pointer p-1 rounded hover:bg-black/5"
                          onClick={() => setShowDetails(!showDetails)}
                        >
                          <span className="text-xs font-medium">API-response details</span>
                          {showDetails ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </div>

                        {showDetails && (
                          <pre className="mt-1 p-2 bg-black/5 rounded text-xs overflow-auto max-h-32">
                            {apiStatus.details}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback;
