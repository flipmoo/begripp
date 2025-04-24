/**
 * Performance Utilities
 * 
 * Utilities voor het optimaliseren van performance.
 */
import { useRef, useEffect, useCallback, useMemo, DependencyList } from 'react';
import { isEqual } from 'lodash-es';

/**
 * Hook voor het memoizen van een waarde op basis van diepe vergelijking
 * @param value De waarde om te memoizen
 * @returns De gememoizeerde waarde
 */
export function useDeepMemo<T>(value: T): T {
  const ref = useRef<T>(value);
  
  // Alleen updaten als de waarde is veranderd (diepe vergelijking)
  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }
  
  return ref.current;
}

/**
 * Hook voor het memoizen van een callback op basis van diepe vergelijking
 * @param callback De callback om te memoizen
 * @param deps De dependencies voor de callback
 * @returns De gememoizeerde callback
 */
export function useDeepCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList
): T {
  // Gebruik useDeepMemo om de dependencies te memoizen
  const memoizedDeps = useDeepMemo(deps);
  
  // Gebruik useCallback met de gememoizeerde dependencies
  return useCallback(callback, [memoizedDeps]);
}

/**
 * Hook voor het debounce van een waarde
 * @param value De waarde om te debounce
 * @param delay De delay in milliseconden
 * @returns De gedebouncede waarde
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Stel een timer in om de waarde te updaten na de delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Ruim de timer op als de waarde verandert voordat de delay is verstreken
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook voor het throttle van een callback
 * @param callback De callback om te throttle
 * @param delay De delay in milliseconden
 * @returns De gethrottlede callback
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const lastCall = useRef(0);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const lastArgs = useRef<any[]>([]);
  
  // Gebruik useCallback om de functie te memoizen
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs.current = args;
    
    // Als er nog geen timeout is en de delay is verstreken, roep de callback direct aan
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    } else {
      // Anders, stel een timeout in om de callback aan te roepen na de delay
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      
      timeoutId.current = setTimeout(() => {
        lastCall.current = Date.now();
        callback(...lastArgs.current);
        timeoutId.current = null;
      }, delay - (now - lastCall.current));
    }
  }, [callback, delay]) as T;
}

/**
 * Hook voor het meten van rendering performance
 * @param componentName Naam van het component
 * @param enabled Of de metingen moeten worden uitgevoerd
 * @returns Void
 */
export function useRenderPerformance(componentName: string, enabled: boolean = true): void {
  // Gebruik useRef om het aantal renders bij te houden
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  // Alleen uitvoeren als enabled true is
  if (!enabled) return;
  
  // Verhoog de render count
  renderCount.current += 1;
  
  // Bereken de tijd sinds de laatste render
  const now = Date.now();
  const timeSinceLastRender = now - lastRenderTime.current;
  lastRenderTime.current = now;
  
  // Log de performance metrics
  useEffect(() => {
    console.log(
      `[${componentName}] Render #${renderCount.current} | ` +
      `Time since last render: ${timeSinceLastRender}ms`
    );
  });
}

/**
 * HOC voor het toevoegen van memoization aan een component
 * @param Component Het component om te memoizen
 * @param propsAreEqual Functie om te bepalen of de props gelijk zijn
 * @returns Het gememoizeerde component
 */
export function withMemo<P extends object>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean
): React.MemoExoticComponent<React.ComponentType<P>> {
  // Gebruik React.memo om het component te memoizen
  return React.memo(Component, propsAreEqual);
}

/**
 * HOC voor het toevoegen van diepe memoization aan een component
 * @param Component Het component om te memoizen
 * @returns Het gememoizeerde component
 */
export function withDeepMemo<P extends object>(
  Component: React.ComponentType<P>
): React.MemoExoticComponent<React.ComponentType<P>> {
  // Gebruik React.memo met isEqual voor diepe vergelijking
  return React.memo(Component, (prevProps, nextProps) => {
    return isEqual(prevProps, nextProps);
  });
}

// Vergeten import toevoegen
import { useState } from 'react';
