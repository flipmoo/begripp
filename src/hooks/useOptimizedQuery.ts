/**
 * useOptimizedQuery Hook
 * 
 * Een geoptimaliseerde versie van useQuery met betere caching en error handling.
 */
import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

// Standaard stale time (5 minuten)
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

// Standaard cache time (30 minuten)
const DEFAULT_CACHE_TIME = 30 * 60 * 1000;

/**
 * Interface voor de opties van useOptimizedQuery
 */
export interface UseOptimizedQueryOptions<TData, TError> 
  extends Omit<UseQueryOptions<TData, TError, TData>, 'queryKey' | 'queryFn'> {
  /** Stale time in milliseconden */
  staleTime?: number;
  /** Cache time in milliseconden */
  cacheTime?: number;
  /** Geeft aan of de query automatisch moet worden uitgevoerd */
  enabled?: boolean;
  /** Geeft aan of de query opnieuw moet worden uitgevoerd wanneer het venster focus krijgt */
  refetchOnWindowFocus?: boolean;
  /** Geeft aan of de query opnieuw moet worden uitgevoerd wanneer de verbinding wordt hersteld */
  refetchOnReconnect?: boolean;
  /** Geeft aan of de vorige data moet worden behouden tijdens het laden van nieuwe data */
  keepPreviousData?: boolean;
  /** Aantal keer opnieuw proberen bij een fout */
  retry?: number | boolean;
  /** Delay tussen retries in milliseconden */
  retryDelay?: number | ((retryAttempt: number) => number);
}

/**
 * Hook voor het optimaliseren van queries
 * @param queryKey De query key
 * @param queryFn De query functie
 * @param options De query opties
 * @returns Het query resultaat
 */
export function useOptimizedQuery<TData = unknown, TError = unknown>(
  queryKey: unknown[],
  queryFn: () => Promise<TData>,
  options: UseOptimizedQueryOptions<TData, TError> = {}
): UseQueryResult<TData, TError> & { isRefetching: boolean } {
  // State voor het bijhouden van refetching status
  const [isRefetching, setIsRefetching] = useState(false);

  // Standaard opties
  const defaultedOptions: UseOptimizedQueryOptions<TData, TError> = {
    staleTime: DEFAULT_STALE_TIME,
    cacheTime: DEFAULT_CACHE_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    keepPreviousData: true,
    retry: 1,
    ...options,
  };

  // Gebruik useQuery met de geoptimaliseerde opties
  const queryResult = useQuery<TData, TError, TData>({
    queryKey,
    queryFn,
    ...defaultedOptions,
  });

  // Bijhouden van refetching status
  useEffect(() => {
    if (queryResult.isLoading && queryResult.isFetching && queryResult.data) {
      setIsRefetching(true);
    } else {
      setIsRefetching(false);
    }
  }, [queryResult.isLoading, queryResult.isFetching, queryResult.data]);

  // Return het query resultaat met extra isRefetching property
  return {
    ...queryResult,
    isRefetching,
  };
}

/**
 * Hook voor het optimaliseren van queries met een specifieke resource
 * @param resource De resource naam
 * @param id De resource ID
 * @param queryFn De query functie
 * @param options De query opties
 * @returns Het query resultaat
 */
export function useResourceQuery<TData = unknown, TError = unknown>(
  resource: string,
  id: string | number | undefined,
  queryFn: () => Promise<TData>,
  options: UseOptimizedQueryOptions<TData, TError> = {}
): UseQueryResult<TData, TError> & { isRefetching: boolean } {
  // Gebruik useOptimizedQuery met resource en ID als query key
  return useOptimizedQuery<TData, TError>(
    [resource, id],
    queryFn,
    {
      // Alleen uitvoeren als er een ID is
      enabled: id !== undefined && options.enabled !== false,
      ...options,
    }
  );
}
