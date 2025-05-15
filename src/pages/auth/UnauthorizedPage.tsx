/**
 * Unauthorized Page
 * 
 * Dit component toont een bericht wanneer een gebruiker geen toegang heeft tot een pagina.
 */
import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Unauthorized Page Component
 */
const UnauthorizedPage: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 text-center">
      <div className="rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-4 text-3xl font-bold text-red-600">Toegang geweigerd</h1>
        
        <p className="mb-6 text-lg text-gray-700">
          Je hebt geen toegang tot deze pagina. Neem contact op met een beheerder als je denkt dat dit een fout is.
        </p>
        
        <div className="flex justify-center space-x-4">
          <Link
            to="/dashboard"
            className="rounded-md bg-blue-600 px-4 py-2 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Terug naar Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
