import React from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { EmployeeWithStats } from '../services/employee.service';
import { useAbsences } from '../hooks/useAbsences';

interface EmployeeAbsenceModalProps {
  employee: EmployeeWithStats;
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
}

export function EmployeeAbsenceModal({
  employee,
  isOpen,
  onClose,
  startDate,
  endDate
}: EmployeeAbsenceModalProps) {
  const { absences, isLoading } = useAbsences(startDate, endDate);
  
  // Filter absences for this employee
  const employeeAbsences = absences?.filter(
    absence => absence.employee.id === employee.id
  ) || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Absences for {employee.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-4">Loading absence data...</div>
          ) : employeeAbsences.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No absence records found for this period.
            </div>
          ) : (
            <div className="space-y-4">
              {employeeAbsences.map((absence) => (
                <div 
                  key={absence.id} 
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {absence.type.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {format(new Date(absence.startdate), 'dd MMM', { locale: nl })} - {format(new Date(absence.enddate), 'dd MMM yyyy', { locale: nl })}
                      </p>
                      {absence.description && (
                        <p className="text-sm mt-2">{absence.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-200">
                        {absence.hours_per_day} hours/day
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {absence.status.name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 