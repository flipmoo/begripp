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
  
  // Loading state tracking
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'syncing' | 'complete' | 'error'>('idle');
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedPhase, setSelectedPhase] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortOrder, setSortOrder] = useState('deadline-asc');

  // Laad projecten functie met useCallback om re-renders te voorkomen
  const loadProjects = useCallback(async (forceRefresh = false) => {
    console.log('Loading projects...', forceRefresh ? '(force refresh)' : '');
    try {
      setLoading(true);
      setError(null);
      
      if (forceRefresh) {
        setLoadingState('loading');
        setLoadingMessage('Projecten worden direct van de API geladen...');
        
        console.log('Force refresh: skipping cache and fetching from API directly');
        // Als er geen gecachte projecten zijn, haal ze op van de API
        console.log('Fetching projects from API...');
        console.log('API call to: /dashboard/projects/active');
        const activeProjects = await fetchActiveProjects();
        console.log('API Response received. Raw response size:', activeProjects ? JSON.stringify(activeProjects).length : 'undefined');
        
        if (activeProjects && activeProjects.length > 0) {
          console.log('Project data appears valid with', activeProjects.length, 'projects');
          console.log('First 3 API projects:', activeProjects.slice(0, 3).map(p => ({ id: p.id, name: p.name })));
          
          setProjects(activeProjects);
          console.log('Set projects state with', activeProjects.length, 'projects');
          setLoadingState('complete');
          setLoadingMessage(`${activeProjects.length} projecten geladen.`);
          
          // Sla projecten op in IndexedDB
          try {
            console.log('Saving projects to IndexedDB...');
            await dbService.saveProjects(activeProjects);
            console.log('Projects saved to IndexedDB successfully');
          } catch (dbError) {
            console.error('Error saving projects to IndexedDB:', dbError);
          }
        } else {
          console.error('No projects returned from API or empty array. API returned:', activeProjects);
          setError('Geen projecten gevonden');
          setLoadingState('error');
          setLoadingMessage('Er zijn geen projecten gevonden. Probeer de synchronisatie opnieuw uit te voeren.');
          console.log('No projects returned from API');
        }
        setLoading(false);
        return;
      }

      // We laden uit de cache
      setLoadingState('loading');
      setLoadingMessage('Projecten worden uit de cache geladen...');
      
      // Probeer eerst projecten uit de IndexedDB te laden
      try {
        console.log('Attempting to load projects from IndexedDB...');
        const cachedProjects = await dbService.getAllProjects();
        console.log('IndexedDB returned', cachedProjects ? cachedProjects.length : 0, 'projects');
        
        if (cachedProjects && cachedProjects.length > 0) {
          console.log('Loaded projects from cache:', cachedProjects.length);
          console.log('First 3 cached projects:', cachedProjects.slice(0, 3).map(p => ({ id: p.id, name: p.name })));
          setProjects(cachedProjects);
          setLoadingState('complete');
          setLoadingMessage(`${cachedProjects.length} projecten geladen uit cache.`);
          setLoading(false);
          return;
        } else {
          console.log('No projects found in cache or empty array returned');
          setLoadingMessage('Geen projecten in cache gevonden. Laden vanaf API...');
        }
      } catch (dbError) {
        console.error('Error loading projects from IndexedDB:', dbError);
        setLoadingMessage('Fout bij laden uit cache. Proberen vanaf API...');
      }

      // Als er geen gecachte projecten zijn, haal ze op van de API
      console.log('No cached projects available, fetching from API directly');
      setLoadingMessage('Projecten worden opgehaald van de server...');
      
      console.log('API call to: /dashboard/projects/active');
      try {
        const activeProjects = await fetchActiveProjects();
        console.log('API Response received. Raw data size:', activeProjects ? JSON.stringify(activeProjects).length : 'undefined');
        
        if (activeProjects && activeProjects.length > 0) {
          console.log('Project data valid with', activeProjects.length, 'projects');
          console.log('First 3 API projects:', activeProjects.slice(0, 3).map(p => ({ id: p.id, name: p.name })));
          setProjects(activeProjects);
          setLoadingState('complete');
          setLoadingMessage(`${activeProjects.length} projecten geladen.`);
          
          // Sla projecten op in IndexedDB
          try {
            console.log('Saving projects to IndexedDB...');
            await dbService.saveProjects(activeProjects);
            console.log('Projects saved to IndexedDB successfully');
          } catch (dbError) {
            console.error('Error saving projects to IndexedDB:', dbError);
          }
        } else {
          console.error('No projects returned from API or empty array. API returned:', activeProjects);
          setError('Geen projecten gevonden');
          setLoadingState('error');
          setLoadingMessage('Er zijn geen projecten gevonden van de API. Probeer de synchronisatie opnieuw uit te voeren.');
          console.log('No projects returned from API');
        }
      } catch (apiError) {
        console.error('Error calling API:', apiError);
        setError('API fout: ' + (apiError.message || 'Onbekende fout'));
        setLoadingState('error');
        setLoadingMessage('Er is een fout opgetreden bij het API verzoek. Probeer het later opnieuw.');
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Er is een fout opgetreden bij het laden van de projecten');
      setLoadingState('error');
      setLoadingMessage('Er is een fout opgetreden bij het laden van de projecten. Controleer de console voor details.');
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
      setLoadingState('syncing');
      setLoadingMessage('Projecten worden gesynchroniseerd...');
      
      toast({
        title: "Synchronisatie gestart",
        description: "Projecten data wordt gesynchroniseerd...",
      });
      
      // Synchroniseer projecten met de Gripp API
      console.log('Starting project synchronization');
      await syncProjects();
      console.log('Sync request completed');
      
      // Wacht kort om de server tijd te geven om de database bij te werken
      setLoadingMessage('Even geduld terwijl de server bijwerkt...');
      toast({
        title: "Database bijwerken",
        description: "Project database wordt bijgewerkt...",
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Laad de bijgewerkte projecten direct van de API
      setLoadingMessage('Bijgewerkte projecten worden opgehaald...');
      toast({
        title: "Data opnieuw laden",
        description: "Projecten worden opnieuw geladen van de server...",
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
        setLoadingMessage(`${refreshedProjects.length} projecten geladen.`);
        
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
          description: `Projecten data is bijgewerkt met ${refreshedProjects.length} projecten.`,
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
  }, [toast]);

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
        
        // Filter op status
        if (selectedStatus && selectedStatus !== 'all') {
          const status = getProjectStatus(project);
          if (status !== selectedStatus) {
            return false;
          }
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
        // Sorteer op voortgang (oplopend)
        if (sortOrder === 'progress-asc') {
          return calculateProjectProgress(a) - calculateProjectProgress(b);
        }
        
        // Sorteer op voortgang (aflopend)
        if (sortOrder === 'progress-desc') {
          return calculateProjectProgress(b) - calculateProjectProgress(a);
        }
        
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
  }, [projects, searchQuery, selectedClient, selectedPhase, sortOrder, selectedTag, selectedStatus]);

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

  // Render loading/error state
  const renderLoadingState = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-8 mt-8">
          <div className="animate-spin mb-4">
            <RefreshCw className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-medium text-center">{loadingMessage || 'Projecten worden geladen...'}</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-8 mt-8 border border-red-200 rounded-lg bg-red-50">
          <p className="text-lg font-medium text-center text-red-800 mb-4">{error}</p>
          <p className="text-sm text-center text-red-600 mb-4">{loadingMessage}</p>
          <Button onClick={() => loadProjects(true)}>Opnieuw proberen</Button>
        </div>
      );
    }
    
    return null;
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