import React, { useState, useEffect } from 'react';
import { useIris } from '../../contexts/IrisContext';
import { API_BASE_URL } from '../../config/api';
import { toast } from '../ui/use-toast';

/**
 * SimpleMonthlyTargetForm Component
 *
 * Een vereenvoudigde component voor het bewerken van maandelijkse targets.
 */
export const SimpleMonthlyTargetForm: React.FC = () => {
  const { selectedYear, monthlyTargets, fetchMonthlyTargets } = useIris();
  const [formTargets, setFormTargets] = useState<Array<{ month: number; targetAmount: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Maandnamen
  const monthNames = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ];

  // Initialiseer targets wanneer monthlyTargets verandert
  useEffect(() => {
    console.log('Monthly targets in form:', monthlyTargets);

    if (monthlyTargets && Array.isArray(monthlyTargets)) {
      const initialTargets = monthNames.map((_, index) => {
        const month = index + 1;
        const target = monthlyTargets.find(t => t.month === month);
        
        return {
          month,
          targetAmount: target ? target.targetAmount.toString() : '200000'
        };
      });

      console.log('Setting initial targets:', initialTargets);
      setFormTargets(initialTargets);
    } else {
      // Fallback naar standaard targets als monthlyTargets geen array is
      const defaultTargets = monthNames.map((_, index) => ({
        month: index + 1,
        targetAmount: '200000'
      }));
      
      console.log('Setting default targets:', defaultTargets);
      setFormTargets(defaultTargets);
    }
  }, [monthlyTargets, monthNames]);

  // Handle input change
  const handleChange = (month: number, value: string) => {
    console.log(`Changing target for month ${month} to ${value}`);
    setFormTargets(prev => {
      const updated = prev.map(target =>
        target.month === month ? { ...target, targetAmount: value } : target
      );
      console.log('Updated targets:', updated);
      return updated;
    });
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      console.log('Submitting targets:', formTargets);

      // Valideer input
      const validTargets = formTargets.map(target => ({
        month: target.month,
        targetAmount: parseFloat(target.targetAmount) || 0
      }));

      console.log('Valid targets to submit:', validTargets);

      // Stuur data naar API
      const response = await fetch(`${API_BASE_URL}/api/v1/iris/targets/monthly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          year: selectedYear,
          targets: validTargets
        })
      });

      // Log de volledige response voor debugging
      const responseText = await response.text();
      console.log('API Response status:', response.status);
      console.log('API Response text:', responseText);

      // Probeer de response te parsen als JSON
      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log('API Response data:', responseData);
      } catch (e) {
        console.warn('Could not parse response as JSON:', e);
      }

      if (!response.ok) {
        throw new Error(`Fout bij opslaan van targets: ${response.statusText}`);
      }

      // Toon success toast
      toast({
        title: 'Targets opgeslagen',
        description: `De maandelijkse targets voor ${selectedYear} zijn succesvol opgeslagen.`,
        variant: 'default'
      });

      // Ververs data
      await fetchMonthlyTargets(selectedYear);
    } catch (error) {
      console.error('Error saving targets:', error);

      // Toon error toast
      toast({
        title: 'Fout bij opslaan',
        description: error instanceof Error ? error.message : 'Er is een onbekende fout opgetreden.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="bg-gray-50 border-b p-4">
        <h2 className="text-xl font-semibold">Maandelijkse Targets {selectedYear}</h2>
      </div>
      <div className="p-6">
        <form id="monthly-targets-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {formTargets.map(target => (
              <div key={target.month} className="space-y-2">
                <label htmlFor={`target-${target.month}`} className="font-medium block">
                  {monthNames[target.month - 1]}
                </label>
                <input
                  id={`target-${target.month}`}
                  name={`target-${target.month}`}
                  type="number"
                  value={target.targetAmount}
                  onChange={(e) => handleChange(target.month, e.target.value)}
                  min="0"
                  step="1000"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  disabled={isSubmitting}
                />
              </div>
            ))}
          </div>
          
          <div className="mt-8 border-t pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-500 mb-2 sm:mb-0">
                {isSubmitting ?
                  'Bezig met opslaan...' :
                  'Wijzig de targets hierboven en klik op de knop om ze op te slaan'
                }
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full sm:w-auto"
              >
                {isSubmitting ?
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Opslaan...
                  </span> :
                  'Targets Opslaan'
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
