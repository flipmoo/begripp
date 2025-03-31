import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { RefreshCw, Search, Loader2, AlertCircle, CheckCircle, Save, RotateCcw, X } from 'lucide-react';
import { useToast } from '../../components/ui/use-toast';
import ProjectCard from '../../components/dashboard/ProjectCard';
import ProjectDetails from '../../components/dashboard/ProjectDetails';
import { GrippProject } from '../../types/gripp';
import { fetchActiveProjects, fetchProjectDetails, syncProjects, syncProjectById } from '../../api/dashboard/grippApi';
import { dbService } from '../../api/dashboard/dbService';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';

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
  
  // Filter opslaan/laden functionaliteit
  const saveFilters = useCallback(() => {
    const filterSettings = {
      searchQuery,
      selectedClient,
      selectedPhase,
      selectedStatus,
      selectedTag,
      sortOrder
    };
    
    try {
      localStorage.setItem('projectFilterSettings', JSON.stringify(filterSettings));
      toast({
        title: "Filters opgeslagen",
        description: "Je filterinstellingen zijn opgeslagen en kunnen later worden geladen.",
      });
    } catch (error) {
      console.error('Error saving filter settings:', error);
      toast({
        title: "Fout bij opslaan",
        description: "Er is een fout opgetreden bij het opslaan van de filterinstellingen.",
        variant: "destructive",
      });
    }
  }, [searchQuery, selectedClient, selectedPhase, selectedStatus, selectedTag, sortOrder, toast]);
  
  const loadSavedFilters = useCallback(() => {
    try {
      const savedSettings = localStorage.getItem('projectFilterSettings');
      if (!savedSettings) {
        toast({
          title: "Geen opgeslagen filters",
          description: "Er zijn geen eerder opgeslagen filterinstellingen gevonden.",
          variant: "destructive",
        });
        return;
      }
      
      const settings = JSON.parse(savedSettings);
      setSearchQuery(settings.searchQuery || '');
      setSelectedClient(settings.selectedClient || 'all');
      setSelectedPhase(settings.selectedPhase || 'all');
      setSelectedStatus(settings.selectedStatus || 'all');
      setSelectedTag(settings.selectedTag || 'all');
      setSortOrder(settings.sortOrder || 'deadline-asc');
      
      toast({
        title: "Filters geladen",
        description: "Je opgeslagen filterinstellingen zijn toegepast.",
      });
    } catch (error) {
      console.error('Error loading filter settings:', error);
      toast({
        title: "Fout bij laden",
        description: "Er is een fout opgetreden bij het laden van de filterinstellingen.",
        variant: "destructive",
      });
    }
  }, [toast]);
  
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedClient('all');
    setSelectedPhase('all');
    setSelectedStatus('all');
    setSelectedTag('all');
    setSortOrder('deadline-asc');
    
    toast({
      title: "Filters gewist",
      description: "Alle filterinstellingen zijn teruggezet naar de standaardwaarden.",
    });
  }, [toast]);
  
  // Check for saved filters on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('projectFilterSettings');
      if (savedSettings) {
        // Toon een notificatie dat er opgeslagen filters zijn
        toast({
          title: "Opgeslagen filters beschikbaar",
          description: "Je hebt eerder opgeslagen filterinstellingen die je kunt laden.",
        });
      }
    } catch (error) {
      console.error('Error checking for saved filters:', error);
    }
  }, [toast]);

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
          // Gebruik de projecten direct zoals ze uit de database komen
          setProjects(localProjects);
          setLoadingState('complete');
          setLoadingMessage(`${localProjects.length} projecten geladen uit lokale cache`);
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
      
      // Gebruik de projecten direct zoals ze van de API komen
      setProjects(activeProjects);
      setLoadingState('complete');
      setLoadingMessage(`${activeProjects.length} projecten geladen vanaf API`);
      
      // Update IndexedDB cache
      try {
        await dbService.saveProjects(activeProjects);
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
        
        // Update state direct met de nieuwe projecten
        setProjects(refreshedProjects);
        setLoadingState('complete');
        setLoadingMessage(`${refreshedProjects.length} projecten succesvol gesynchroniseerd.`);
        
        // Werk ook IndexedDB bij voor toekomstige laadcycli
        try {
          console.log('Saving projects to IndexedDB cache');
          await dbService.saveProjects(refreshedProjects);
          console.log('Projects saved to IndexedDB cache');
        } catch (dbError) {
          console.error('Error saving projects to IndexedDB:', dbError);
        }
        
        toast({
          title: "Synchronisatie voltooid",
          description: `${refreshedProjects.length} projecten zijn succesvol bijgewerkt.`,
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
    console.log('Filter/sort running on projects:', projects.length);
    if (projects.length === 0) {
      console.log('No projects to filter/sort');
      return [];
    }
    
    // Log eerste paar projecten om te zien wat we hebben
    console.log('First few projects:', projects.slice(0, 3).map(p => ({ id: p.id, name: p.name })));
    
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
  
  console.log('Filtered projects count:', filteredProjects.length);

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
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projecten</h1>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                setLoadingState('loading');
                setLoadingMessage('Cache wordt leeggemaakt...');
                
                // De cache leegmaken
                await dbService.clearCache();
                console.log('Cache cleared');
                
                // De projecten uit IndexedDB verwijderen
                await dbService.clearProjects();
                console.log('Projects cleared from IndexedDB');
                
                // Projecten direct van de API laden
                await loadProjects(true);
                
                toast({
                  title: "Cache geleegd",
                  description: "De cache is succesvol geleegd en projecten zijn opnieuw geladen.",
                });
              } catch (error) {
                console.error('Error clearing cache:', error);
                setLoadingState('error');
                setLoadingMessage('Er is een fout opgetreden bij het leegmaken van de cache');
                
                toast({
                  title: "Fout",
                  description: "Er is een fout opgetreden bij het leegmaken van de cache.",
                  variant: "destructive",
                });
              }
            }}
          >
            Cache leegmaken
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => loadProjects(true)}
          >
            Direct van API laden
          </Button>
          
          <Button 
            disabled={syncing}
            onClick={handleSync}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            Synchroniseren
          </Button>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Fout</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {renderLoadingState()}
      
      {!error && loadingState !== 'loading' && loadingState !== 'syncing' && (
        <>
          <Card>
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
          
          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-4">
              {filteredProjects.length} projecten gevonden
            </p>
            
            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => handleProjectClick(project.id)}
                    progress={calculateProjectProgress(project)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center p-8 border rounded-md">
                <p className="text-muted-foreground">Geen projecten gevonden die voldoen aan de geselecteerde filters.</p>
              </div>
            )}
          </div>
        </>
      )}
      
      {selectedProject && (
        <Dialog open={!!selectedProject} onOpenChange={() => handleCloseDetails()}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-start justify-between">
                <span>{selectedProject.name}</span>
                {calculateProjectProgress(selectedProject) > 0 && (
                  <Badge 
                    className={
                      calculateProjectProgress(selectedProject) > 100 
                        ? 'bg-red-500' 
                        : calculateProjectProgress(selectedProject) > 75 
                          ? 'bg-amber-500' 
                          : 'bg-green-500'
                    }
                  >
                    {Math.round(calculateProjectProgress(selectedProject))}%
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {selectedProject.company?.searchname}
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ProjectsPage; 