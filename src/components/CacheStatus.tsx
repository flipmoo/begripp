import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCacheStatus, clearEmployeeCache, clearClientCache, isDataCached } from '@/services/employee.service';
import { ReloadIcon } from '@radix-ui/react-icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getYear, getMonth, getWeek } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface CacheStats {
  total: number;
  employeeWeek: number;
  employeeMonth: number;
  keys: string[];
}

interface ClientCacheStats {
  total: number;
  keys: string[];
  weekViews: number;
  monthViews: number;
}

interface CacheStatusResponse {
  success: boolean;
  stats: CacheStats;
  clientCache?: ClientCacheStats;
}

interface CacheStatusProps {
  compact?: boolean;
}

export function CacheStatus({ compact = false }: CacheStatusProps) {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [clientCacheStats, setClientCacheStats] = useState<ClientCacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("server");
  const [currentPeriodCached, setCurrentPeriodCached] = useState<boolean>(false);
  const [adjacentPeriodsCached, setAdjacentPeriodsCached] = useState<{
    prevWeek: boolean;
    nextWeek: boolean;
    prevMonth: boolean;
    nextMonth: boolean;
  }>({
    prevWeek: false,
    nextWeek: false,
    prevMonth: false,
    nextMonth: false
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchCacheStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCacheStatus();
      if (response && response.success) {
        setCacheStats(response.stats);
        if (response.clientCache) {
          setClientCacheStats(response.clientCache);
        }
        
        // Check if current period is cached
        const now = new Date();
        const currentYear = getYear(now);
        const currentWeek = getWeek(now, { weekStartsOn: 1, firstWeekContainsDate: 4 });
        const currentMonth = getMonth(now);
        
        // Check current period
        const isWeekCached = isDataCached(currentYear, currentWeek);
        const isMonthCached = isDataCached(currentYear, undefined, currentMonth);
        setCurrentPeriodCached(isWeekCached || isMonthCached);
        
        // Check adjacent periods
        const prevWeek = currentWeek === 1 ? 52 : currentWeek - 1;
        const prevWeekYear = currentWeek === 1 ? currentYear - 1 : currentYear;
        const nextWeek = currentWeek === 52 ? 1 : currentWeek + 1;
        const nextWeekYear = currentWeek === 52 ? currentYear + 1 : currentYear;
        
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        
        setAdjacentPeriodsCached({
          prevWeek: isDataCached(prevWeekYear, prevWeek),
          nextWeek: isDataCached(nextWeekYear, nextWeek),
          prevMonth: isDataCached(prevMonthYear, undefined, prevMonth),
          nextMonth: isDataCached(nextMonthYear, undefined, nextMonth)
        });
      } else {
        setError('Failed to fetch cache status');
      }
    } catch (err) {
      setError('Error fetching cache status');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearCache = async () => {
    setIsClearing(true);
    setError(null);
    try {
      await clearEmployeeCache();
      // Refresh cache status after clearing
      await fetchCacheStatus();
    } catch (err) {
      setError('Error clearing cache');
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  const clearClientCacheOnly = () => {
    try {
      clearClientCache();
      // Refresh cache status
      fetchCacheStatus();
    } catch (err) {
      setError('Error clearing client cache');
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCacheStatus();
    
    // Refresh cache status every minute
    const intervalId = setInterval(fetchCacheStatus, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  if (compact) {
    return (
      <div className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Cache Status</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setRefreshKey(prev => prev + 1)}
              disabled={isLoading}
            >
              {isLoading ? (
                <ReloadIcon className="h-4 w-4 animate-spin" />
              ) : (
                <ReloadIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="server">Server Cache</TabsTrigger>
              <TabsTrigger value="client">Client Cache</TabsTrigger>
            </TabsList>
            
            <TabsContent value="server" className="space-y-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : error ? (
                <div className="text-red-500">{error}</div>
              ) : cacheStats ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-sm">
                      Total: {cacheStats.total}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      Week View: {cacheStats.employeeWeek}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      Month View: {cacheStats.employeeMonth}
                    </Badge>
                  </div>
                  
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={clearCache}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Clear All Cache
                  </Button>
                </div>
              ) : null}
            </TabsContent>
            
            <TabsContent value="client" className="space-y-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : error ? (
                <div className="text-red-500">{error}</div>
              ) : clientCacheStats ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-sm">
                      Total: {clientCacheStats.total}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      Week View: {clientCacheStats.weekViews}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      Month View: {clientCacheStats.monthViews}
                    </Badge>
                    <Badge variant={currentPeriodCached ? "outline" : "secondary"} className={`text-sm ${currentPeriodCached ? 'bg-green-50' : ''}`}>
                      Current Period: {currentPeriodCached ? 'Cached' : 'Not Cached'}
                    </Badge>
                  </div>
                  
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={clearClientCacheOnly}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Clear Client Cache
                  </Button>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Cache Status</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setRefreshKey(prev => prev + 1)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ReloadIcon className="h-4 w-4 animate-spin" />
            ) : (
              <ReloadIcon className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
        <CardDescription>
          Server-side cache information
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="server">Server Cache</TabsTrigger>
            <TabsTrigger value="client">Client Cache</TabsTrigger>
          </TabsList>
          
          <TabsContent value="server" className="space-y-4">
            {cacheStats ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-sm">
                    Total: {cacheStats.total}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    Week View: {cacheStats.employeeWeek}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    Month View: {cacheStats.employeeMonth}
                  </Badge>
                </div>
                
                {cacheStats.keys.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Cached Keys:</h4>
                    <div className="max-h-40 overflow-y-auto text-xs bg-gray-50 p-2 rounded">
                      {cacheStats.keys.map((key) => (
                        <div key={key} className="mb-1 break-all">
                          {key}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                {isLoading ? 'Loading cache status...' : 'No cache data available'}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="client" className="space-y-4">
            {clientCacheStats ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-sm">
                    Total: {clientCacheStats.total}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    Week View: {clientCacheStats.weekViews}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    Month View: {clientCacheStats.monthViews}
                  </Badge>
                  <Badge variant={currentPeriodCached ? "outline" : "secondary"} className={`text-sm ${currentPeriodCached ? 'bg-green-50' : ''}`}>
                    Current Period: {currentPeriodCached ? 'Cached' : 'Not Cached'}
                  </Badge>
                </div>
                
                <div className="mt-2">
                  <h4 className="text-sm font-medium mb-2">Adjacent Periods:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={adjacentPeriodsCached.prevWeek ? "outline" : "secondary"} className={`text-sm ${adjacentPeriodsCached.prevWeek ? 'bg-green-50' : ''}`}>
                      Previous Week: {adjacentPeriodsCached.prevWeek ? 'Cached' : 'Not Cached'}
                    </Badge>
                    <Badge variant={adjacentPeriodsCached.nextWeek ? "outline" : "secondary"} className={`text-sm ${adjacentPeriodsCached.nextWeek ? 'bg-green-50' : ''}`}>
                      Next Week: {adjacentPeriodsCached.nextWeek ? 'Cached' : 'Not Cached'}
                    </Badge>
                    <Badge variant={adjacentPeriodsCached.prevMonth ? "outline" : "secondary"} className={`text-sm ${adjacentPeriodsCached.prevMonth ? 'bg-green-50' : ''}`}>
                      Previous Month: {adjacentPeriodsCached.prevMonth ? 'Cached' : 'Not Cached'}
                    </Badge>
                    <Badge variant={adjacentPeriodsCached.nextMonth ? "outline" : "secondary"} className={`text-sm ${adjacentPeriodsCached.nextMonth ? 'bg-green-50' : ''}`}>
                      Next Month: {adjacentPeriodsCached.nextMonth ? 'Cached' : 'Not Cached'}
                    </Badge>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-muted-foreground">
                  <p>Cache expiration: 30 minutes</p>
                  <p>Preloading: Adjacent periods are automatically preloaded</p>
                </div>
                
                {clientCacheStats.keys.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Cached Keys:</h4>
                    <div className="max-h-40 overflow-y-auto text-xs bg-gray-50 p-2 rounded">
                      {clientCacheStats.keys.map((key) => (
                        <div key={key} className="mb-1 break-all">
                          {key}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                {isLoading ? 'Loading client cache status...' : 'No client cache data available'}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={clearCache}
          disabled={isClearing || !cacheStats || cacheStats.total === 0}
          className="flex-1"
        >
          {isClearing ? (
            <>
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Clearing Cache...
            </>
          ) : (
            'Clear All Cache'
          )}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={clearClientCacheOnly}
          disabled={!clientCacheStats || clientCacheStats.total === 0}
          className="flex-1"
        >
          Clear Client Cache
        </Button>
      </CardFooter>
    </Card>
  );
} 