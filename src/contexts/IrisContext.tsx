import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { API_BASE_URL } from '../config/api';
import { calculateRevenue, CalculationMethod, Project as RevenueProject } from '../utils/revenue-calculator-fixed';

// Cache interfaces
interface CacheEntry<T> {
  data: T[];
  timestamp: number;
}

// Cache keys voor localStorage
const CACHE_KEYS = {
  REVENUE: 'iris_revenue_cache',
  MONTHLY_TARGETS: 'iris_monthly_targets_cache',
  KPI_TARGETS: 'iris_kpi_targets_cache',
  FINAL_REVENUE: 'iris_final_revenue_cache'
};

// Cache expiration time (30 minutes in milliseconds)
const CACHE_EXPIRATION = 30 * 60 * 1000;

// Helper functies voor cache management
const saveToCache = <T,>(key: string, year: number, data: T[], timestamp = Date.now()) => {
  try {
    const cacheKey = `${key}_${year}`;
    const cacheEntry: CacheEntry<T> = { data, timestamp };
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    return true;
  } catch (error) {
    console.error(`Error saving to cache (${key}):`, error);
    return false;
  }
};

const getFromCache = <T,>(key: string, year: number): CacheEntry<T> | null => {
  try {
    const cacheKey = `${key}_${year}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (!cachedData) return null;

    const cacheEntry = JSON.parse(cachedData) as CacheEntry<T>;
    return cacheEntry;
  } catch (error) {
    console.error(`Error getting from cache (${key}):`, error);
    return null;
  }
};

const removeFromCache = (key: string, year: number): boolean => {
  try {
    const cacheKey = `${key}_${year}`;
    localStorage.removeItem(cacheKey);
    return true;
  } catch (error) {
    console.error(`Error removing from cache (${key}):`, error);
    return false;
  }
};

const isCacheValid = (cacheEntry: CacheEntry<any> | null): boolean => {
  if (!cacheEntry) return false;
  const now = Date.now();
  return now - cacheEntry.timestamp < CACHE_EXPIRATION;
};

// Types
export interface IrisRevenueItem {
  id: number;
  projectId: number;
  projectName: string;
  clientName: string;
  projectType: string;
  projectBudget: number;
  projectStatus: string;
  year: number;
  month: number;
  revenue: number;
  hours: number;
  hourlyRate: number;
  isDefinite: boolean;
  isOverBudget: boolean;
  previousYearBudgetUsed?: number;
  adjustedDueToMaxBudget?: boolean;
  projectLineId?: number;
  projectLineName?: string;
  projectLineAmount?: number;
  projectLineAmountWritten?: number;
  invoiceBasisId?: number;
  invoiceBasisName?: string;
  offerprojectbase_discr?: string;
}

export interface IrisFinalRevenueItem {
  year: number;
  month: number;
  amount: number;
}

export interface IrisMonthlyTarget {
  year: number;
  month: number;
  targetAmount: number;
}

export interface IrisKpiTarget {
  year: number;
  kpiName: string;
  targetValue: number;
}

// View mode type
export type ViewMode = 'hours' | 'revenue';

// Calculation mode type
export type CalculationMode = 'projectMax' | 'lineMax';

interface IrisContextType {
  // State
  selectedYear: number;
  revenueData: IrisRevenueItem[];
  correctedRevenueData: IrisRevenueItem[]; // Gecorrigeerde data voor vaste prijs projecten
  monthlyTargets: IrisMonthlyTarget[];
  kpiTargets: IrisKpiTarget[];
  finalRevenue: IrisFinalRevenueItem[];
  isLoading: boolean;
  error: string | null;
  viewMode: ViewMode;
  calculationMode: CalculationMode;
  excludedProjects: number[]; // Lijst met uitgesloten projecten

  // Actions
  setSelectedYear: (year: number) => void;
  setViewMode: (mode: ViewMode) => void;
  setCalculationMode: (mode: CalculationMode) => void;
  setExcludedProjects: (projects: number[]) => void; // Functie om uitgesloten projecten bij te werken
  fetchRevenueData: (year: number, forceRefresh?: boolean) => Promise<void>;
  fetchMonthlyTargets: (year: number) => Promise<void>;
  fetchKpiTargets: (year: number) => Promise<void>;
  fetchFinalRevenue: (year: number) => Promise<void>;
  invalidateCache: (year: number, type: string) => void;
}

// Create context with default values
const IrisContext = createContext<IrisContextType | undefined>(undefined);

// Provider component
export const IrisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [revenueData, setRevenueData] = useState<IrisRevenueItem[]>([]);
  const [correctedRevenueData, setCorrectedRevenueData] = useState<IrisRevenueItem[]>([]);
  const [monthlyTargets, setMonthlyTargets] = useState<IrisMonthlyTarget[]>([]);
  const [kpiTargets, setKpiTargets] = useState<IrisKpiTarget[]>([]);
  const [finalRevenue, setFinalRevenue] = useState<IrisFinalRevenueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('revenue');
  const [calculationMode, setCalculationMode] = useState<CalculationMode>('projectMax');
  const [excludedProjects, setExcludedProjects] = useState<number[]>([]);

  // Laad uitgesloten projecten bij component mount
  useEffect(() => {
    const storedExcludedProjects = localStorage.getItem('excludedProjects');
    if (storedExcludedProjects) {
      try {
        setExcludedProjects(JSON.parse(storedExcludedProjects));
      } catch (e) {
        console.error('Fout bij laden van uitgesloten projecten:', e);
      }
    }
  }, []);

  // Sla uitgesloten projecten op wanneer ze veranderen
  useEffect(() => {
    localStorage.setItem('excludedProjects', JSON.stringify(excludedProjects));
  }, [excludedProjects]);

  // Fetch revenue data van de API
  const fetchRevenueData = async (year: number, forceRefresh = false) => {
    try {
      // Controleer eerst of we gecachte data hebben en of we die kunnen gebruiken
      const cachedData = getFromCache<IrisRevenueItem>(CACHE_KEYS.REVENUE, year);

      if (!forceRefresh && isCacheValid(cachedData) && cachedData?.data.length > 0) {
        console.log(`Using cached revenue data for year ${year}: ${cachedData.data.length} records`);
        setRevenueData(cachedData.data);
        return;
      }

      setIsLoading(true);
      setError(null);

      // Forceer cache refresh door timestamp toe te voegen
      const timestamp = new Date().getTime();

      // Gebruik direct de oude revenue endpoint (deze werkt nog)
      const url = `${API_BASE_URL}/api/v1/iris/revenue?year=${year}&_=${timestamp}`;
      console.log(`Fetching revenue data from database endpoint: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch revenue data: ${response.statusText}`);
      }

      const result = await response.json();
      let fetchedData: IrisRevenueItem[] = [];

      // Check of de data in result.data.data of result.data zit
      if (result.data && Array.isArray(result.data.data)) {
        console.log(`Revenue data opgehaald via database: ${result.data.data.length} records`);
        fetchedData = result.data.data;
        setRevenueData(fetchedData);
      } else if (result.data && Array.isArray(result.data)) {
        console.log(`Revenue data opgehaald via database: ${result.data.length} records`);
        fetchedData = result.data;
        setRevenueData(fetchedData);
      } else {
        console.error('Unexpected API response format:', result);

        // Als laatste redmiddel, probeer de revenue-direct endpoint
        try {
          const directUrl = `${API_BASE_URL}/api/v1/iris/revenue-direct?year=${year}&_=${timestamp}`;
          console.log(`Last resort: Fetching revenue data directly from API: ${directUrl}`);

          const directResponse = await fetch(directUrl);

          if (!directResponse.ok) {
            throw new Error(`Failed to fetch direct revenue data: ${directResponse.statusText}`);
          }

          const directResult = await directResponse.json();

          if (directResult.data && Array.isArray(directResult.data)) {
            console.log(`Revenue data opgehaald via directe API: ${directResult.data.length} records`);
            fetchedData = directResult.data;
            setRevenueData(fetchedData);
          } else {
            console.error('Unexpected direct API response format:', directResult);
            setRevenueData([]);
          }
        } catch (directErr) {
          console.error('Kon geen data ophalen via directe API endpoint:', directErr);
          setRevenueData([]);
        }
      }

      // Update de cache met de nieuwe data
      if (fetchedData.length > 0) {
        saveToCache<IrisRevenueItem>(CACHE_KEYS.REVENUE, year, fetchedData);
        console.log(`Updated revenue cache for year ${year} with ${fetchedData.length} records`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching revenue data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch monthly targets
  const fetchMonthlyTargets = async (year: number, forceRefresh = false) => {
    try {
      // Controleer eerst of we gecachte data hebben en of we die kunnen gebruiken
      const cachedData = getFromCache<IrisMonthlyTarget>(CACHE_KEYS.MONTHLY_TARGETS, year);

      if (!forceRefresh && isCacheValid(cachedData) && cachedData?.data.length > 0) {
        console.log(`Using cached monthly targets for year ${year}: ${cachedData.data.length} records`);
        setMonthlyTargets(cachedData.data);
        return;
      }

      setIsLoading(true);

      // Voeg timestamp toe om caching te voorkomen
      const timestamp = new Date().getTime();
      const response = await fetch(`${API_BASE_URL}/api/v1/iris/targets/monthly?year=${year}&_=${timestamp}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch monthly targets: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Fetched monthly targets:', result);

      let fetchedData: IrisMonthlyTarget[] = [];

      if (result.data && result.data.data && Array.isArray(result.data.data)) {
        fetchedData = result.data.data;
        setMonthlyTargets(fetchedData);
      } else {
        console.warn('Unexpected monthly targets format:', result);
        setMonthlyTargets([]);
      }

      // Update de cache met de nieuwe data
      if (fetchedData.length > 0) {
        saveToCache<IrisMonthlyTarget>(CACHE_KEYS.MONTHLY_TARGETS, year, fetchedData);
        console.log(`Updated monthly targets cache for year ${year} with ${fetchedData.length} records`);
      }
    } catch (err) {
      console.error('Error fetching monthly targets:', err);
      // Don't set error state here to avoid blocking the UI
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch KPI targets
  const fetchKpiTargets = async (year: number, forceRefresh = false) => {
    try {
      // Controleer eerst of we gecachte data hebben en of we die kunnen gebruiken
      const cachedData = getFromCache<IrisKpiTarget>(CACHE_KEYS.KPI_TARGETS, year);

      if (!forceRefresh && isCacheValid(cachedData) && cachedData?.data.length > 0) {
        console.log(`Using cached KPI targets for year ${year}: ${cachedData.data.length} records`);
        setKpiTargets(cachedData.data);
        return;
      }

      setIsLoading(true);

      // Voeg timestamp toe om caching te voorkomen
      const timestamp = new Date().getTime();
      const response = await fetch(`${API_BASE_URL}/api/v1/iris/targets/kpi?year=${year}&_=${timestamp}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch KPI targets: ${response.statusText}`);
      }

      const result = await response.json();
      const fetchedData = result.data || [];
      setKpiTargets(fetchedData);

      // Update de cache met de nieuwe data
      if (fetchedData.length > 0) {
        saveToCache<IrisKpiTarget>(CACHE_KEYS.KPI_TARGETS, year, fetchedData);
        console.log(`Updated KPI targets cache for year ${year} with ${fetchedData.length} records`);
      }
    } catch (err) {
      console.error('Error fetching KPI targets:', err);
      // Don't set error state here to avoid blocking the UI
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch final revenue
  const fetchFinalRevenue = async (year: number, forceRefresh = false) => {
    try {
      // Controleer eerst of we gecachte data hebben en of we die kunnen gebruiken
      const cachedData = getFromCache<IrisFinalRevenueItem>(CACHE_KEYS.FINAL_REVENUE, year);

      if (!forceRefresh && isCacheValid(cachedData) && cachedData?.data.length > 0) {
        console.log(`Using cached final revenue for year ${year}: ${cachedData.data.length} records`);
        setFinalRevenue(cachedData.data);
        return;
      }

      setIsLoading(true);
      console.log(`Fetching final revenue for year ${year}`);

      // Voeg een timestamp toe om caching te voorkomen
      const timestamp = new Date().getTime();
      const response = await fetch(`${API_BASE_URL}/api/v1/iris/revenue/final?year=${year}&_=${timestamp}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch final revenue: ${response.statusText}`);
      }

      // Forceer een nieuwe request om de cache te vernieuwen
      removeFromCache(CACHE_KEYS.FINAL_REVENUE, year);

      const result = await response.json();
      console.log('Final revenue API response:', result);

      // Controleer of de data in het data.data veld, data veld of in het updatedData veld zit
      let dataArray = null;

      if (result.data && result.data.data && Array.isArray(result.data.data)) {
        // Nieuwe API formaat: data.data
        dataArray = result.data.data;
        console.log('Found data in result.data.data:', dataArray);
      } else if (result.data && Array.isArray(result.data)) {
        // Oude API formaat: direct in data
        dataArray = result.data;
        console.log('Found data in result.data:', dataArray);
      } else if (result.updatedData && Array.isArray(result.updatedData)) {
        // Alternatief formaat: updatedData
        dataArray = result.updatedData;
        console.log('Found data in result.updatedData:', dataArray);
      }

      if (dataArray) {
        console.log('Processing final revenue data array:', dataArray);

        // Zorg ervoor dat de amount waarden als numbers worden opgeslagen
        const processedData = dataArray.map((item: any) => {
          const amount = typeof item.amount === 'number'
            ? item.amount
            : parseFloat(String(item.amount)) || 0;

          console.log(`Processing final revenue item: month=${item.month}, amount=${amount} (original: ${item.amount}, type: ${typeof item.amount})`);

          return {
            ...item,
            amount: amount
          };
        });

        console.log('Processed final revenue data:', processedData);

        // Update de state
        setFinalRevenue(processedData);

        // Update de cache met de nieuwe data
        if (processedData.length > 0) {
          saveToCache<IrisFinalRevenueItem>(CACHE_KEYS.FINAL_REVENUE, year, processedData);
          console.log(`Updated final revenue cache for year ${year} with ${processedData.length} records`);
        }
      } else {
        console.warn('Unexpected final revenue format:', result);
        setFinalRevenue([]);
      }
    } catch (err) {
      console.error('Error fetching final revenue:', err);
      // Don't set error state here to avoid blocking the UI
    } finally {
      setIsLoading(false);
    }
  };

  // Invalidate cache
  const invalidateCache = async (year: number, type: string) => {
    console.log(`Invalidating cache for year ${year}, type ${type}`);

    try {
      // Stap 0: Leeg de localStorage cache
      if (type === 'all' || type === 'revenue') {
        removeFromCache(CACHE_KEYS.REVENUE, year);
        console.log(`Cleared localStorage revenue cache for year ${year}`);
      }
      if (type === 'all' || type === 'targets') {
        removeFromCache(CACHE_KEYS.MONTHLY_TARGETS, year);
        removeFromCache(CACHE_KEYS.KPI_TARGETS, year);
        console.log(`Cleared localStorage targets cache for year ${year}`);
      }
      if (type === 'all' || type === 'final') {
        removeFromCache(CACHE_KEYS.FINAL_REVENUE, year);
        console.log(`Cleared localStorage final revenue cache for year ${year}`);
      }

      // Voeg een timestamp toe om caching te voorkomen
      const timestamp = new Date().getTime();

      // Stap 1: Leeg de server-side cache
      const clearUrl = `${API_BASE_URL}/api/v1/iris/cache/clear?year=${year}&type=${type}&_=${timestamp}`;
      console.log(`Sending cache invalidation request to: ${clearUrl}`);

      const clearResponse = await fetch(clearUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!clearResponse.ok) {
        throw new Error(`Failed to invalidate cache: ${clearResponse.statusText}`);
      }

      const clearResult = await clearResponse.json();
      console.log('Cache invalidation result:', clearResult);

      // Stap 2: Synchroniseer alle data als type 'all' is
      if (type === 'all') {
        try {
          const syncUrl = `${API_BASE_URL}/api/v1/iris/sync-all?year=${year}&_=${timestamp}`;
          console.log(`Sending sync-all request to: ${syncUrl}`);

          const syncResponse = await fetch(syncUrl);

          if (!syncResponse.ok) {
            console.warn(`Failed to sync all data: ${syncResponse.statusText}`);
            // Ga door, dit is geen fatale fout
          } else {
            const syncResult = await syncResponse.json();
            console.log('Sync all result:', syncResult);
          }
        } catch (syncErr) {
          console.warn('Error syncing all data:', syncErr);
          // Ga door, dit is geen fatale fout
        }
      }

      // Stap 3: Forceer een refresh van de data
      await fetchRevenueData(year, true);
      await fetchMonthlyTargets(year, true);
      await fetchKpiTargets(year, true);
      await fetchFinalRevenue(year, true);

      return clearResult;
    } catch (err) {
      console.error('Error invalidating cache:', err);
      throw err;
    }
  };

  // Fetch data when year changes
  useEffect(() => {
    // Gebruik de cache als die beschikbaar is, anders forceer een refresh
    fetchRevenueData(selectedYear, false);
    fetchMonthlyTargets(selectedYear, false);
    fetchKpiTargets(selectedYear, false);
    fetchFinalRevenue(selectedYear, false);
  }, [selectedYear]);

  // Bereken gecorrigeerde revenue data voor projecten op basis van de gekozen berekeningsmethode
  useEffect(() => {
    if (!revenueData || !Array.isArray(revenueData)) {
      setCorrectedRevenueData([]);
      return;
    }

    console.log(`IRIS FIXED: Berekenen van gecorrigeerde revenue data met ${calculationMode} methode`);

    try {
      // Groepeer items per project
      const projectGroups = new Map<number, IrisRevenueItem[]>();

      revenueData.forEach(item => {
        const projectId = item.projectId;
        if (!projectGroups.has(projectId)) {
          projectGroups.set(projectId, []);
        }
        projectGroups.get(projectId)?.push(item);
      });

      // Corrigeer de revenue voor elk project
      const correctedItems: IrisRevenueItem[] = [];

      // Verwerk elk project
      projectGroups.forEach((items, projectId) => {
        // Sorteer items op maand
        items.sort((a, b) => a.month - b.month);

        // Gebruik het eerste item voor project metadata
        const firstItem = items[0];
        const projectName = firstItem.projectName;
        const projectType = firstItem.projectType;
        const projectBudget = firstItem.projectBudget || 0;
        const previousYearBudgetUsed = firstItem.previousYearBudgetUsed || 0;

        console.log(`IRIS FIXED: Verwerken van project ${projectId} (${projectName}), type: ${projectType}, budget: €${projectBudget}, verbruikt: €${previousYearBudgetUsed}`);

        // Groepeer items per maand voor de nieuwe calculator
        const monthlyItems: IrisRevenueItem[][] = Array(12).fill(0).map(() => []);

        items.forEach(item => {
          const month = item.month - 1; // 0-based index
          monthlyItems[month].push(item);
        });

        // Maak een project object voor de revenue calculator
        const project: RevenueProject = {
          projectId,
          projectName,
          projectType,
          projectBudget,
          previousYearBudgetUsed,
          monthlyItems,
          projectLines: [], // We hebben geen projectregels nodig voor deze berekening
          isQuote: false // Standaard geen offerte
        };

        // Bereken de omzet met de nieuwe calculator
        const calculationMethod = calculationMode === 'project_max'
          ? CalculationMethod.PROJECT_MAX
          : CalculationMethod.LINE_MAX;

        const result = calculateRevenue(project, calculationMethod);

        // Voeg de berekende items toe aan de gecorrigeerde items
        correctedItems.push(...result.items);

        // Log het resultaat
        console.log(`IRIS FIXED: Resultaat voor project ${projectId} (${projectName}):`, {
          totalRevenue: result.totalRevenue,
          remainingBudget: result.remainingBudget,
          isOverBudget: result.isOverBudget,
          itemCount: result.items.length
        });
      });

      // Update de state met de gecorrigeerde data
      setCorrectedRevenueData(correctedItems);

      // Log voor debugging
      console.log(`IRIS FIXED: Gecorrigeerde revenue data bevat ${correctedItems.length} items`);
    } catch (error) {
      console.error('Fout bij het berekenen van gecorrigeerde revenue data:', error);
      // Fallback naar de originele data
      setCorrectedRevenueData(revenueData);
    }
  }, [revenueData, calculationMode]);

  // Context value
  const value = {
    selectedYear,
    revenueData,
    correctedRevenueData,
    monthlyTargets,
    kpiTargets,
    finalRevenue,
    isLoading,
    error,
    viewMode,
    calculationMode,
    excludedProjects,
    setSelectedYear,
    setViewMode,
    setCalculationMode,
    setExcludedProjects,
    fetchRevenueData,
    fetchMonthlyTargets,
    fetchKpiTargets,
    fetchFinalRevenue,
    invalidateCache
  };

  return <IrisContext.Provider value={value}>{children}</IrisContext.Provider>;
};

// Hook for using the context
export const useIris = () => {
  const context = useContext(IrisContext);
  if (context === undefined) {
    throw new Error('useIris must be used within an IrisProvider');
  }
  return context;
};
