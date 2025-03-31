import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { RefreshCw, Search, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '../../components/ui/use-toast';
import ProjectCard from '../../components/dashboard/ProjectCard';
import ProjectDetails from '../../components/dashboard/ProjectDetails';
import { GrippProject } from '../../types/gripp';
import { fetchActiveProjects, fetchProjectDetails, syncProjects, syncProjectById } from '../../api/dashboard/grippApi';
import { dbService } from '../../api/dashboard/dbService';
import { Checkbox } from '../../components/ui/checkbox';

const ProjectsPage: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<GrippProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<GrippProject | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Loading state tracking
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'syncing' | 'complete' | 'error'>('idle');
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedPhase, setSelectedPhase] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [sortOrder, setSortOrder] = useState('deadline-asc');

  // Laad projecten functie met useCallback om re-renders te voorkomen
  const loadProjects = useCallback(async (forceRefresh = false) => {
    setLoadingState('loading');
    setLoadingMessage('Projecten worden geladen...');
    setError(null);
    
    // Probeer eerst projecten uit IndexedDB te laden, tenzij forceren van refresh
    if (!forceRefresh) {
      try {
        console.log('Attempting to load projects from IndexedDB...');
        const localProjects = await dbService.getAllProjects();
        
        if (localProjects && localProjects.length > 0) {
          console.log(`Loaded ${localProjects.length} projects from IndexedDB`);
          // Filter template projects out immediately
          const filteredProjects = localProjects.filter(project => 
            !(project.name?.startsWith('#0') || 
              project.name?.startsWith('#1') || 
              project.name?.includes('Service Hours') || 
              project.name?.includes('New Business') || 
              project.name?.includes('Gripp Intern'))
          );
          console.log(`Filtered down to ${filteredProjects.length} projects (excluding templates)`);
          setProjects(filteredProjects);
          setLoadingState('complete');
          setLoadingMessage(`${filteredProjects.length} projecten geladen uit lokale cache`);
        } else {
          console.log('No projects in IndexedDB or empty response, fetching from API');
          throw new Error('No projects in local database');
        }
      } catch (apiError) {
        console.error('Error calling API:', apiError);
        const errorMessage = apiError instanceof Error ? apiError.message : 'Onbekende fout';
        setError('API fout: ' + errorMessage);
        setLoadingState('error');
        setLoadingMessage('Er is een fout opgetreden bij het API verzoek. Probeer het later opnieuw.');
      }
      
      return;
    }
    
    // Als we hier zijn, laden we projecten direct van de API (forceRefresh=true)
    try {
      console.log('API call to: /dashboard/projects/active');
      setLoadingMessage('Projecten worden geladen vanaf API...');
      
      const activeProjects = await fetchActiveProjects();
      console.log(`Loaded ${activeProjects.length} projects from API`);
      
      // Filter template projects out immediately
      const filteredProjects = activeProjects.filter(project => 
        !(project.name?.startsWith('#0') || 
          project.name?.startsWith('#1') || 
          project.name?.includes('Service Hours') || 
          project.name?.includes('New Business') || 
          project.name?.includes('Gripp Intern'))
      );
      console.log(`Filtered down to ${filteredProjects.length} projects (excluding templates)`);
      
      setProjects(filteredProjects);
      setLoadingState('complete');
      setLoadingMessage(`${filteredProjects.length} projecten geladen vanaf API`);
      
      // Update IndexedDB cache
      try {
        await dbService.saveProjects(filteredProjects);
        console.log('Projects saved to IndexedDB cache');
      } catch (dbError) {
        console.error('Error saving projects to IndexedDB:', dbError);
      }
    } catch (error) {
      console.error('Error fetching active projects:', error);
      setLoadingState('error');
      setLoadingMessage('Er is een fout opgetreden bij het laden van de projecten. Probeer het later opnieuw.');
      setError('Fout bij laden van projecten');
    }
  }, []);

  // Effect to load projects on component mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Synchroniseer projecten met de Gripp API
  const handleSync = useCallback(async () => {
    if (syncing) return;
    
    try {
      setSyncing(true);
      setLoadingState('syncing');
      setLoadingMessage('Projecten worden gesynchroniseerd met Gripp...');
      
      toast({
        title: "Synchronisatie gestart",
        description: "Projecten worden gesynchroniseerd met Gripp...",
      });
      
      // Eerst Gripp projecten synchroniseren
      await syncProjects();
      
      toast({
        title: "Data gesynchroniseerd",
        description: "Projecten zijn gesynchroniseerd met Gripp, gegevens worden opgehaald...",
      });
      
      // Wacht een seconde om zeker te weten dat de database is bijgewerkt
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // IndexedDB cache leegmaken
      setLoadingMessage("Cache wordt leeggemaakt...");
      await dbService.clearProjects();
      
      toast({
        title: "Data ophalen",
        description: "Bijgewerkte project gegevens worden opgehaald...",
      });
      
      console.log('Forcing projects refresh');
      
      // Forceer een directe refresh van de API
      const timestamp = new Date().getTime();
      const refreshedProjects = await fetchActiveProjects(`?refresh=true&_t=${timestamp}`);
      
      if (refreshedProjects && refreshedProjects.length > 0) {
        console.log(`Successfully loaded ${refreshedProjects.length} projects after sync`);
        
        // Filter template projects out immediately
        const filteredProjects = refreshedProjects.filter(project => 
          !(project.name?.startsWith('#0') || 
            project.name?.startsWith('#1') || 
            project.name?.includes('Service Hours') || 
            project.name?.includes('New Business') || 
            project.name?.includes('Gripp Intern'))
        );
        console.log(`Filtered down to ${filteredProjects.length} projects (excluding templates)`);
        
        // Update state direct met de nieuwe projecten
        setProjects(filteredProjects);
        setLoadingState('complete');
        setLoadingMessage(`${filteredProjects.length} projecten succesvol gesynchroniseerd.`);
        
        // Werk ook IndexedDB bij voor toekomstige laadcycli
        try {
          console.log('Saving projects to IndexedDB cache');
          await dbService.saveProjects(filteredProjects);
          console.log('Projects saved to IndexedDB cache');
        } catch (dbError) {
          console.error('Error saving projects to IndexedDB:', dbError);
        }
        
        toast({
          title: "Synchronisatie voltooid",
          description: `${filteredProjects.length} projecten zijn succesvol bijgewerkt.`,
          variant: "default",
        });
      } else {
        console.error('No projects returned after sync or empty array');
        setLoadingState('error');
        setLoadingMessage('Geen projecten gevonden na synchronisatie. Probeer het later opnieuw.');
        
        toast({
          title: "Waarschuwing",
          description: "Geen projecten gevonden na synchronisatie.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error syncing projects:', err);
      setLoadingState('error');
      setLoadingMessage('Synchronisatie mislukt. Probeer het later opnieuw.');
      
      toast({
        title: "Synchronisatie mislukt",
        description: "Er is een fout opgetreden bij het synchroniseren van de projecten.",
        variant: "destructive",
      });
      
      // Probeer toch de projecten te laden (niet geforceerd) om te zorgen
      // dat de gebruiker niet met een lege UI zit
      try {
        await loadProjects(false);
      } catch (loadError) {
        console.error('Error loading projects after sync failure:', loadError);
      }
    } finally {
      setSyncing(false);
    }
  }, [toast, loadProjects]);

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

  // Functie om de voortgang van een project te berekenen
  const calculateProjectProgress = useCallback((project: GrippProject) => {
    if (!project.projectlines || !Array.isArray(project.projectlines)) return 0;
    
    try {
      const written = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
      const budgeted = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amount ? line.amount : 0), 0);
      return budgeted > 0 ? (written / budgeted) * 100 : 0;
    } catch (error) {
      console.error('Error calculating project progress:', error);
      return 0;
    }
  }, []);

  // Functie om de status van een project te bepalen op basis van voortgang
  const getProjectStatus = useCallback((project: GrippProject) => {
    const progress = calculateProjectProgress(project);
    
    if (progress > 100) return 'over-budget';
    if (progress >= 75) return 'warning';
    return 'normal';
  }, [calculateProjectProgress]);

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
        
        // Filter op status (voortgang)
        if (selectedStatus && selectedStatus !== 'all') {
          const status = getProjectStatus(project);
          if (status !== selectedStatus) {
            return false;
          }
        }
        
        // Filter op tag
        if (selectedTag && selectedTag !== 'all') {
          // Check if the project has the selected tag
          const projectTags = project.tags || [];
          let hasTag = false;
          
          // If tags is a string, parse it first
          if (typeof projectTags === 'string') {
            try {
              const parsedTags = JSON.parse(projectTags);
              hasTag = parsedTags.some((tag: any) => 
                (tag.searchname === selectedTag) || (tag.name === selectedTag)
              );
            } catch (error) {
              console.error('Error parsing tags:', error);
              hasTag = false;
            }
          } 
          // If tags is an array, check directly
          else if (Array.isArray(projectTags)) {
            hasTag = projectTags.some((tag: any) => {
              if (typeof tag === 'string') return tag === selectedTag;
              return (tag.searchname === selectedTag) || (tag.name === selectedTag);
            });
          }
          
          if (!hasTag) {
            return false;
          }
        }
        
        return true;
      })
      .sort((a, b) => {
        switch (sortOrder) {
          case 'deadline-asc':
            // Als deadline null is, zet het achteraan
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline.date).getTime() - new Date(b.deadline.date).getTime();
          case 'deadline-desc':
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(b.deadline.date).getTime() - new Date(a.deadline.date).getTime();
          case 'name-asc':
            return (a.name || '').localeCompare(b.name || '');
          case 'name-desc':
            return (b.name || '').localeCompare(a.name || '');
          case 'budget-asc': {
            const aBudget = a.projectlines?.reduce((sum, line) => 
              sum + (line?.amount || 0), 0) || 0;
            const bBudget = b.projectlines?.reduce((sum, line) => 
              sum + (line?.amount || 0), 0) || 0;
            return aBudget - bBudget;
          }
          case 'budget-desc': {
            const aBudget = a.projectlines?.reduce((sum, line) => 
              sum + (line?.amount || 0), 0) || 0;
            const bBudget = b.projectlines?.reduce((sum, line) => 
              sum + (line?.amount || 0), 0) || 0;
            return bBudget - aBudget;
          }
          case 'progress-asc': {
            const aProgress = calculateProjectProgress(a);
            const bProgress = calculateProjectProgress(b);
            return aProgress - bProgress;
          }
          case 'progress-desc': {
            const aProgress = calculateProjectProgress(a);
            const bProgress = calculateProjectProgress(b);
            return bProgress - aProgress;
          }
          default:
            return 0;
        }
      });
  }, [projects, searchQuery, selectedClient, selectedPhase, selectedStatus, selectedTag, sortOrder, calculateProjectProgress, getProjectStatus]);

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

  // Renders loading spinner with appropriate message based on the current loading state
  const renderLoadingState = () => {
    if (loadingState === 'idle') return null;
    
    return (
      <div className="w-full flex items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-4">
          {(loadingState === 'loading' || loadingState === 'syncing') && (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          )}
          {loadingState === 'error' && (
            <AlertCircle className="h-8 w-8 text-destructive" />
          )}
          {loadingState === 'complete' && (
            <CheckCircle className="h-8 w-8 text-success" />
          )}
          <p className="text-center text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    );
  };

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
      
      {/* Loading/Error state */}
      {(loading || error) && renderLoadingState()}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
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
                  let normalCount = 0;
                  let warningCount = 0;
                  let overBudgetCount = 0;
                  
                  filteredProjects.forEach(project => {
                    const budget = parseFloat(project.totalexclvat || '0');
                    totalBudget += budget;
                    
                    // Bereken status voor statistieken
                    const status = getProjectStatus(project);
                    if (status === 'normal') normalCount++;
                    else if (status === 'warning') warningCount++;
                    else if (status === 'over-budget') overBudgetCount++;
                    
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
                      
                      <div className="bg-gray-200 h-4 w-px mx-1"></div>
                      
                      <span className="text-green-700 font-medium">{normalCount} normaal</span>
                      <span className="text-amber-700 font-medium">{warningCount} opletten</span>
                      <span className="text-red-700 font-medium">{overBudgetCount} over budget</span>
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
    </div>
  );
};

export default ProjectsPage; 