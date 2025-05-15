/**
 * Users Admin Page
 *
 * Dit component toont een lijst van gebruikers en biedt functionaliteit om gebruikers te beheren.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Pencil, Trash2, UserPlus, Check, X } from 'lucide-react';
import { UserResponse } from '../../db/unified/models/user';

/**
 * Users Admin Page Component
 */
const UsersPage: React.FC = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [showEditUserForm, setShowEditUserForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    isActive: true,
    isAdmin: false,
    roles: []
  });
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [availableRoles, setAvailableRoles] = useState<{id: number, name: string}[]>([]);

  // Haal gebruikers en rollen op bij het laden van de pagina
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Haal gebruikers op
        const usersResponse = await fetch('/api/v1/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const usersData = await usersResponse.json();

        if (!usersResponse.ok) {
          throw new Error(usersData.error?.message || 'Failed to fetch users');
        }

        setUsers(usersData.data || []);

        // Haal rollen op
        const rolesResponse = await fetch('/api/v1/roles', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const rolesData = await rolesResponse.json();

        if (!rolesResponse.ok) {
          throw new Error(rolesData.error?.message || 'Failed to fetch roles');
        }

        setAvailableRoles(rolesData.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Functie om een nieuwe gebruiker aan te maken
  const handleCreateUser = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/v1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create user');
      }

      // Voeg de nieuwe gebruiker toe aan de lijst
      setUsers([...users, data.data]);

      // Reset het formulier
      setNewUser({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        isActive: true,
        isAdmin: false,
        roles: []
      });

      // Sluit het formulier
      setShowNewUserForm(false);
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Functie om het nieuwe gebruiker formulier te tonen
  const handleShowNewUserForm = () => {
    setShowNewUserForm(true);
  };

  // Functie om het nieuwe gebruiker formulier te verbergen
  const handleCancelNewUserForm = () => {
    setShowNewUserForm(false);
    setNewUser({
      username: '',
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      isActive: true,
      isAdmin: false,
      roles: []
    });
  };

  // Functie om een gebruiker te selecteren voor bewerking
  const handleSelectUser = (user: UserResponse) => {
    setCurrentUser(user);
    setShowEditUserForm(true);
  };

  // Functie om het bewerken van een gebruiker te annuleren
  const handleCancelEditUserForm = () => {
    setShowEditUserForm(false);
    setCurrentUser(null);
  };

  // Functie om een gebruiker te bewerken
  const handleUpdateUser = async () => {
    if (!currentUser) return;

    try {
      setIsLoading(true);
      setError(null);

      // Bereid de rollen voor om naar de server te sturen
      const rolesToSend = Array.isArray(currentUser.roles)
        ? currentUser.roles.map(role => typeof role === 'object' ? role.id : role)
        : [];

      console.log('Sending user update with roles:', rolesToSend);

      const response = await fetch(`/api/v1/users/${currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: currentUser.email,
          first_name: currentUser.first_name,
          last_name: currentUser.last_name,
          is_active: currentUser.is_active,
          roles: rolesToSend
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update user');
      }

      // Update de gebruiker in de lijst
      setUsers(prevUsers => prevUsers.map(user => user.id === currentUser.id ? data.data : user));

      // Reset het formulier
      setCurrentUser(null);

      // Sluit het formulier
      setShowEditUserForm(false);
    } catch (error) {
      console.error('Error updating user:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Functie om een checkbox voor een rol te togglen bij het bewerken van een gebruiker
  const handleToggleRole = (roleId: number) => {
    if (!currentUser) return;

    setCurrentUser(prev => {
      if (!prev) return prev;

      const roles = Array.isArray(prev.roles)
        ? prev.roles.map(role => typeof role === 'object' ? role.id : role)
        : [];

      const newRoles = roles.includes(roleId)
        ? roles.filter(id => id !== roleId)
        : [...roles, roleId];

      return { ...prev, roles: newRoles };
    });
  };

  // Functie om een gebruiker te verwijderen
  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete user');
      }

      // Verwijder de gebruiker uit de lijst
      setUsers(users.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Er is een fout opgetreden bij het verwijderen van de gebruiker.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gebruikersbeheer</CardTitle>
            <CardDescription>Beheer gebruikers en hun toegangsrechten</CardDescription>
          </div>
          <Button className="ml-auto" onClick={handleShowNewUserForm}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nieuwe gebruiker
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {showNewUserForm && (
            <div className="mb-6 rounded-md border p-4">
              <h3 className="mb-4 text-lg font-medium">Nieuwe gebruiker aanmaken</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Gebruikersnaam</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Wachtwoord</label>
                  <input
                    type="password"
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Voornaam</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Achternaam</label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-gray-300 p-2"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="mr-2 h-4 w-4 rounded border-gray-300"
                    checked={newUser.isActive}
                    onChange={(e) => setNewUser({...newUser, isActive: e.target.checked})}
                  />
                  <label className="text-sm font-medium">Actief</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="mr-2 h-4 w-4 rounded border-gray-300"
                    checked={newUser.isAdmin}
                    onChange={(e) => setNewUser({...newUser, isAdmin: e.target.checked})}
                  />
                  <label className="text-sm font-medium">Admin</label>
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <Button variant="outline" onClick={handleCancelNewUserForm}>Annuleren</Button>
                <Button onClick={handleCreateUser}>Opslaan</Button>
              </div>
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
                  <TableHead>Gebruikersnaam</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Geen gebruikers gevonden
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.first_name && user.last_name
                          ? `${user.first_name} ${user.last_name}`
                          : <span className="text-gray-500">-</span>}
                      </TableCell>
                      <TableCell>
                        {user.roles && user.roles.length > 0 ? user.roles.map(role => (
                          <Badge key={typeof role === 'string' ? role : role.id} variant="outline" className="mr-1">
                            {typeof role === 'string' ? role : role.name}
                          </Badge>
                        )) : <span className="text-gray-500">-</span>}
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge variant="success" className="flex items-center">
                            <Check className="mr-1 h-3 w-3" />
                            Actief
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex items-center">
                            <X className="mr-1 h-3 w-3" />
                            Inactief
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mr-1"
                          onClick={() => handleSelectUser(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.is_admin} // Admin gebruikers kunnen niet worden verwijderd
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

      {/* Formulier voor het bewerken van een gebruiker */}
      {showEditUserForm && currentUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Gebruiker bewerken</h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Gebruikersnaam</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 p-2"
                  value={currentUser.username}
                  onChange={(e) => setCurrentUser({...currentUser, username: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <input
                  type="email"
                  className="w-full rounded-md border border-gray-300 p-2"
                  value={currentUser.email}
                  onChange={(e) => setCurrentUser({...currentUser, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Voornaam</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 p-2"
                  value={currentUser.first_name || ''}
                  onChange={(e) => setCurrentUser({...currentUser, first_name: e.target.value})}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Achternaam</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 p-2"
                  value={currentUser.last_name || ''}
                  onChange={(e) => setCurrentUser({...currentUser, last_name: e.target.value})}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2 h-4 w-4 rounded border-gray-300"
                  checked={currentUser.is_active}
                  onChange={(e) => setCurrentUser({...currentUser, is_active: e.target.checked})}
                />
                <label className="text-sm font-medium">Actief</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2 h-4 w-4 rounded border-gray-300"
                  checked={currentUser.is_admin}
                  onChange={(e) => setCurrentUser({...currentUser, is_admin: e.target.checked})}
                />
                <label className="text-sm font-medium">Admin</label>
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium">Rollen</label>
              <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                {availableRoles.map(role => {
                  const userRoleIds = Array.isArray(currentUser.roles)
                    ? currentUser.roles.map(r => typeof r === 'object' ? r.id : r)
                    : [];

                  return (
                    <div key={role.id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`role-${role.id}`}
                        className="mr-2 h-4 w-4 rounded border-gray-300"
                        checked={userRoleIds.includes(role.id)}
                        onChange={() => handleToggleRole(role.id)}
                      />
                      <label htmlFor={`role-${role.id}`} className="text-sm">{role.name}</label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCancelEditUserForm}>Annuleren</Button>
              <Button onClick={handleUpdateUser}>Opslaan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
