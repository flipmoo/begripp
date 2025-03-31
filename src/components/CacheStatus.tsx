import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCacheStatus, clearEmployeeCache, isDataCached } from '@/services/employee.service';
import { ReloadIcon } from '@radix-ui/react-icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getYear, getMonth, getWeek } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Database } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(false);

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
          nextMonth: isDataCached(nextMonthYear, undefined, nextMonth),
          prevMonth: isDataCached(prevMonthYear, undefined, prevMonth)
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
      clearEmployeeCache();
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

  // Render the collapsible button version
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-1"
          title="Cache Status"
        >
          <Database className="h-4 w-4" />
          <Badge variant="secondary" className="text-xs px-1 py-0 rounded-sm">
            {isLoading ? '...' : (cacheStats?.total || 0)}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>Cache Status</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setRefreshKey(prev => prev + 1);
                fetchCacheStatus();
              }}
              disabled={isLoading}
            >
              <ReloadIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="server">Server Cache</TabsTrigger>
              <TabsTrigger value="client">Client Cache</TabsTrigger>
            </TabsList>
            
            <TabsContent value="server" className="space-y-4 mt-4">
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
                  
                  {cacheStats.keys.length > 0 && (
                    <div className="mt-2">
                      <h4 className="text-sm font-medium mb-1">Cached Keys:</h4>
                      <div className="bg-gray-50 p-2 rounded text-xs max-h-32 overflow-auto">
                        {cacheStats.keys.map((key, i) => (
                          <div key={i} className="mb-1">{key}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={clearCache}
                    disabled={isClearing}
                    className="w-full"
                  >
                    {isClearing ? (
                      <>
                        <ReloadIcon className="h-4 w-4 animate-spin mr-2" />
                        Clearing...
                      </>
                    ) : (
                      'Clear All Cache'
                    )}
                  </Button>
                </div>
              ) : null}
            </TabsContent>
            
            <TabsContent value="client" className="space-y-4 mt-4">
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
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant={currentPeriodCached ? "outline" : "secondary"} 
                      className={`text-sm ${currentPeriodCached ? 'bg-green-50' : ''}`}
                    >
                      Current Period: {currentPeriodCached ? 'Cached' : 'Not Cached'}
                    </Badge>
                  </div>
                  
                  {clientCacheStats.keys.length > 0 && (
                    <div className="mt-2">
                      <h4 className="text-sm font-medium mb-1">Cached Keys:</h4>
                      <div className="bg-gray-50 p-2 rounded text-xs max-h-32 overflow-auto">
                        {clientCacheStats.keys.map((key, i) => (
                          <div key={i} className="mb-1">{key}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  
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
      </DialogContent>
    </Dialog>
  );
}

export default CacheStatus; 