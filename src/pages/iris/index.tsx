import React, { useState } from 'react';
import { IrisProvider, useIris } from '../../contexts/IrisContext';
import { RevenueTable } from '../../components/iris/RevenueTable';
import { KpiOverview } from '../../components/iris/KpiOverview';
import { MonthlyTargets } from '../../components/iris/MonthlyTargets';
import { DataManagementPanel } from '../../components/iris/DataManagementPanel';
import { Loader2, RefreshCw, Download, Database, Calendar, ChevronDown } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useToast } from '../../components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

/**
 * IRIS Revenue Content Component
 *
 * Deze component toont de inhoud van de IRIS Revenue pagina.
 * Het gebruikt de IrisContext om data op te halen en weer te geven.
 */
const IrisContent: React.FC = () => {
  const { revenueData, isLoading, error, selectedYear, setSelectedYear, fetchRevenueData, invalidateCache } = useIris();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncType, setSyncType] = useState<string>('');
  const { toast } = useToast();

  // Genereer jaar opties (huidige jaar, vorig jaar, volgend jaar)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  // Functie om data te verversen
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Forceer een volledige refresh van de data
      await fetchRevenueData(selectedYear, true);
      toast({
        title: 'Data ververst',
        description: 'De gegevens zijn succesvol ververst',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: 'Fout bij verversen',
        description: error instanceof Error ? error.message : 'Onbekende fout',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Functie om de cache te forceren om te verversen
  const handleClearCache = async () => {
    setIsRefreshing(true);
    try {
      // Gebruik de invalidateCache functie uit de context
      await invalidateCache(selectedYear, 'all');
      toast({
        title: 'Cache geleegd',
        description: 'De cache is succesvol geleegd en de data is ververst',
        variant: 'default'
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast({
        title: 'Fout bij leegmaken cache',
        description: error instanceof Error ? error.message : 'Onbekende fout',
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Functie om de status van een synchronisatie te controleren
  const checkSyncStatus = async (endpoint: string, title: string, description: string, maxAttempts = 60, interval = 3000) => {
    const API_PORT = 3004;
    const API_BASE_URL = `http://localhost:${API_PORT}`;
    const statusEndpoint = `${API_BASE_URL}/api/v1/iris/sync/status`;

    let attempts = 0;

    // Functie om de status te controleren
    const checkStatus = () => {
      return new Promise<boolean>((resolve) => {
        setTimeout(async () => {
          try {
            console.log(`Checking sync status (attempt ${attempts + 1}/${maxAttempts})...`);

            const response = await fetch(statusEndpoint, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });

            if (!response.ok) {
              console.warn('Failed to check sync status');
              attempts++;

              if (attempts < maxAttempts) {
                const result = await checkStatus();
                resolve(result);
              } else {
                console.error('Max attempts reached for checking sync status');
                resolve(false);
              }
              return;
            }

            const data = await response.json();

            // Controleer of de synchronisatie nog bezig is
            if (data.data && data.data.syncInProgress === false) {
              console.log('Sync completed successfully');
              resolve(true);
              return;
            }

            // Als de synchronisatie nog bezig is, controleer opnieuw
            attempts++;
            if (attempts < maxAttempts) {
              const result = await checkStatus();
              resolve(result);
            } else {
              console.error('Max attempts reached for checking sync status');
              resolve(false);
            }
          } catch (error) {
            console.error('Error checking sync status:', error);
            attempts++;

            if (attempts < maxAttempts) {
              const result = await checkStatus();
              resolve(result);
            } else {
              console.error('Max attempts reached for checking sync status');
              resolve(false);
            }
          }
        }, interval);
      });
    };

    return checkStatus();
  };

  // Generieke functie voor synchronisatie
  const handleSync = async (endpoint: string, title: string, description: string) => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncType(title);

    try {
      // Gebruik de API_BASE_URL uit de config
      const API_PORT = 3004; // Hardcoded omdat we de import niet kunnen gebruiken
      const API_BASE_URL = `http://localhost:${API_PORT}`;
      const fullEndpoint = `${API_BASE_URL}${endpoint}`;

      console.log(`Sending request to: ${fullEndpoint}`);

      // Toon een toast dat de synchronisatie is gestart
      toast({
        title: `${title} gestart`,
        description: 'Dit kan enkele minuten duren. De pagina wordt automatisch ververst wanneer de synchronisatie is voltooid.',
        variant: 'default',
        duration: 5000
      });

      const response = await fetch(fullEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Fout bij ${title.toLowerCase()}`);
      }

      const data = await response.json();

      // Als de synchronisatie op de achtergrond wordt uitgevoerd, controleer de status
      if (data.inProgress) {
        console.log('Sync is running in the background, polling for status...');

        // Controleer de status van de synchronisatie
        const syncCompleted = await checkSyncStatus(endpoint, title, description);

        if (syncCompleted) {
          toast({
            title: `${title} voltooid`,
            description: description,
            variant: 'default'
          });
        } else {
          // Als de synchronisatie niet is voltooid binnen de maximale tijd, toon een waarschuwing
          toast({
            title: `${title} duurt langer dan verwacht`,
            description: 'De synchronisatie loopt nog steeds op de achtergrond. Ververs de pagina handmatig over enkele minuten.',
            variant: 'default',
            duration: 10000
          });
        }
      } else {
        // Als de synchronisatie direct is voltooid, toon een succes bericht
        toast({
          title: `${title} voltooid`,
          description: description,
          variant: 'default'
        });
      }

      // Ververs de data om de wijzigingen te zien
      await fetchRevenueData(selectedYear, true);
    } catch (error) {
      console.error(`Fout bij ${title.toLowerCase()}:`, error);
      toast({
        title: `Fout bij ${title.toLowerCase()}`,
        description: error instanceof Error ? error.message : 'Onbekende fout',
        variant: 'destructive'
      });
    } finally {
      setIsSyncing(false);
      setSyncType('');
    }
  };

  // Functie om offertes te synchroniseren
  const handleSyncOffers = () => {
    handleSync(
      '/api/v1/iris/sync/offers',
      'Offertes synchroniseren',
      'Alle offertes zijn succesvol gesynchroniseerd met Gripp'
    );
  };

  // Functie om projecten te synchroniseren
  const handleSyncProjects = () => {
    handleSync(
      '/api/v1/iris/sync/projects',
      'Projecten synchroniseren',
      'Alle projecten zijn succesvol gesynchroniseerd met Gripp'
    );
  };

  // Functie om uren voor een specifiek jaar te synchroniseren
  const handleSyncHours = (year: number) => {
    handleSync(
      `/api/v1/iris/sync/hours/${year}`,
      `Uren ${year} synchroniseren`,
      `Alle uren voor ${year} zijn succesvol gesynchroniseerd met Gripp`
    );
  };

  // Functie om data van de laatste 3 maanden te synchroniseren
  const handleSyncLastThreeMonths = () => {
    handleSync(
      '/api/v1/iris/sync/last-three-months',
      'Laatste 3 maanden synchroniseren',
      'Data van de laatste 3 maanden is succesvol gesynchroniseerd met Gripp'
    );
  };

  // Functie om jaar te wijzigen
  const handleYearChange = (year: string) => {
    setSelectedYear(parseInt(year));
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">IRIS Revenue Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Jaar" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            title="Ververs data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            disabled={isLoading || isRefreshing}
            title="Leeg cache en ververs data"
            className="flex items-center"
          >
            <Database className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-pulse' : ''}`} />
            Cache leegmaken
          </Button>
          <DataManagementPanel />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading || isRefreshing || isSyncing}
                className="flex items-center"
              >
                <Database className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-pulse' : ''}`} />
                {isSyncing ? `${syncType}...` : 'Synchroniseren'}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Synchronisatie opties</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => handleSyncHours(2023)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Alle uren 2023</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSyncHours(2024)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Alle uren 2024</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSyncHours(2025)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Alle uren 2025</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleSyncProjects}>
                  <Database className="h-4 w-4 mr-2" />
                  <span>Alle projecten</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSyncOffers}>
                  <Database className="h-4 w-4 mr-2" />
                  <span>Alle offertes</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSyncLastThreeMonths} className="text-green-600 font-medium">
                <Download className="h-4 w-4 mr-2" />
                <span>Update laatste 3 maanden</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Loading/Error state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <span className="ml-2">Gegevens laden...</span>
        </div>
      ) : error ? (
        <div className="text-red-500 p-4 border border-red-200 rounded-md bg-red-50">
          Er is een fout opgetreden: {error}
        </div>
      ) : (
        <>
          {/* KPI Overview */}
          <KpiOverview />

          {/* Monthly Targets */}
          <MonthlyTargets />



          {/* Revenue Table */}
          <RevenueTable />
        </>
      )}
    </div>
  );
};

/**
 * IRIS Revenue Page
 *
 * Deze pagina toont het IRIS Revenue overzicht, geïntegreerd vanuit de IRIS Revenue App.
 * Het biedt inzicht in de omzet per project en per maand, gebaseerd op geschreven uren in Gripp.
 */
const IrisPage: React.FC = () => {
  return (
    <IrisProvider>
      <div className="max-w-[98%] w-[2400px] mx-auto py-6 space-y-6">
        <IrisContent />
      </div>
    </IrisProvider>
  );
};

export default IrisPage;
