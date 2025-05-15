import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { FRONTEND_PORT, API_PORT } from '../../config/ports';
import axios from 'axios';
import { toast } from '../ui/use-toast';
import { MdRefresh } from 'react-icons/md';
import { API_ENDPOINTS } from '../../config/api';

interface ServerStatus {
  online: boolean;
  port: number;
  responseTime?: number;
  lastChecked: Date;
  checking: boolean;
}

const ApiStatusButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<ServerStatus>({
    online: false,
    port: API_PORT,
    lastChecked: new Date(),
    checking: false
  });
  const [isChecking, setIsChecking] = useState(false);
  const [restartingApi, setRestartingApi] = useState(false);

  const checkApiStatus = async () => {
    try {
      setIsChecking(true);
      setApiStatus(prev => ({ ...prev, checking: true }));

      const start = Date.now();

      // Use the health endpoint to check API status with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

      try {
        const response = await fetch(API_ENDPOINTS.HEALTH.CHECK, {
          method: 'GET',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const end = Date.now();
        const responseTime = end - start;

        // If we get any response, the API is online
        setApiStatus({
          online: true,
          port: API_PORT,
          responseTime,
          lastChecked: new Date(),
          checking: false
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError; // Re-throw to be caught by the outer catch
      }
    } catch (error) {
      console.error('Error checking API status:', error);
      setApiStatus({
        online: false,
        port: API_PORT,
        lastChecked: new Date(),
        checking: false
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Check API status when component mounts
  useEffect(() => {
    // Delay the initial check to allow the app to load first
    const initialCheckTimeout = setTimeout(() => {
      checkApiStatus();
    }, 5000);

    // Set up periodic check every 5 minutes to reduce load
    const intervalId = setInterval(checkApiStatus, 300000);

    return () => {
      clearTimeout(initialCheckTimeout);
      clearInterval(intervalId);
    };
  }, []);

  const handleManualCheck = () => {
    checkApiStatus();
  };

  const handleRestartApi = () => {
    setRestartingApi(true);

    // Show a toast message
    toast({
      title: 'API Server status check',
      description: 'Checking API server status...',
    });

    // Check the API status using the health endpoint with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    fetch(API_ENDPOINTS.HEALTH.CHECK, {
      method: 'GET',
      signal: controller.signal
    })
      .then(() => {
        clearTimeout(timeoutId);
        // Success - API is responding
        toast({
          title: 'API Server is Online',
          description: 'The API server is responding correctly.',
        });
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        // Error - API is not responding
        console.error('API health check error:', error);
        toast({
          title: 'API Server is Offline',
          description: 'The API server is not responding.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        // Always update the status and reset the loading state
        checkApiStatus();
        setRestartingApi(false);
      });
  };

  return (
    <>
      <Button
        variant={apiStatus.online ? "ghost" : "destructive"}
        size="sm"
        onClick={() => setOpen(true)}
        className="relative"
      >
        {apiStatus.online ? (
          <>
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>API</span>
            {apiStatus.responseTime && apiStatus.responseTime > 500 && (
              <Badge variant="outline" className="ml-1 absolute -top-2 -right-2 text-[10px] min-w-5 h-5 flex items-center justify-center text-amber-500">
                !
              </Badge>
            )}
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 mr-1" />
            <span>API</span>
            <Badge variant="destructive" className="ml-1 absolute -top-2 -right-2 text-[10px] min-w-5 h-5 flex items-center justify-center">
              !
            </Badge>
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex items-center justify-between">
            <DialogTitle>API Server Status</DialogTitle>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="font-semibold">Status:</div>
              <div className="flex items-center">
                {apiStatus.online ? (
                  <><CheckCircle className="h-4 w-4 mr-2 text-green-500" /> Online</>
                ) : (
                  <><AlertCircle className="h-4 w-4 mr-2 text-red-500" /> Offline</>
                )}
              </div>

              <div className="font-semibold">Poort:</div>
              <div>{apiStatus.port}</div>

              {apiStatus.responseTime && (
                <>
                  <div className="font-semibold">Responstijd:</div>
                  <div className={apiStatus.responseTime > 500 ? "text-amber-500" : "text-green-500"}>
                    {apiStatus.responseTime}ms
                  </div>
                </>
              )}

              <div className="font-semibold">Laatst gecontroleerd:</div>
              <div>{apiStatus.lastChecked.toLocaleTimeString()}</div>

              <div className="font-semibold">Frontend poort:</div>
              <div>{FRONTEND_PORT}</div>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={isChecking}
                onClick={handleManualCheck}
              >
                {isChecking ? 'Controleren...' : 'Controleer opnieuw'}
              </Button>

              <Button
                variant="destructive"
                size="sm"
                disabled={isChecking || apiStatus.online}
                onClick={handleRestartApi}
              >
                Herstart API Server
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApiStatusButton;