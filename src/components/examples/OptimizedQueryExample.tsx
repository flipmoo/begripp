/**
 * OptimizedQueryExample
 * 
 * Een voorbeeld component dat laat zien hoe je de geoptimaliseerde query hooks kunt gebruiken.
 */
import React, { useState } from 'react';

// UI componenten
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

// Hooks
import { useOptimizedQuery } from '../../hooks/useOptimizedQuery';
import { useErrorHandler } from '../../hooks/useErrorHandler';

// Types
interface User {
  id: number;
  name: string;
  email: string;
}

/**
 * OptimizedQueryExample
 * 
 * Een voorbeeld component dat laat zien hoe je de geoptimaliseerde query hooks kunt gebruiken.
 */
export function OptimizedQueryExample() {
  // State
  const [userId, setUserId] = useState<string>('1');
  
  // Error handler
  const handleError = useErrorHandler();
  
  // Query voor het ophalen van een gebruiker
  const {
    data: user,
    isLoading,
    isError,
    error,
    isRefetching,
    refetch
  } = useOptimizedQuery<User, Error>(
    ['user', userId],
    async () => {
      // Simuleer een API call
      const response = await fetch(`https://jsonplaceholder.typicode.com/users/${userId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }
      
      return response.json();
    },
    {
      // Alleen uitvoeren als userId een geldige waarde is
      enabled: !!userId && !isNaN(Number(userId)),
      
      // Kortere stale time voor dit voorbeeld
      staleTime: 60 * 1000, // 1 minuut
      
      // Error handling
      onError: (error) => {
        handleError(error, {
          title: 'Fout bij ophalen gebruiker',
          context: { userId }
        });
      }
    }
  );
  
  // Event handlers
  const handleUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserId(e.target.value);
  };
  
  const handleRefetchClick = () => {
    refetch();
  };
  
  // Render helpers
  const renderContent = () => {
    if (isLoading && !isRefetching) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="ml-2">Gebruiker laden...</span>
        </div>
      );
    }
    
    if (isError) {
      return (
        <div className="p-4 bg-red-50 text-red-800 rounded-md">
          <p>Er is een fout opgetreden bij het ophalen van de gebruiker.</p>
          <Button 
            variant="outline" 
            className="mt-2" 
            onClick={handleRefetchClick}
          >
            Probeer opnieuw
          </Button>
        </div>
      );
    }
    
    if (!user) {
      return (
        <div className="p-4 bg-gray-50 rounded-md">
          <p>Geen gebruiker gevonden. Voer een geldig gebruikers-ID in.</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {isRefetching && (
          <div className="text-sm text-blue-500 flex items-center">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2" />
            Gegevens vernieuwen...
          </div>
        )}
        
        <div className="space-y-2">
          <div className="font-medium">Naam</div>
          <div>{user.name}</div>
        </div>
        
        <div className="space-y-2">
          <div className="font-medium">E-mail</div>
          <div>{user.email}</div>
        </div>
      </div>
    );
  };
  
  // Component render
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Gebruiker Ophalen</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="userId">Gebruikers-ID</Label>
            <div className="flex space-x-2">
              <Input
                id="userId"
                value={userId}
                onChange={handleUserIdChange}
                placeholder="Voer een gebruikers-ID in"
              />
              <Button onClick={handleRefetchClick}>
                Ophalen
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Voer een ID in tussen 1 en 10 voor geldige gebruikers.
            </p>
          </div>
          
          <div className="border-t pt-4">
            {renderContent()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
