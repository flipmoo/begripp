import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { getEmployeeStats, getEmployeeMonthStats, EmployeeWithStats } from '../../services/employee.service';
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

interface IncompleteHoursFilterProps {
  onFilterChange?: (filteredEmployees: EmployeeWithPercentage[]) => void;
}

const STORAGE_KEY = 'incomplete-hours-filters';

const IncompleteHoursFilter: React.FC<IncompleteHoursFilterProps> = ({ onFilterChange }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeWithPercentage[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithPercentage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
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

  // Fetch employee data when filters change
  useEffect(() => {
    const fetchEmployeeHours = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let employeeData: EmployeeWithStats[];
        
        if (periodType === 'week') {
          employeeData = await getEmployeeStats(selectedYear, selectedPeriod);
        } else {
          employeeData = await getEmployeeMonthStats(selectedYear, selectedPeriod);
        }
        
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
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Medewerkers met Onvolledige Uren</CardTitle>
        <Button 
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
          onClick={saveFilters}
        >
          <Save className="h-4 w-4" />
          <span>Filters opslaan</span>
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filter controls */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Period type selector */}
            <div className="space-y-2">
              <Label>Periode type</Label>
              <Select 
                value={periodType} 
                onValueChange={(value) => setPeriodType(value as 'week' | 'month')}
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
                onValueChange={(value) => setSelectedYear(parseInt(value))}
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
                onValueChange={(value) => setSelectedPeriod(parseInt(value))}
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
              className="py-4"
            />
          </div>
          
          {/* Show excluded employees checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show-excluded" 
              checked={showExcluded}
              onCheckedChange={(checked) => setShowExcluded(checked === true)}
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
};

export default IncompleteHoursFilter; 