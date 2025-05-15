import React, { useState, useEffect } from 'react';
import { useIris } from '../../contexts/IrisContext';
import { API_BASE_URL } from '../../config/api';
import { toast } from '../ui/use-toast';

/**
 * InlineMonthlyTargetForm Component
 *
 * Een zeer eenvoudige component voor het bewerken van maandelijkse targets,
 * specifiek ontworpen om direct in de IRIS pagina te worden gebruikt.
 */
export const InlineMonthlyTargetForm: React.FC = () => {
  const { selectedYear, fetchMonthlyTargets } = useIris();
  const [targets, setTargets] = useState<Array<{ month: number; targetAmount: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Maandnamen
  const monthNames = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ];

  // Haal targets op bij het laden van de component
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/iris/targets/monthly?year=${selectedYear}`);
        const data = await response.json();
        
        if (data.success && data.data && Array.isArray(data.data.data)) {
          const fetchedTargets = data.data.data.map(item => ({
            month: item.month,
            targetAmount: item.targetAmount.toString()
          }));
          
          setTargets(fetchedTargets);
          console.log('Targets opgehaald:', fetchedTargets);
        } else {
          // Als er geen data is, maak standaard targets
          const defaultTargets = monthNames.map((_, index) => ({
            month: index + 1,
            targetAmount: '200000'
          }));
          
          setTargets(defaultTargets);
          console.log('Standaard targets ingesteld:', defaultTargets);
        }
      } catch (error) {
        console.error('Fout bij ophalen targets:', error);
        setMessage('Fout bij ophalen van targets. Probeer het later opnieuw.');
        
        // Fallback naar standaard targets
        const defaultTargets = monthNames.map((_, index) => ({
          month: index + 1,
          targetAmount: '200000'
        }));
        
        setTargets(defaultTargets);
      }
    };

    fetchData();
  }, [selectedYear, monthNames]);

  // Handle input change
  const handleChange = (month: number, value: string) => {
    console.log(`Wijzigen target voor maand ${month} naar ${value}`);
    setTargets(prev => 
      prev.map(target => 
        target.month === month ? { ...target, targetAmount: value } : target
      )
    );
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      console.log('Targets opslaan:', targets);

      // Valideer input
      const validTargets = targets.map(target => ({
        month: target.month,
        targetAmount: parseFloat(target.targetAmount) || 0
      }));

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

      const responseData = await response.json();
      console.log('API Response:', responseData);

      if (response.ok) {
        setMessage('Targets succesvol opgeslagen!');
        toast({
          title: 'Targets opgeslagen',
          description: `De maandelijkse targets voor ${selectedYear} zijn succesvol opgeslagen.`,
          variant: 'default'
        });
        // Ververs data
        fetchMonthlyTargets(selectedYear);
      } else {
        setMessage(`Fout bij opslaan: ${responseData.message || 'Onbekende fout'}`);
        toast({
          title: 'Fout bij opslaan',
          description: `Er is een fout opgetreden: ${responseData.message || 'Onbekende fout'}`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error saving targets:', error);
      setMessage('Er is een fout opgetreden bij het opslaan van de targets.');
      toast({
        title: 'Fout bij opslaan',
        description: 'Er is een fout opgetreden bij het opslaan van de targets.',
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
      
      {message && (
        <div className={`p-3 m-4 rounded ${message.includes('Fout') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}
      
      <div className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {targets.map(target => (
              <div key={target.month} className="space-y-2">
                <label htmlFor={`target-${target.month}`} className="font-medium block">
                  {monthNames[target.month - 1]}
                </label>
                <input
                  id={`target-${target.month}`}
                  type="text"
                  value={target.targetAmount}
                  onChange={(e) => handleChange(target.month, e.target.value)}
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
                {isSubmitting ? 'Opslaan...' : 'Targets Opslaan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
