/**
 * Permissions Admin Page
 *
 * Dit component toont een lijst van permissies en biedt functionaliteit om permissies te beheren.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { Permission } from '../../db/unified/models/role';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';

/**
 * Permissions Admin Page Component
 */
const PermissionsPage: React.FC = () => {
  const { token } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State voor het aanmaken en bewerken van permissies
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentPermission, setCurrentPermission] = useState<Permission | null>(null);
  const [newPermission, setNewPermission] = useState<{
    name: string;
    description: string;
  }>({ name: '', description: '' });

  // Haal permissies op bij het laden van de pagina
  useEffect(() => {
    const fetchPermissions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/v1/permissions', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to fetch permissions');
        }

        setPermissions(data.data || []);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPermissions();
  }, [token]);

  // Functie om een nieuwe permissie aan te maken
  const handleCreatePermission = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/v1/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPermission)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create permission');
      }

      // Voeg de nieuwe permissie toe aan de lijst
      setPermissions(prevPermissions => [...prevPermissions, data.data]);

      // Reset het formulier
      setNewPermission({ name: '', description: '' });

      // Sluit de dialog
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating permission:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Functie om een permissie te bewerken
  const handleEditPermission = async () => {
    if (!currentPermission) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/permissions/${currentPermission.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: currentPermission.name,
          description: currentPermission.description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update permission');
      }

      // Update de permissie in de lijst
      setPermissions(prevPermissions => prevPermissions.map(permission =>
        permission.id === currentPermission.id ? data.data : permission
      ));

      // Reset het formulier
      setCurrentPermission(null);

      // Sluit de dialog
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating permission:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Functie om een permissie te selecteren voor bewerking
  const handleSelectPermission = (permission: Permission) => {
    setCurrentPermission(permission);
    setIsEditDialogOpen(true);
  };

  // Functie om het aanmaken van een nieuwe permissie te starten
  const handleOpenCreateDialog = () => {
    setNewPermission({ name: '', description: '' });
    setIsCreateDialogOpen(true);
  };

  // Functie om een permissie te verwijderen
  const handleDeletePermission = async (permissionId: number) => {
    if (!window.confirm('Weet je zeker dat je deze permissie wilt verwijderen?')) {
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`/api/v1/permissions/${permissionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete permission');
      }

      // Verwijder de permissie uit de lijst
      setPermissions(prevPermissions => prevPermissions.filter(permission => permission.id !== permissionId));
    } catch (error) {
      console.error('Error deleting permission:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Permissiebeheer</CardTitle>
            <CardDescription>Beheer permissies voor rollen</CardDescription>
          </div>
          <Button className="ml-auto" onClick={handleOpenCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe permissie
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
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                      Geen permissies gevonden
                    </TableCell>
                  </TableRow>
                ) : (
                  permissions.map(permission => (
                    <TableRow key={permission.id}>
                      <TableCell className="font-medium">{permission.name}</TableCell>
                      <TableCell>{permission.description || <span className="text-gray-500">-</span>}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mr-1"
                          onClick={() => handleSelectPermission(permission)}
                          disabled={permission.id! <= 15} // Standaard permissies kunnen niet worden bewerkt
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeletePermission(permission.id!)}
                          disabled={permission.id! <= 15} // Standaard permissies kunnen niet worden verwijderd
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

      {/* Dialog voor het aanmaken van een nieuwe permissie */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe permissie aanmaken</DialogTitle>
            <DialogDescription>
              Vul de gegevens in voor de nieuwe permissie.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Naam</Label>
              <Input
                id="name"
                value={newPermission.name}
                onChange={(e) => setNewPermission({ ...newPermission, name: e.target.value })}
                placeholder="Voer een naam in"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea
                id="description"
                value={newPermission.description}
                onChange={(e) => setNewPermission({ ...newPermission, description: e.target.value })}
                placeholder="Voer een beschrijving in"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Annuleren</Button>
            <Button onClick={handleCreatePermission} disabled={!newPermission.name || isLoading}>
              {isLoading ? 'Bezig...' : 'Opslaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog voor het bewerken van een permissie */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permissie bewerken</DialogTitle>
            <DialogDescription>
              Bewerk de gegevens van de permissie.
            </DialogDescription>
          </DialogHeader>

          {currentPermission && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Naam</Label>
                <Input
                  id="edit-name"
                  value={currentPermission.name}
                  onChange={(e) => setCurrentPermission({ ...currentPermission, name: e.target.value })}
                  placeholder="Voer een naam in"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-description">Beschrijving</Label>
                <Textarea
                  id="edit-description"
                  value={currentPermission.description || ''}
                  onChange={(e) => setCurrentPermission({ ...currentPermission, description: e.target.value })}
                  placeholder="Voer een beschrijving in"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Annuleren</Button>
            <Button
              onClick={handleEditPermission}
              disabled={!currentPermission || !currentPermission.name || isLoading}
            >
              {isLoading ? 'Bezig...' : 'Opslaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PermissionsPage;
