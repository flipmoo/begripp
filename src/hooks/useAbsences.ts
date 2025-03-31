import { useState, useEffect } from 'react';
import { Absence, AbsencesByEmployee, AbsencesByDate } from '../services/absence.service';
import { API_BASE } from '../services/api';

interface UseAbsencesResult {
  absences: Absence[];
  absencesByEmployee: AbsencesByEmployee;
  absencesByDate: AbsencesByDate;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAbsences(startDate: string, endDate: string): UseAbsencesResult {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [absencesByEmployee, setAbsencesByEmployee] = useState<AbsencesByEmployee>({});
  const [absencesByDate, setAbsencesByDate] = useState<AbsencesByDate>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAbsences = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/absences?startDate=${startDate}&endDate=${endDate}`);
      if (!response.ok) {
        throw new Error('Failed to fetch absences');
      }
      const data = await response.json();
      setAbsences(data);
      
      // Group absences by employee
      const byEmployee: AbsencesByEmployee = {};
      // Group absences by date
      const byDate: AbsencesByDate = {};
      
      data.forEach((absence: Absence) => {
        // Group by employee
        const employeeId = absence.employee.id;
        if (!byEmployee[employeeId]) {
          byEmployee[employeeId] = [];
        }
        byEmployee[employeeId].push(absence);
        
        // Group by date (simplified - just using startdate)
        const dateStr = absence.startdate.split('T')[0];
        if (!byDate[dateStr]) {
          byDate[dateStr] = {};
        }
        byDate[dateStr][employeeId] = absence;
      });
      
      setAbsencesByEmployee(byEmployee);
      setAbsencesByDate(byDate);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch absences'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchAbsences();
    }
  }, [startDate, endDate]);

  return {
    absences,
    absencesByEmployee,
    absencesByDate,
    isLoading,
    error,
    refetch: fetchAbsences
  };
} 