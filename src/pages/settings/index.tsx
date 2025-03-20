import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/common/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { AbsenceSyncButton } from '../../components/AbsenceSyncButton';
import type { Holiday } from '../../data/holidays';

// Use the same API base URL as in employee.service.ts
const API_BASE = 'http://localhost:3002/api';

export function SettingsPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [newHoliday, setNewHoliday] = useState<Omit<Holiday, 'id'>>({
    date: '',
    name: '',
  });

  const fetchHolidays = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/holidays`);
      if (!response.ok) {
        throw new Error('Failed to fetch holidays');
      }
      const data = await response.json();
      setHolidays(data.map((holiday: { date: string; name: string }) => ({
        id: holiday.date, // Use date as ID since it's unique
        date: holiday.date,
        name: holiday.name,
      })));
    } catch (error) {
      console.error('Error fetching holidays:', error);
      setError('Failed to load holidays');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newHoliday.date && newHoliday.name) {
      try {
        const response = await fetch(`${API_BASE}/holidays`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newHoliday),
        });

        if (!response.ok) {
          throw new Error('Failed to add holiday');
        }

        // Refresh holidays list
        await fetchHolidays();
        
        // Clear form
        setNewHoliday({ date: '', name: '' });
      } catch (error) {
        console.error('Error adding holiday:', error);
        setError('Failed to add holiday');
      }
    }
  };

  const handleUpdateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHoliday && editingHoliday.date && editingHoliday.name) {
      try {
        // Delete old holiday
        await fetch(`${API_BASE}/holidays/${editingHoliday.id}`, {
          method: 'DELETE',
        });

        // Add updated holiday
        const response = await fetch(`${API_BASE}/holidays`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: editingHoliday.date,
            name: editingHoliday.name,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update holiday');
        }

        // Refresh holidays list
        await fetchHolidays();
        
        // Clear editing state
        setEditingHoliday(null);
      } catch (error) {
        console.error('Error updating holiday:', error);
        setError('Failed to update holiday');
      }
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      // Find the holiday to get its date
      const holiday = holidays.find(h => h.id === id);
      if (!holiday) return;

      // Call the API to delete the holiday
      const response = await fetch(`${API_BASE}/holidays/${holiday.date}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete holiday');
      }

      // Refresh holidays list
      await fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      setError('Failed to delete holiday');
    }
  };

  const handleEditClick = (holiday: Holiday) => {
    setEditingHoliday(holiday);
  };

  const handleCancelEdit = () => {
    setEditingHoliday(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        </div>

        <Tabs defaultValue="holidays" className="w-full">
          <TabsList>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
            <TabsTrigger value="absence">Absence Data</TabsTrigger>
            <TabsTrigger value="other" disabled>Other Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="holidays" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={editingHoliday ? handleUpdateHoliday : handleAddHoliday} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                        Date
                      </label>
                      <input
                        type="date"
                        id="date"
                        value={editingHoliday ? editingHoliday.date : newHoliday.date}
                        onChange={(e) => editingHoliday 
                          ? setEditingHoliday({ ...editingHoliday, date: e.target.value })
                          : setNewHoliday({ ...newHoliday, date: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Holiday Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={editingHoliday ? editingHoliday.name : newHoliday.name}
                        onChange={(e) => editingHoliday
                          ? setEditingHoliday({ ...editingHoliday, name: e.target.value })
                          : setNewHoliday({ ...newHoliday, name: e.target.value })
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    {editingHoliday && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    )}
                    <Button type="submit">
                      {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Holidays List (Sorted by Date)</CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                  </div>
                )}
                
                {isLoading ? (
                  <div className="text-center py-4">Loading holidays...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Holiday Name
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {holidays
                          .sort((a, b) => {
                            const dateA = new Date(a.date);
                            const dateB = new Date(b.date);
                            return dateA.getTime() - dateB.getTime();
                          })
                          .map((holiday) => (
                            <tr key={holiday.id} className={editingHoliday?.id === holiday.id ? 'bg-blue-50' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(holiday.date).toLocaleDateString('nl-NL')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {holiday.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditClick(holiday)}
                                  disabled={!!editingHoliday}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteHoliday(holiday.id)}
                                  disabled={!!editingHoliday}
                                >
                                  Delete
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="absence" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sync Absence Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Use this tool to import absence, leave, sickness, and holiday data for active employees.
                  Select a date range and click the sync button to fetch and store the data.
                </p>
                <AbsenceSyncButton />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
} 