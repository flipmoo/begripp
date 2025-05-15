/**
 * UnifiedEmployeesPage Component
 * 
 * This component serves as a wrapper around the existing employees functionality
 * to maintain compatibility with the unified data structure approach.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';

const UnifiedEmployeesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Employees</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/employees/cards')}>
            View as Cards
          </Button>
        </div>
      </div>

      <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded-md" role="alert">
        <p className="font-bold">Component Under Development</p>
        <p>The unified employees page is currently under development. Please use the Cards view for now.</p>
        <Button 
          className="mt-2" 
          variant="outline" 
          onClick={() => navigate('/employees/cards')}
        >
          Go to Cards View
        </Button>
      </div>
    </div>
  );
};

export default UnifiedEmployeesPage;
