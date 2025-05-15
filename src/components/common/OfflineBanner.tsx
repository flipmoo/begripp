import React from 'react';
import { useOffline } from '../../context/OfflineContext';
import { Button } from '../ui/button';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

/**
 * OfflineBanner Component
 * 
 * Displays a banner when the application is in offline mode.
 */
const OfflineBanner: React.FC = () => {
  const { isOffline, checkConnection, lastChecked, isChecking } = useOffline();

  if (!isOffline) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <WifiOff className="h-5 w-5 text-amber-600" />
          <span className="text-amber-800 font-medium">
            Offline modus - API server is niet bereikbaar
          </span>
          {lastChecked && (
            <span className="text-amber-600 text-sm">
              (Laatste check: {formatDistanceToNow(lastChecked, { addSuffix: true, locale: nl })})
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200"
          onClick={() => checkConnection()}
          disabled={isChecking}
        >
          {isChecking ? (
            <>
              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
              Controleren...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-3 w-3" />
              Opnieuw proberen
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default OfflineBanner;
