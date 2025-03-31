import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { getEmployeeStats, getEmployeeMonthStats, EmployeeWithStats, clearEmployeeCache } from '../../services/employee.service';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, UserX, Save } from 'lucide-react';
import { useToast } from '../ui/use-toast';

// Definieer de structuur van de opgeslagen filters
interface SavedFilters {
  periodType: 'week' | 'month';
  selectedYear: number;
  selectedPeriod: number;
  percentageRange: [number, number];
  showExcluded: boolean;
  excludedEmployees: number[];
}

interface EmployeeWithPercentage extends EmployeeWithStats {
  percentage: number;
  excluded: boolean;
}

export interface IncompleteHoursFilterRef {
  refreshData: () => void;
}

interface IncompleteHoursFilterProps {
  onFilterChange?: (filteredEmployees: EmployeeWithPercentage[]) => void;
}

const STORAGE_KEY = 'incomplete-hours-filters';

// Function to sync hours data
const syncHoursData = async (startDate: string, endDate: string) => {
  try {
    console.log(`Syncing employee hours data from ${startDate} to ${endDate}...`);
    
    // Sync the data
    const syncResponse = await fetch(`/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate }),
    });
    
    if (!syncResponse.ok) {
      const errorData = await syncResponse.json();
      console.error('Sync response error:', errorData);
      throw new Error(`Failed to sync data: ${syncResponse.status} ${syncResponse.statusText}`);
    }
    
    // Wait a moment for sync to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clear the cache
    const cacheResponse = await fetch('/api/cache/clear', {
      method: 'POST',
    });
    
    if (!cacheResponse.ok) {
      const errorData = await cacheResponse.json();
      console.error('Cache clear response error:', errorData);
      throw new Error(`Failed to clear cache: ${cacheResponse.status} ${cacheResponse.statusText}`);
    }
    
    // Clear local cache
    await clearEmployeeCache();
    
    return true;
  } catch (error) {
    console.error('Error syncing hours data:', error);
    return false;
  }
};

const IncompleteHoursFilter = forwardRef<IncompleteHoursFilterRef, IncompleteHoursFilterProps>(({ onFilterChange }, ref) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeWithPercentage[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithPercentage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [syncingData, setSyncingData] = useState(false);
  
  // Expose refreshData function to parent
  useImperativeHandle(ref, () => ({
    refreshData: () => {
      // Force a refresh by incrementing retryCount
      setRetryCount(prev => prev + 1);
    }
  }));

  // Laad de opgeslagen filters uit localStorage
  const loadSavedFilters = (): SavedFilters | null => {
    try {
      const savedFilters = localStorage.getItem(STORAGE_KEY);
      if (savedFilters) {
        return JSON.parse(savedFilters);
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
    return null;
  };
  
  // Initiële waarden voor filters, gebruik opgeslagen waarden als ze bestaan
  const savedFilters = loadSavedFilters();

  // Filter states
  const [periodType, setPeriodType] = useState<'week' | 'month'>(
    savedFilters?.periodType || 'week'
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    savedFilters?.selectedYear || new Date().getFullYear()
  );
  const [selectedPeriod, setSelectedPeriod] = useState<number>(
    savedFilters?.selectedPeriod !== undefined ? savedFilters.selectedPeriod : 
    (periodType === 'week' ? Math.floor(new Date().getDate() / 7) + 1 : new Date().getMonth())
  );
  const [percentageRange, setPercentageRange] = useState<[number, number]>(
    savedFilters?.percentageRange || [0, 100]
  );
  const [showExcluded, setShowExcluded] = useState<boolean>(
    savedFilters?.showExcluded || false
  );
  const [excludedEmployees, setExcludedEmployees] = useState<Set<number>>(
    new Set(savedFilters?.excludedEmployees || [])
  );

  // Trigger data fetch when component mounts with saved filters
  useEffect(() => {
    if (savedFilters) {
      console.log('Loaded saved filters, triggering data fetch:', savedFilters);
      // Verhoog de retryCount om de data opnieuw op te halen met de geladen filters
      setRetryCount(prev => prev + 1);
    }
  }, []);

  // Generate period options
  const periodOptions = useMemo(() => {
    if (periodType === 'week') {
      return Array.from({ length: 52 }, (_, i) => ({
        value: i + 1,
        label: `Week ${i + 1}`
      }));
    } else {
      return [
        { value: 0, label: 'Januari' },
        { value: 1, label: 'Februari' },
        { value: 2, label: 'Maart' },
        { value: 3, label: 'April' },
        { value: 4, label: 'Mei' },
        { value: 5, label: 'Juni' },
        { value: 6, label: 'Juli' },
        { value: 7, label: 'Augustus' },
        { value: 8, label: 'September' },
        { value: 9, label: 'Oktober' },
        { value: 10, label: 'November' },
        { value: 11, label: 'December' }
      ];
    }
  }, [periodType]);

  // Generate year options (current year and 2 years back)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      { value: currentYear - 2, label: `${currentYear - 2}` },
      { value: currentYear - 1, label: `${currentYear - 1}` },
      { value: currentYear, label: `${currentYear}` },
    ];
  }, []);
  
  // Functie om de huidige filter instellingen op te slaan
  const saveFilters = () => {
    try {
      const filtersToSave: SavedFilters = {
        periodType,
        selectedYear,
        selectedPeriod,
        percentageRange,
        showExcluded,
        excludedEmployees: Array.from(excludedEmployees)
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtersToSave));
      
      toast({
        title: "Filters opgeslagen",
        description: "De filter instellingen zijn opgeslagen en worden gebruikt bij het opnieuw laden van de pagina.",
      });
    } catch (error) {
      console.error('Error saving filters:', error);
      toast({
        title: "Fout bij opslaan",
        description: "Er is een fout opgetreden bij het opslaan van de filters.",
        variant: "destructive",
      });
    }
  };
  
  // Helper function to auto-save filters without showing toast notifications
  const autoSaveFilters = (overrides: Partial<SavedFilters> = {}) => {
    setTimeout(() => {
      try {
        const filtersToSave: SavedFilters = {
          periodType,
          selectedYear,
          selectedPeriod,
          percentageRange,
          showExcluded,
          excludedEmployees: Array.from(excludedEmployees),
          ...overrides // Apply any overrides
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtersToSave));
        console.log('Filters automatically saved');
      } catch (error) {
        console.error('Error auto-saving filters:', error);
      }
    }, 0);
  };

  // Function to get date range for the selected period
  const getSelectedPeriodDateRange = (): { startDate: string, endDate: string } => {
    const year = selectedYear;
    
    if (periodType === 'month') {
      // Create date for first day of selected month
      const month = selectedPeriod + 1; // JavaScript months are 0-indexed, but our UI is 1-indexed
      const monthStr = month.toString().padStart(2, '0');
      
      // First day of selected month
      const startDate = `${year}-${monthStr}-01`;
      
      // Last day of selected month
      const lastDay = new Date(year, month, 0).getDate();
      const lastDayStr = lastDay.toString().padStart(2, '0');
      const endDate = `${year}-${monthStr}-${lastDayStr}`;
      
      return { startDate, endDate };
    } else {
      // For week, create a date range for the selected week
      // This is a simplified calculation and may need adjustment
      const date = new Date(year, 0, 1 + (selectedPeriod - 1) * 7);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      
      const startDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      // End date is 6 days later
      const endDateObj = new Date(date);
      endDateObj.setDate(date.getDate() + 6);
      const endMonth = endDateObj.getMonth() + 1;
      const endDay = endDateObj.getDate();
      
      const endDate = `${endDateObj.getFullYear()}-${endMonth.toString().padStart(2, '0')}-${endDay.toString().padStart(2, '0')}`;
      
      return { startDate, endDate };
    }
  };

  // Handle manual sync button click
  const handleSyncData = async () => {
    setSyncingData(true);
    try {
      const { startDate, endDate } = getSelectedPeriodDateRange();
      console.log(`Syncing hours for period: ${startDate} to ${endDate}`);
      
      const success = await syncHoursData(startDate, endDate);
      
      if (success) {
        toast({
          title: "Synchronisatie voltooid",
          description: "Medewerker uren zijn bijgewerkt.",
        });
        // Trigger a refresh of the data
        setRetryCount(prev => prev + 1);
      } else {
        setError('Synchronisatie van uren is mislukt. Probeer het later opnieuw.');
        toast({
          title: "Synchronisatie mislukt",
          description: "Er is een fout opgetreden bij het synchroniseren van de uren.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error syncing data:', err);
      setError('Synchronisatie van uren is mislukt. Probeer het later opnieuw.');
      toast({
        title: "Synchronisatie mislukt",
        description: "Er is een fout opgetreden bij het synchroniseren van de uren.",
        variant: "destructive",
      });
    } finally {
      setSyncingData(false);
    }
  };

  // Fetch employee data when filters change
  useEffect(() => {
    const fetchEmployeeHours = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let result;
        
        // Force refresh when filters change to avoid using cached data with different criteria
        // We still want to respect the cache when just loading the component initially
        const isFilterChange = retryCount > 0;
        
        if (periodType === 'week') {
          result = await getEmployeeStats(
            selectedYear, 
            selectedPeriod, 
            undefined, 
            isFilterChange, 
            false, // Not preloading
            true   // Is dashboard request
          );
        } else {
          result = await getEmployeeMonthStats(
            selectedYear, 
            selectedPeriod, 
            isFilterChange, 
            false, // Not preloading
            true   // Is dashboard request
          );
        }
        
        // Verwerk het resultaat direct, zonder additionele checks 
        // die kunnen leiden tot onnodige rerenders
        const employeeData = result.data || [];
        
        // Transform to EmployeeWithPercentage and mark excluded employees
        const transformedEmployees = employeeData
          .filter(employee => employee.active !== false) // Only active employees
          .map(employee => {
            // Calculate percentage of written hours vs expected hours
            const percentage = employee.expectedHours > 0 ? 
              (employee.writtenHours / employee.expectedHours) * 100 : 100;
            
            return {
              ...employee,
              percentage,
              excluded: excludedEmployees.has(employee.id)
            };
          })
          .sort((a, b) => a.percentage - b.percentage); // Sort by percentage (lowest first)
        
        setEmployees(transformedEmployees);
        // Reset retry count after successful fetch
        if (retryCount > 0) {
          setRetryCount(0);
        }
      } catch (err) {
        console.error('Error fetching employee hours:', err);
        setError('Er is een fout opgetreden bij het laden van de medewerker uren. Controleer of de API-server draait.');
        
        // Retry after 5 seconds if the API server might be starting up
        if (retryCount < 3) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 5000);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeHours();
  }, [periodType, selectedYear, selectedPeriod, retryCount, excludedEmployees]);

  // Apply filters and update filtered employees
  useEffect(() => {
    const filtered = employees.filter(employee => {
      // Filter by percentage range
      const isInPercentageRange = 
        employee.percentage >= percentageRange[0] && 
        employee.percentage <= percentageRange[1];
      
      // Filter by excluded status
      const passesExclusionFilter = showExcluded || !employee.excluded;
      
      return isInPercentageRange && passesExclusionFilter;
    });
    
    setFilteredEmployees(filtered);
    
    // Notify parent component if callback is provided
    if (onFilterChange) {
      onFilterChange(filtered);
    }
  }, [employees, percentageRange, showExcluded, onFilterChange]);

  const handleEmployeeClick = (employeeId: number) => {
    navigate(`/employees/${employeeId}`);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const toggleEmployeeExclusion = (employeeId: number) => {
    setExcludedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      
      // After updating the state, automatically save filters
      autoSaveFilters({ excludedEmployees: Array.from(newSet) });
      
      return newSet;
    });
    
    // Update the excluded status in the employees array directly
    setEmployees(prevEmployees => 
      prevEmployees.map(employee => 
        employee.id === employeeId 
          ? { ...employee, excluded: !employee.excluded } 
          : employee
      )
    );
    
    // Force refresh data after toggling exclusion
    setRetryCount(prev => prev + 1);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Medewerkers met Onvolledige Uren</CardTitle>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={saveFilters}
          >
            <Save className="h-4 w-4" />
            <span>Filters opslaan</span>
          </Button>
          <button 
            onClick={handleSyncData}
            disabled={syncingData}
            className="p-1 text-gray-500 hover:text-blue-500 focus:outline-none" 
            title="Synchroniseer medewerker uren voor deze periode"
          >
            <RefreshCw className={`h-5 w-5 ${syncingData ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {syncingData && (
          <div className="mb-4 bg-blue-50 text-blue-700 p-2 rounded flex items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            <span>Medewerker uren worden gesynchroniseerd...</span>
          </div>
        )}
        
        {/* Filter controls */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Period type selector */}
            <div className="space-y-2">
              <Label>Periode type</Label>
              <Select 
                value={periodType} 
                onValueChange={(value) => {
                  setPeriodType(value as 'week' | 'month');
                  // Force refresh when period type changes
                  setRetryCount(prev => prev + 1);
                  
                  // Auto-save the filters when period type changes
                  autoSaveFilters({ periodType: value as 'week' | 'month' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer periode type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Maand</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Year selector */}
            <div className="space-y-2">
              <Label>Jaar</Label>
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(value) => {
                  setSelectedYear(parseInt(value));
                  // Force refresh when year changes
                  setRetryCount(prev => prev + 1);
                  
                  // Auto-save the filters when year changes
                  autoSaveFilters({ selectedYear: parseInt(value) });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer jaar" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Period selector */}
            <div className="space-y-2">
              <Label>{periodType === 'week' ? 'Week' : 'Maand'}</Label>
              <Select 
                value={selectedPeriod.toString()} 
                onValueChange={(value) => {
                  setSelectedPeriod(parseInt(value));
                  // Force refresh when period changes
                  setRetryCount(prev => prev + 1);
                  
                  // Auto-save the filters when period changes
                  autoSaveFilters({ selectedPeriod: parseInt(value) });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Selecteer ${periodType === 'week' ? 'week' : 'maand'}`} />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Percentage range slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Percentage bereik</Label>
              <span className="text-sm text-gray-500">
                {percentageRange[0]}% - {percentageRange[1]}%
              </span>
            </div>
            <Slider
              value={percentageRange}
              min={0}
              max={100}
              step={5}
              onValueChange={(value) => setPercentageRange(value as [number, number])}
              onValueCommit={(value) => {
                // Only trigger refresh when the user finishes dragging
                setRetryCount(prev => prev + 1);
                
                // Auto-save the filters when percentage range changes
                autoSaveFilters({ percentageRange: value as [number, number] });
              }}
              className="py-4"
            />
          </div>
          
          {/* Show excluded employees checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show-excluded" 
              checked={showExcluded}
              onCheckedChange={(checked) => {
                setShowExcluded(checked === true);
                setRetryCount(prev => prev + 1);
                
                // Auto-save the filters when show excluded changes
                autoSaveFilters({ showExcluded: checked === true });
              }}
            />
            <Label htmlFor="show-excluded">Toon uitgesloten medewerkers</Label>
          </div>
        </div>
        
        {/* Employee list */}
        {loading ? (
          <div className="text-center py-4 text-gray-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            Medewerker gegevens laden...
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-red-500 mb-2">{error}</p>
            <Button 
              onClick={handleRetry}
              variant="outline"
              className="flex items-center mx-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Opnieuw proberen
            </Button>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            Geen medewerkers gevonden met de huidige filters
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEmployees.map(employee => (
              <div 
                key={employee.id} 
                className={`space-y-1 p-2 rounded-md border ${employee.excluded ? 'border-red-100 bg-red-50' : 'border-gray-100'}`}
              >
                <div className="flex justify-between items-center">
                  <div 
                    className="font-medium cursor-pointer hover:text-blue-600"
                    onClick={() => handleEmployeeClick(employee.id)}
                  >
                    {employee.name}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={employee.percentage < 75 ? "text-red-500 font-medium" : "text-yellow-500 font-medium"}>
                      {Math.round(employee.percentage)}%
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`p-1 ${employee.excluded ? 'text-red-500' : 'text-gray-400'}`}
                      onClick={() => toggleEmployeeExclusion(employee.id)}
                      title={employee.excluded ? "Medewerker weer toevoegen" : "Medewerker uitsluiten"}
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Progress 
                  value={employee.percentage} 
                  className={`h-2 ${employee.percentage < 75 ? "bg-red-100" : "bg-yellow-100"}`}
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Geschreven: {employee.writtenHours.toFixed(1)} uur</span>
                  <span>Verwacht: {employee.expectedHours.toFixed(1)} uur</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default IncompleteHoursFilter; 