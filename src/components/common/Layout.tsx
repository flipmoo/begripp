import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Projects', href: '/projects' },
    { name: 'Employees', href: '/employees' },
    { name: 'Facturen', href: '/invoices' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-[3200px] mx-auto px-4 sm:px-6 lg:px-8">
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
            <div className="flex items-center">
              <span className="text-sm text-gray-500">Laatste update: 14:14</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8">
        <div className="max-w-[3200px] mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
} 