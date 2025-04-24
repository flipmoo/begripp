import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Search, Save, RotateCcw, X } from 'lucide-react';
import { useProjects } from '../../contexts/ProjectsContext';

interface ProjectFiltersProps {
  className?: string;
}

const ProjectFilters: React.FC<ProjectFiltersProps> = ({ className }) => {
  const {
    // Filters
    searchQuery,
    selectedClient,
    selectedPhase,
    selectedStatus,
    selectedTag,
    sortOrder,
    
    // Filter options
    clients,
    phases,
    tags,
    
    // Actions
    setSearchQuery,
    setSelectedClient,
    setSelectedPhase,
    setSelectedStatus,
    setSelectedTag,
    setSortOrder,
    saveFilters,
    loadSavedFilters,
    clearFilters
  } = useProjects();
  
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Filters</CardTitle>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={saveFilters}
            title="Huidige filters opslaan"
          >
            <Save className="h-4 w-4 mr-1" />
            Opslaan
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSavedFilters}
            title="Opgeslagen filters laden"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Laden
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            title="Alle filters wissen"
          >
            <X className="h-4 w-4 mr-1" />
            Wissen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Zoek op projectnaam"
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger>
              <SelectValue placeholder="Alle klanten" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle klanten</SelectItem>
              {clients.map(client => (
                <SelectItem key={client} value={client}>{client}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger>
              <SelectValue placeholder="Alle fases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle fases</SelectItem>
              {phases.map(phase => (
                <SelectItem key={phase} value={phase}>{phase}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Alle statussen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statussen</SelectItem>
              <SelectItem value="normal" className="text-green-700">Normaal ({'<'} 75%)</SelectItem>
              <SelectItem value="warning" className="text-amber-700">Opletten (75-100%)</SelectItem>
              <SelectItem value="over-budget" className="text-red-700">Over budget ({'>'} 100%)</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger>
              <SelectValue placeholder="Alle tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle tags</SelectItem>
              {tags.map(tag => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger>
              <SelectValue placeholder="Sorteren op deadline (oplopend)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deadline-asc">Deadline (oplopend)</SelectItem>
              <SelectItem value="deadline-desc">Deadline (aflopend)</SelectItem>
              <SelectItem value="name-asc">Naam (A-Z)</SelectItem>
              <SelectItem value="name-desc">Naam (Z-A)</SelectItem>
              <SelectItem value="budget-desc">Budget (hoog-laag)</SelectItem>
              <SelectItem value="budget-asc">Budget (laag-hoog)</SelectItem>
              <SelectItem value="progress-asc">Voortgang (laag-hoog)</SelectItem>
              <SelectItem value="progress-desc">Voortgang (hoog-laag)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectFilters;
