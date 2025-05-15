import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Search, RotateCcw, X, Filter, Calendar } from 'lucide-react';
import { useUnifiedInvoices } from '../../contexts/UnifiedInvoicesContext';

interface UnifiedInvoiceFiltersProps {
  className?: string;
}

const UnifiedInvoiceFilters: React.FC<UnifiedInvoiceFiltersProps> = ({ className }) => {
  const {
    // Filters
    year,
    status,
    searchQuery,

    // Actions
    setYear,
    setStatus,
    setSearchQuery,
    resetFilters
  } = useUnifiedInvoices();

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Filters</CardTitle>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            title="Alle filters wissen"
          >
            <X className="h-4 w-4 mr-1" />
            Wissen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Zoek op nummer of klant"
              className="pl-8"
              value={searchQuery}
              onChange={(e) => {
                console.log('Search query changed:', e.target.value);
                setSearchQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  console.log('Search query submitted:', searchQuery);
                  // Trigger search on Enter key
                  e.preventDefault();
                }
              }}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select
              value={status}
              onValueChange={(value) => {
                console.log(`Status filter changed to: ${value}`);
                setStatus(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="paid">Betaald</SelectItem>
                <SelectItem value="unpaid">Openstaand</SelectItem>
                <SelectItem value="overdue">Verlopen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Select
              value={year}
              onValueChange={(value) => {
                console.log(`Year filter changed to: ${value}`);
                setYear(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Jaar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle jaren</SelectItem>
                <SelectItem value="2022">2022</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UnifiedInvoiceFilters;
