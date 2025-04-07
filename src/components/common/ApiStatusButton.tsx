import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { FRONTEND_PORT, API_PORT } from '../../config/ports';
import axios from 'axios';
import { toast } from '../ui/use-toast';
import { MdRefresh } from 'react-icons/md';

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
      
      // Gebruik relatieve URL in plaats van hardcoded localhost
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const end = Date.now();
      const responseTime = end - start;
      
      if (response.ok) {
        const data = await response.json();
        setApiStatus({
          online: true,
          port: API_PORT,
          responseTime,
          lastChecked: new Date(),
          checking: false
        });
      } else {
        setApiStatus({
          online: false,
          port: API_PORT,
          responseTime,
          lastChecked: new Date(),
          checking: false
        });
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
    checkApiStatus();
    
    // Set up periodic check every 30 seconds
    const intervalId = setInterval(checkApiStatus, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const handleManualCheck = () => {
    checkApiStatus();
  };

  const handleRestartApi = () => {
    setRestartingApi(true);
    
    // Gebruik relatieve URL in plaats van hardcoded localhost
    fetch('/api/restart', {
      method: 'GET',
    })
      .then(response => {
        if (response.ok) {
          toast({
            title: 'API Server wordt herstart',
            description: 'Dit kan enkele momenten duren...',
          });
          
          // Wacht even en check dan opnieuw de status
          setTimeout(() => {
            checkApiStatus();
            setRestartingApi(false);
          }, 10000);
        } else {
          toast({
            variant: 'destructive',
            title: 'Fout bij herstarten',
            description: 'De API server kon niet worden herstart.',
          });
          setRestartingApi(false);
        }
      })
      .catch(error => {
        console.error('Error restarting API:', error);
        toast({
          variant: 'destructive',
          title: 'Fout bij herstarten',
          description: 'De API server kon niet worden herstart.',
        });
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