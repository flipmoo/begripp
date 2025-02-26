import React, { useState } from 'react';
import { Layout } from '../../components/common/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Holiday, defaultHolidays } from '../../data/holidays';

export function SettingsPage() {
  const [holidays, setHolidays] = useState<Holiday[]>(defaultHolidays);
  const [newHoliday, setNewHoliday] = useState<Omit<Holiday, 'id'>>({
    date: '',
    name: '',
  });

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (newHoliday.date && newHoliday.name) {
      setHolidays([
        ...holidays,
        {
          id: Date.now().toString(),
          ...newHoliday,
        },
      ]);
      setNewHoliday({ date: '', name: '' });
    }
  };

  const handleDeleteHoliday = (id: string) => {
    setHolidays(holidays.filter(holiday => holiday.id !== id));
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
            <TabsTrigger value="other" disabled>Other Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="holidays" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add New Holiday</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddHoliday} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                        Date
                      </label>
                      <input
                        type="date"
                        id="date"
                        value={newHoliday.date}
                        onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
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
                        value={newHoliday.name}
                        onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">
                      Add Holiday
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Holidays List</CardTitle>
              </CardHeader>
              <CardContent>
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
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((holiday) => (
                          <tr key={holiday.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(holiday.date).toLocaleDateString('en-GB')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {holiday.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteHoliday(holiday.id)}
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
} 