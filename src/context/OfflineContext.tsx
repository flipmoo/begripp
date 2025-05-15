import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkApiHealth } from '../services/api';

interface OfflineContextType {
  isOffline: boolean;
  setOfflineMode: (offline: boolean) => void;
  lastChecked: Date | null;
  checkConnection: () => Promise<boolean>;
  isChecking: boolean;
}

const OfflineContext = createContext<OfflineContextType>({
  isOffline: false,
  setOfflineMode: () => {},
  lastChecked: null,
  checkConnection: async () => false,
  isChecking: false,
});

export const useOffline = () => useContext(OfflineContext);

interface OfflineProviderProps {
  children: ReactNode;
  checkInterval?: number; // in milliseconds
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({
  children,
  checkInterval = 30000 // Default: check every 30 seconds
}) => {
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkConnection = async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      // Controleer of de API bereikbaar is
      const isOnline = await checkApiHealth();
      setIsOffline(!isOnline);
      setLastChecked(new Date());
      return isOnline;
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsOffline(true);
      setLastChecked(new Date());
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const setOfflineMode = (offline: boolean) => {
    setIsOffline(offline);
    setLastChecked(new Date());
  };

  // Initial connection check
  useEffect(() => {
    checkConnection();
  }, []);

  // Periodic connection check
  useEffect(() => {
    if (checkInterval <= 0) return;

    const intervalId = setInterval(() => {
      checkConnection();
    }, checkInterval);

    return () => clearInterval(intervalId);
  }, [checkInterval]);

  // Listen for online/offline browser events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Browser reports online status');
      checkConnection();
    };

    const handleOffline = () => {
      console.log('Browser reports offline status');
      setIsOffline(true);
      setLastChecked(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOffline,
        setOfflineMode,
        lastChecked,
        checkConnection,
        isChecking,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};
