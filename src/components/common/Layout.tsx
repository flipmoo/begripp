import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ValidationStatusButton from './ValidationStatusButton';
import ApiStatusButton from './ApiStatusButton';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navigation = [
    { name: 'Team Dashboard', href: '/dashboard' },
    { name: 'PM Dashboard', href: '/pm-dash' },
    { name: 'Projects', href: '/projects' },
    { name: 'Employees', href: '/employees' },
    { name: 'Facturen', href: '/invoices' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white border-b border-gray-100">
        <div className="w-full px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-semibold">Bravoure</span>
              <div className="hidden md:flex items-center space-x-8 ml-10">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href ||
                    (item.href !== '/' && location.pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive
                          ? 'text-primary border-b-2 border-primary'
                          : 'text-gray-500 hover:text-gray-700'
                      } text-sm font-medium h-16 flex items-center`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <ApiStatusButton />
              <ValidationStatusButton />
              <span className="text-sm text-gray-500 ml-4">Laatste update: 14:14</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8">
        <div className="w-full">
          {children}
        </div>
      </main>
    </div>
  );
} 