import React, { ReactNode, ErrorInfo, Component } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ApiStatusButton from './ApiStatusButton';
import OfflineBanner from './OfflineBanner';
import { useAuth } from '../../contexts/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { LogOut, User } from 'lucide-react';

// Error boundary component to catch errors in child components
class ErrorBoundary extends Component<{ children: ReactNode, fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode, fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div className="p-2 text-xs text-gray-500">Component Error</div>;
    }

    return this.props.children;
  }
}

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  // Gebruik de usePermission hook om te controleren of de gebruiker toegang heeft tot bepaalde pagina's
  const canViewProjects = usePermission('view_projects');
  const canViewEmployees = usePermission('view_employees');
  const canViewInvoices = usePermission('view_invoices');
  const canViewIris = usePermission('view_iris');
  const canManageUsers = usePermission('manage_users');
  const canManageRoles = usePermission('manage_roles');

  // Admin submenu items
  const adminItems = [
    ...(canManageUsers ? [{ name: 'Gebruikers', href: '/admin/users' }] : []),
    ...(canManageRoles ? [{ name: 'Rollen', href: '/admin/roles' }] : []),
    ...(canManageRoles ? [{ name: 'Permissies', href: '/admin/permissions' }] : []),
  ];

  // Bepaal of er admin items zijn
  const hasAdminItems = adminItems.length > 0;

  // Alle navigatie-items definiëren, maar alleen toegankelijke tonen
  const allNavItems = [
    { name: 'Dashboard', href: '/', permission: true }, // Dashboard is altijd toegankelijk
    { name: 'Projects', href: '/projects', permission: canViewProjects },
    { name: 'Employees', href: '/employees', permission: canViewEmployees },
    { name: 'Facturen', href: '/invoices', permission: canViewInvoices },
    { name: 'Iris', href: '/iris', permission: canViewIris },
    // Voeg admin menu toe als er admin items zijn
    ...(hasAdminItems ? [{ name: 'Admin', href: adminItems[0]?.href || '/admin', permission: true }] : []),
  ];

  // Alleen navigatie-items tonen waartoe de gebruiker toegang heeft
  const navigation = allNavItems.filter(item => item.permission);

  // Verwijderd: dubbele code voor het toevoegen van admin menu

  // Functie om uit te loggen
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Functie om de initialen van de gebruiker te krijgen voor de avatar
  const getUserInitials = () => {
    if (!user) return 'G';

    const firstName = user.first_name || '';
    const lastName = user.last_name || '';

    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`;
    } else if (firstName) {
      return firstName[0];
    } else if (user.username) {
      return user.username[0].toUpperCase();
    } else {
      return 'G';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ErrorBoundary>
        <OfflineBanner />
      </ErrorBoundary>

      <nav className="bg-white border-b border-gray-100">
        <div className="w-full px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <img src="/src/assets/logo_begripp.png" alt="Begripp Logo" className="h-8" />
              <div className="hidden md:flex items-center space-x-8 ml-10">
                {/* Toon alle navigatie-items, met tooltips voor niet-toegankelijke items */}
                {allNavItems.map((item) => {
                  // Check of dit het admin menu is (voor admin items gebruiken we nog steeds alleen toegankelijke items)
                  const isAdmin = item.name === 'Admin';
                  const isActive = isAdmin
                    ? location.pathname.startsWith('/admin')
                    : location.pathname === item.href ||
                      (item.href !== '/' && location.pathname.startsWith(item.href));

                  // Bepaal of het item toegankelijk is
                  const isAccessible = item.permission;

                  return (
                    <div key={item.name} className="relative group" style={{ paddingBottom: '2rem' }}>
                      {isAccessible ? (
                        // Toegankelijk item - normale link
                        <Link
                          to={item.href}
                          className={`${
                            isActive
                              ? 'text-primary border-b-2 border-primary'
                              : 'text-gray-500 hover:text-gray-700'
                          } text-sm font-medium h-16 flex items-center`}
                        >
                          {item.name}
                        </Link>
                      ) : (
                        // Niet-toegankelijk item - met tooltip
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="text-gray-300 cursor-not-allowed text-sm font-medium h-16 flex items-center"
                              >
                                {item.name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Je hebt geen toegang tot deze pagina</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* Dropdown menu voor admin */}
                      {isAdmin && adminItems.length > 0 && (
                        <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-10">
                          {/* Voeg een onzichtbare padding toe om een 'brug' te maken tussen het menu-item en de dropdown */}
                          <div className="h-2 -mt-2"></div>
                          <div className="py-1" role="menu" aria-orientation="vertical">
                            {adminItems.map((adminItem) => (
                              <Link
                                key={adminItem.name}
                                to={adminItem.href}
                                className={`block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${
                                  location.pathname === adminItem.href ? 'bg-gray-100' : ''
                                }`}
                                role="menuitem"
                              >
                                {adminItem.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ErrorBoundary fallback={<div className="text-xs text-gray-500 px-2">API Status</div>}>
                <ApiStatusButton />
              </ErrorBoundary>

              {isAuthenticated ? (
                <div className="flex items-center space-x-2 ml-4">
                  <Avatar size="sm" className="bg-primary text-white">
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                    <p className="font-medium">{user?.username}</p>
                    <p className="text-xs text-gray-500">{user?.roles?.[0]?.name || 'Gebruiker'}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleLogout} title="Uitloggen">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
                  <User className="h-4 w-4 mr-2" />
                  Inloggen
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="py-8">
        <div className="w-full">
          <ErrorBoundary fallback={
            <div className="p-8 text-center">
              <h2 className="text-xl font-semibold text-red-600 mb-2">Er is een fout opgetreden</h2>
              <p className="text-gray-600 mb-4">Er is een probleem opgetreden bij het laden van deze pagina.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Pagina verversen
              </button>
            </div>
          }>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}