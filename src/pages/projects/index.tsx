import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { RefreshCw, Search } from 'lucide-react';
import { useToast } from '../../components/ui/use-toast';
import ProjectCard from '../../components/dashboard/ProjectCard';
import ProjectDetails from '../../components/dashboard/ProjectDetails';
import { GrippProject } from '../../types/gripp';
import { fetchActiveProjects, fetchProjectDetails, syncProjects, syncProjectById } from '../../api/dashboard/grippApi';
import { dbService } from '../../api/dashboard/dbService';

const ProjectsPage: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<GrippProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<GrippProject | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedPhase, setSelectedPhase] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [sortOrder, setSortOrder] = useState('deadline-asc');

  // Laad projecten functie met useCallback om re-renders te voorkomen
  const loadProjects = useCallback(async (forceRefresh = false) => {
    console.log('Loading projects...', forceRefresh ? '(force refresh)' : '');
    try {
      setLoading(true);
      setError(null);

      if (forceRefresh) {
        console.log('Force refresh: skipping cache and fetching from API directly');
        // Als er geen gecachte projecten zijn, haal ze op van de API
        console.log('Fetching projects from API...');
        const activeProjects = await fetchActiveProjects();
        console.log('Loaded projects from API:', activeProjects.length);
        console.log('First 3 API projects:', activeProjects.slice(0, 3).map(p => ({ id: p.id, name: p.name })));
        
        if (activeProjects && activeProjects.length > 0) {
          setProjects(activeProjects);
          
          // Sla projecten op in IndexedDB
          try {
            console.log('Saving projects to IndexedDB...');
            await dbService.saveProjects(activeProjects);
            console.log('Projects saved to IndexedDB successfully');
          } catch (dbError) {
            console.error('Error saving projects to IndexedDB:', dbError);
          }
        } else {
          setError('Geen projecten gevonden');
          console.log('No projects returned from API');
        }
        setLoading(false);
        return;
      }

      // Probeer eerst projecten uit de IndexedDB te laden
      try {
        const cachedProjects = await dbService.getAllProjects();
        if (cachedProjects && cachedProjects.length > 0) {
          console.log('Loaded projects from cache:', cachedProjects.length);
          console.log('First 3 cached projects:', cachedProjects.slice(0, 3).map(p => ({ id: p.id, name: p.name })));
          setProjects(cachedProjects);
          setLoading(false);
          return;
        } else {
          console.log('No projects found in cache or empty array returned');
        }
      } catch (dbError) {
        console.error('Error loading projects from IndexedDB:', dbError);
      }

      // Als er geen gecachte projecten zijn, haal ze op van de API
      console.log('Fetching projects from API...');
      const activeProjects = await fetchActiveProjects();
      console.log('Loaded projects from API:', activeProjects.length);
      console.log('First 3 API projects:', activeProjects.slice(0, 3).map(p => ({ id: p.id, name: p.name })));
      
      if (activeProjects && activeProjects.length > 0) {
        setProjects(activeProjects);
        
        // Sla projecten op in IndexedDB
        try {
          console.log('Saving projects to IndexedDB...');
          await dbService.saveProjects(activeProjects);
          console.log('Projects saved to IndexedDB successfully');
        } catch (dbError) {
          console.error('Error saving projects to IndexedDB:', dbError);
        }
      } else {
        setError('Geen projecten gevonden');
        console.log('No projects returned from API');
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Er is een fout opgetreden bij het laden van de projecten');
    } finally {
      setLoading(false);
    }
  }, []);

  // Laad projecten bij het laden van de pagina
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Synchroniseer projecten met de Gripp API
  const handleSync = useCallback(async () => {
    try {
      setSyncing(true);
      toast({
        title: "Synchronisatie gestart",
        description: "Projecten data wordt gesynchroniseerd...",
      });
      
      await syncProjects();
      
      // Laad de bijgewerkte projecten
      await loadProjects();
      
      toast({
        title: "Synchronisatie voltooid",
        description: "Projecten data is bijgewerkt.",
        variant: "default",
      });
    } catch (err) {
      console.error('Error syncing projects:', err);
      toast({
        title: "Synchronisatie mislukt",
        description: "Er is een fout opgetreden bij het synchroniseren van de projecten.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [loadProjects, toast]);

  // Navigeer naar project details
  const handleProjectClick = useCallback(async (id: number) => {
    try {
      setLoadingDetails(true);
      setError(null);
      
      // Zoek eerst in de lokale projecten
      const localProject = projects.find(p => p.id === id);
      if (localProject) {
        setSelectedProject(localProject);
        setLoadingDetails(false);
        return;
      }
      
      // Als het project niet lokaal gevonden wordt, haal het op van de API
      const projectDetails = await fetchProjectDetails(id);
      if (projectDetails) {
        setSelectedProject(projectDetails);
      } else {
        setError('Project details konden niet worden geladen');
      }
    } catch (err) {
      console.error('Error loading project details:', err);
      setError('Er is een fout opgetreden bij het laden van de project details');
    } finally {
      setLoadingDetails(false);
    }
  }, [projects]);

  // Sluit project details
  const handleCloseDetails = useCallback(() => {
    setSelectedProject(null);
  }, []);

  // Filter opties
  const clients = useMemo(() => {
    const uniqueClients = new Set(projects.map(p => p.company?.searchname || '').filter(Boolean));
    return Array.from(uniqueClients).sort();
  }, [projects]);

  const phases = useMemo(() => {
    const uniquePhases = new Set(projects.map(p => p.phase?.searchname || '').filter(Boolean));
    return Array.from(uniquePhases).sort();
  }, [projects]);

  // Extraheer unieke tags uit alle projecten
  const tags = useMemo(() => {
    // Verzamel alle tags van alle projecten
    const allTags: string[] = [];
    
    projects.forEach(project => {
      // Als tags een string is (JSON formaat), probeer te parsen
      if (typeof project.tags === 'string') {
        try {
          const parsedTags = JSON.parse(project.tags);
          parsedTags.forEach((tag: { searchname?: string; name?: string }) => {
            const tagName = tag.searchname || tag.name;
            if (tagName) allTags.push(tagName);
          });
        } catch (error) {
          console.error('Error parsing tags JSON:', error);
        }
      } 
      // Als tags een array is, gebruik direct
      else if (Array.isArray(project.tags)) {
        project.tags.forEach(tag => {
          const tagName = typeof tag === 'object' ? (tag.searchname || tag.name) : tag;
          if (tagName) allTags.push(tagName);
        });
      }
    });
    
    // Filter unieke tags
    const uniqueTags = new Set(allTags);
    return Array.from(uniqueTags).sort();
  }, [projects]);

  // Sorteer en filter projecten
  const filteredProjects = useMemo(() => {
    return projects
      .filter(project => {
        // Filter op zoekterm
        if (searchQuery && !project.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        
        // Filter op client
        if (selectedClient && selectedClient !== 'all' && project.company?.searchname !== selectedClient) {
          return false;
        }
        
        // Filter op fase
        if (selectedPhase && selectedPhase !== 'all' && project.phase?.searchname !== selectedPhase) {
          return false;
        }
        
        // Filter op tag
        if (selectedTag && selectedTag !== 'all') {
          // Check voor tags
          let hasTag = false;
          
          // Als tags een string is (JSON formaat), probeer te parsen
          if (typeof project.tags === 'string') {
            try {
              const parsedTags = JSON.parse(project.tags);
              hasTag = parsedTags.some((tag: { searchname?: string; name?: string }) => 
                (tag.searchname === selectedTag) || (tag.name === selectedTag)
              );
            } catch (error) {
              console.error('Error parsing tags JSON:', error);
            }
          } 
          // Als tags een array is, gebruik direct
          else if (Array.isArray(project.tags)) {
            hasTag = project.tags.some(tag => {
              if (typeof tag === 'string') return tag === selectedTag;
              return (tag.searchname === selectedTag) || (tag.name === selectedTag);
            });
          }
          
          if (!hasTag) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // Sorteer op deadline (oplopend)
        if (sortOrder === 'deadline-asc') {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline.date).getTime() - new Date(b.deadline.date).getTime();
        }
        
        // Sorteer op deadline (aflopend)
        if (sortOrder === 'deadline-desc') {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(b.deadline.date).getTime() - new Date(a.deadline.date).getTime();
        }
        
        // Sorteer op naam (A-Z)
        if (sortOrder === 'name-asc') {
          return (a.name || '').localeCompare(b.name || '');
        }
        
        // Sorteer op naam (Z-A)
        if (sortOrder === 'name-desc') {
          return (b.name || '').localeCompare(a.name || '');
        }
        
        // Sorteer op budget (hoog-laag)
        if (sortOrder === 'budget-desc') {
          return parseFloat(b.totalexclvat || '0') - parseFloat(a.totalexclvat || '0');
        }
        
        // Sorteer op budget (laag-hoog)
        if (sortOrder === 'budget-asc') {
          return parseFloat(a.totalexclvat || '0') - parseFloat(b.totalexclvat || '0');
        }
        
        return 0;
      });
  }, [projects, searchQuery, selectedClient, selectedPhase, sortOrder, selectedTag]);

  // Functie om een specifiek project te vernieuwen
  const refreshSelectedProject = useCallback(async () => {
    if (!selectedProject) return;
    
    try {
      setLoadingDetails(true);
      const refreshedProject = await syncProjectById(selectedProject.id);
      
      if (refreshedProject) {
        // Update het project in de state
        setSelectedProject(refreshedProject);
        
        // Update het project in de lijst met projecten
        setProjects(prev => 
          prev.map(p => p.id === refreshedProject.id ? refreshedProject : p)
        );
        
        // Update het project in de cache
        try {
          await dbService.saveProject(refreshedProject);
          console.log('Project cached successfully:', refreshedProject.id);
        } catch (error) {
          console.error('Error caching project:', error);
        }
        
        toast({
          title: 'Project bijgewerkt',
          description: 'Project is succesvol bijgewerkt met de laatste gegevens',
        });
      } else {
        toast({
          title: 'Fout bij bijwerken',
          description: 'Er is een fout opgetreden bij het bijwerken van het project',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error refreshing project:', error);
      toast({
        title: 'Fout bij bijwerken',
        description: 'Er is een fout opgetreden bij het bijwerken van het project',
        variant: 'destructive',
      });
    } finally {
      setLoadingDetails(false);
    }
  }, [selectedProject, toast]);

  // Als er een project is geselecteerd, toon de details
  if (selectedProject) {
    return (
      <ProjectDetails 
        project={selectedProject} 
        onClose={handleCloseDetails} 
        onRefresh={refreshSelectedProject}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Projecten</h1>
        <div className="flex gap-2">
          <Button 
            onClick={async () => {
              try {
                console.log('Clearing IndexedDB cache and database...');
                await dbService.clearCache();
                await dbService.clearDatabase();
                console.log('Cache and database cleared successfully');
                toast({
                  title: "Cache geleegd",
                  description: "De cache is succesvol geleegd. Projecten worden opnieuw geladen.",
                });
                loadProjects(true);
              } catch (err) {
                console.error('Error clearing cache:', err);
                toast({
                  title: "Fout bij leegmaken cache",
                  description: "Er is een fout opgetreden bij het leegmaken van de cache.",
                  variant: "destructive",
                });
              }
            }} 
            variant="outline"
            className="flex items-center gap-2"
          >
            Cache leegmaken
          </Button>
          <Button 
            onClick={() => loadProjects(true)} 
            variant="outline"
            className="flex items-center gap-2"
          >
            Direct van API laden
          </Button>
          <Button 
            onClick={handleSync} 
            className="flex items-center gap-2"
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchroniseren...' : 'Synchroniseren'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projecten grid */}
      {!loading && !loadingDetails && !error && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
            <div className="text-gray-500">
              {filteredProjects.length} projecten gevonden
            </div>
            
            {filteredProjects.length > 0 && (
              <>
                <div className="bg-gray-200 h-4 w-px mx-1"></div>
                {(() => {
                  let totalBudget = 0;
                  let totalWrittenHours = 0;
                  let totalBudgetedHours = 0;
                  
                  filteredProjects.forEach(project => {
                    const budget = parseFloat(project.totalexclvat || '0');
                    totalBudget += budget;
                    
                    if (project.projectlines && Array.isArray(project.projectlines)) {
                      const writtenHours = project.projectlines.reduce((sum, line) => 
                        sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
                      totalWrittenHours += writtenHours;
                      
                      const budgetedHours = project.projectlines.reduce((sum, line) => 
                        sum + (line && line.amount ? line.amount : 0), 0);
                      totalBudgetedHours += budgetedHours;
                    }
                  });
                  
                  const averageRealizedRate = totalWrittenHours > 0 ? totalBudget / totalWrittenHours : 0;
                  const averageStartRate = totalBudgetedHours > 0 ? totalBudget / totalBudgetedHours : 0;
                  
                  return (
                    <>
                      <span className="text-gray-500">Budget: <span className="font-medium">€{totalBudget.toLocaleString('nl-NL', {maximumFractionDigits: 0})}</span></span>
                      <span className="text-gray-500">Uren: <span className="font-medium">{Math.round(totalWrittenHours)}</span></span>
                      <span className="text-gray-500">Start uurtarief: <span className="font-medium">€{averageStartRate.toFixed(2)}</span></span>
                      <span className="text-gray-500">Gerealiseerd: <span className="font-medium">€{averageRealizedRate.toFixed(2)}</span></span>
                    </>
                  );
                })()}
              </>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onClick={handleProjectClick} 
              />
            ))}
            
            {filteredProjects.length === 0 && (
              <div className="col-span-full text-center py-10 text-gray-500">
                Geen projecten gevonden met de huidige filters
              </div>
            )}
          </div>
        </>
      )}

      {/* Foutmelding */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Laad indicator */}
      {loading || loadingDetails ? (
        <div className="text-center py-10">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-2 text-gray-500">
            {loadingDetails ? 'Project details laden...' : 'Projecten laden...'}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default ProjectsPage; 