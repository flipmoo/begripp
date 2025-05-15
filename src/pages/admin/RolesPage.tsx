/**
 * Roles Admin Page
 *
 * Dit component toont een lijst van rollen en biedt functionaliteit om rollen te beheren.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { Role, Permission } from '../../db/unified/models/role';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';

/**
 * Roles Admin Page Component
 */
const RolesPage: React.FC = () => {
  const { token } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State voor het aanmaken en bewerken van rollen
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [newRole, setNewRole] = useState<{
    name: string;
    description: string;
    permissions: number[];
  }>({ name: '', description: '', permissions: [] });

  // Haal rollen en permissies op bij het laden van de pagina
  useEffect(() => {
    let isMounted = true; // Flag om bij te houden of de component nog gemount is

    const fetchData = async () => {
      if (!isMounted) return; // Controleer of de component nog gemount is

      setIsLoading(true);
      setError(null);

      try {
        // Haal rollen op
        const rolesResponse = await fetch('/api/v1/roles', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!isMounted) return; // Controleer opnieuw na de asynchrone operatie

        const rolesData = await rolesResponse.json();

        if (!rolesResponse.ok) {
          throw new Error(rolesData.error?.message || 'Failed to fetch roles');
        }

        if (!isMounted) return;
        setRoles(rolesData.data || []);

        // Haal permissies op
        const permissionsResponse = await fetch('/api/v1/permissions', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!isMounted) return;

        const permissionsData = await permissionsResponse.json();

        if (!permissionsResponse.ok) {
          throw new Error(permissionsData.error?.message || 'Failed to fetch permissions');
        }

        if (!isMounted) return;
        setPermissions(permissionsData.data || []);
      } catch (error) {
        if (!isMounted) return;
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    fetchData();

    // Cleanup functie die wordt uitgevoerd wanneer de component unmount
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Functie om een rol te verwijderen
  const handleDeleteRole = async (roleId: number) => {
    if (!window.confirm('Weet je zeker dat je deze rol wilt verwijderen?')) {
      return;
    }

    try {
      setIsLoading(true); // Toon loading state

      const response = await fetch(`/api/v1/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete role');
      }

      // Verwijder de rol uit de lijst
      setRoles(prevRoles => prevRoles.filter(role => role.id !== roleId));
    } catch (error) {
      console.error('Error deleting role:', error);
      setError(error instanceof Error ? error.message : 'Er is een fout opgetreden bij het verwijderen van de rol.');
    } finally {
      setIsLoading(false); // Verberg loading state
    }
  };

  // Functie om een nieuwe rol aan te maken
  const handleCreateRole = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/v1/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newRole)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create role');
      }

      // Voeg de nieuwe rol toe aan de lijst
      setRoles(prevRoles => [...prevRoles, data.data]);

      // Reset het formulier
      setNewRole({ name: '', description: '', permissions: [] });

      // Sluit de dialog
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating role:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Functie om een rol te bewerken
  const handleEditRole = async () => {
    if (!currentRole) return;

    try {
      setIsLoading(true);
      setError(null);

      // Bereid de permissies voor om naar de server te sturen
      const permissionsToSend = Array.isArray(currentRole.permissions)
        ? currentRole.permissions.map(p => typeof p === 'object' ? p.id : p)
        : [];

      console.log('Sending role update with permissions:', permissionsToSend);

      const response = await fetch(`/api/v1/roles/${currentRole.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: currentRole.name,
          description: currentRole.description,
          permissions: permissionsToSend
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update role');
      }

      // Update de rol in de lijst
      setRoles(prevRoles => prevRoles.map(role => role.id === currentRole.id ? data.data : role));

      // Reset het formulier
      setCurrentRole(null);

      // Sluit de dialog
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating role:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Functie om een rol te selecteren voor bewerking
  const handleSelectRole = (role: Role) => {
    setCurrentRole({
      ...role,
      permissions: role.permissions.map(p => typeof p === 'object' ? p.id : p)
    });
    setIsEditDialogOpen(true);
  };

  // Functie om het aanmaken van een nieuwe rol te starten
  const handleOpenCreateDialog = () => {
    setNewRole({ name: '', description: '', permissions: [] });
    setIsCreateDialogOpen(true);
  };

  // Functie om een checkbox voor een permissie te togglen bij het aanmaken van een rol
  const handleTogglePermission = (permissionId: number) => {
    setNewRole(prev => {
      const permissions = prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId];
      return { ...prev, permissions };
    });
  };

  // Functie om een checkbox voor een permissie te togglen bij het bewerken van een rol
  const handleToggleEditPermission = (permissionId: number) => {
    if (!currentRole) return;

    console.log('Toggling permission:', permissionId, 'for role:', currentRole.id);
    console.log('Current permissions before toggle:', currentRole.permissions);

    setCurrentRole(prev => {
      if (!prev) return prev;

      const permissions = Array.isArray(prev.permissions)
        ? prev.permissions.map(p => typeof p === 'object' ? p.id : p)
        : [];

      console.log('Permissions array after mapping:', permissions);

      const newPermissions = permissions.includes(permissionId)
        ? permissions.filter(id => id !== permissionId)
        : [...permissions, permissionId];

      console.log('New permissions after toggle:', newPermissions);

      return { ...prev, permissions: newPermissions };
    });
  };

  // Functie om de permissies van een rol op te halen
  const fetchRolePermissions = async (roleId: number): Promise<Permission[]> => {
    try {
      const response = await fetch(`/api/v1/roles/${roleId}/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch role permissions');
      }

      return data.data || [];
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return [];
    }
  };

  // Functie om een rol te laden met permissies
  const loadRoleWithPermissions = async (roleId: number) => {
    try {
      const response = await fetch(`/api/v1/roles/${roleId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch role');
      }

      return data.data;
    } catch (error) {
      console.error('Error loading role:', error);
      return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Rollenbeheer</CardTitle>
            <CardDescription>Beheer rollen en hun permissies</CardDescription>
          </div>
          <Button className="ml-auto" onClick={handleOpenCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe rol
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Beschrijving</TableHead>
                  <TableHead>Permissies</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      Geen rollen gevonden
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map(role => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>{role.description || <span className="text-gray-500">-</span>}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions ? (
                            role.permissions.slice(0, 5).map(permission => (
                              <Badge key={permission.id} variant="outline" className="mr-1">
                                {permission.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-gray-500">Laden...</span>
                          )}
                          {role.permissions && role.permissions.length > 5 && (
                            <Badge variant="outline" className="mr-1">
                              +{role.permissions.length - 5} meer
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mr-1"
                          onClick={() => handleSelectRole(role)}
                          disabled={role.id! <= 3} // Standaard rollen kunnen niet worden bewerkt
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteRole(role.id!)}
                          disabled={role.id! <= 3} // Standaard rollen kunnen niet worden verwijderd
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog voor het aanmaken van een nieuwe rol */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe rol aanmaken</DialogTitle>
            <DialogDescription>
              Vul de gegevens in voor de nieuwe rol.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Naam</Label>
              <Input
                id="name"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                placeholder="Voer een naam in"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea
                id="description"
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                placeholder="Voer een beschrijving in"
              />
            </div>

            <div className="grid gap-2">
              <Label>Permissies</Label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded-md">
                {permissions.map(permission => (
                  <div key={permission.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`permission-${permission.id}`}
                      checked={newRole.permissions.includes(permission.id!)}
                      onCheckedChange={() => handleTogglePermission(permission.id!)}
                    />
                    <Label
                      htmlFor={`permission-${permission.id}`}
                      className="text-sm font-normal"
                    >
                      {permission.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Annuleren</Button>
            <Button onClick={handleCreateRole} disabled={!newRole.name || isLoading}>
              {isLoading ? 'Bezig...' : 'Opslaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog voor het bewerken van een rol */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rol bewerken</DialogTitle>
            <DialogDescription>
              Bewerk de gegevens van de rol.
            </DialogDescription>
          </DialogHeader>

          {currentRole && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Naam</Label>
                <Input
                  id="edit-name"
                  value={currentRole.name}
                  onChange={(e) => setCurrentRole({ ...currentRole, name: e.target.value })}
                  placeholder="Voer een naam in"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-description">Beschrijving</Label>
                <Textarea
                  id="edit-description"
                  value={currentRole.description || ''}
                  onChange={(e) => setCurrentRole({ ...currentRole, description: e.target.value })}
                  placeholder="Voer een beschrijving in"
                />
              </div>

              <div className="grid gap-2">
                <Label>Permissies</Label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded-md">
                  {permissions.map(permission => {
                    const permissionIds = Array.isArray(currentRole.permissions)
                      ? currentRole.permissions.map(p => typeof p === 'object' ? p.id : p)
                      : [];

                    return (
                      <div key={permission.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-permission-${permission.id}`}
                          checked={permissionIds.includes(permission.id!)}
                          onCheckedChange={() => handleToggleEditPermission(permission.id!)}
                        />
                        <Label
                          htmlFor={`edit-permission-${permission.id}`}
                          className="text-sm font-normal"
                        >
                          {permission.name}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Annuleren</Button>
            <Button
              onClick={handleEditRole}
              disabled={!currentRole || !currentRole.name || isLoading}
            >
              {isLoading ? 'Bezig...' : 'Opslaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RolesPage;
