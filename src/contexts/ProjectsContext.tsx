import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { GrippProject } from '../types/gripp';
import { fetchActiveProjects, syncProjects, syncProjectById } from '../api/dashboard/grippApi';
import { dbService } from '../api/dashboard/dbService';
import { useToast } from '../components/ui/use-toast';

// Define the context type
interface ProjectsContextType {
  // State
  projects: GrippProject[];
  filteredProjects: GrippProject[];
  selectedProject: GrippProject | null;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  loadingState: 'idle' | 'loading' | 'syncing' | 'complete' | 'error';
  loadingMessage: string;
  loadingDetails: boolean;
  
  // Filters
  searchQuery: string;
  selectedClient: string;
  selectedPhase: string;
  selectedStatus: string;
  selectedTag: string;
  sortOrder: string;
  
  // Filter options
  clients: string[];
  phases: string[];
  tags: string[];
  
  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedClient: (client: string) => void;
  setSelectedPhase: (phase: string) => void;
  setSelectedStatus: (status: string) => void;
  setSelectedTag: (tag: string) => void;
  setSortOrder: (order: string) => void;
  loadProjects: (forceRefresh?: boolean) => Promise<void>;
  syncProjects: () => Promise<void>;
  selectProject: (id: number) => Promise<void>;
  closeProjectDetails: () => void;
  refreshSelectedProject: () => Promise<void>;
  saveFilters: () => void;
  loadSavedFilters: () => void;
  clearFilters: () => void;
  clearCache: () => Promise<void>;
  
  // Utility functions
  calculateProjectProgress: (project: GrippProject) => number;
  getProjectStatus: (project: GrippProject) => 'normal' | 'warning' | 'over-budget';
}

// Create the context with a default value
const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

// Storage key for filters
const FILTER_STORAGE_KEY = 'projectFilterSettings';

// Provider component
export const ProjectsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  
  // State
  const [projects, setProjects] = useState<GrippProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<GrippProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'syncing' | 'complete' | 'error'>('idle');
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedPhase, setSelectedPhase] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [sortOrder, setSortOrder] = useState('deadline-asc');
  
  // Track initial load
  const initialLoadDone = React.useRef(false);
  
  // Load filters from localStorage
  const loadFiltersFromStorage = useCallback(() => {
    try {
      console.log('Poging om filters te laden uit localStorage...');
      const savedSettings = localStorage.getItem(FILTER_STORAGE_KEY);
      
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        console.log('Gevonden filter instellingen:', settings);
        
        setSearchQuery(settings.searchQuery || '');
        setSelectedClient(settings.selectedClient || 'all');
        setSelectedPhase(settings.selectedPhase || 'all');
        setSelectedStatus(settings.selectedStatus || 'all');
        setSelectedTag(settings.selectedTag || 'all');
        setSortOrder(settings.sortOrder || 'deadline-asc');
        
        console.log('Filters succesvol geladen uit localStorage');
        return true;
      } else {
        console.log('Geen opgeslagen filters gevonden in localStorage');
        return false;
      }
    } catch (error) {
      console.error('Fout bij laden van filters:', error);
      return false;
    }
  }, []);
  
  // Save filters to localStorage
  const saveFiltersToStorage = useCallback((filterData: Record<string, any>) => {
    try {
      console.log('Opslaan van filters in localStorage:', filterData);
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterData));
      console.log('Filters succesvol opgeslagen in localStorage');
      return true;
    } catch (error) {
      console.error('Fout bij opslaan van filters:', error);
      return false;
    }
  }, []);
  
  // Save filters
  const saveFilters = useCallback(() => {
    const filterSettings = {
      searchQuery,
      selectedClient,
      selectedPhase,
      selectedStatus,
      selectedTag,
      sortOrder
    };
    
    if (saveFiltersToStorage(filterSettings)) {
      toast({
        title: "Filters opgeslagen",
        description: "Je filterinstellingen zijn opgeslagen en kunnen later worden geladen.",
      });
    } else {
      toast({
        title: "Fout bij opslaan",
        description: "Er is een fout opgetreden bij het opslaan van de filterinstellingen.",
        variant: "destructive",
      });
    }
  }, [searchQuery, selectedClient, selectedPhase, selectedStatus, selectedTag, sortOrder, toast, saveFiltersToStorage]);
  
  // Load saved filters
  const loadSavedFilters = useCallback(() => {
    if (loadFiltersFromStorage()) {
      toast({
        title: "Filters geladen",
        description: "Je opgeslagen filterinstellingen zijn toegepast.",
      });
    } else {
      toast({
        title: "Geen opgeslagen filters",
        description: "Er zijn geen eerder opgeslagen filterinstellingen gevonden.",
        variant: "destructive",
      });
    }
  }, [toast, loadFiltersFromStorage]);
  
  // Clear filters
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
  
  // Load projects
  const loadProjects = useCallback(async (forceRefresh = false) => {
    setLoadingState('loading');
    setLoadingMessage('Projecten worden geladen...');
    setError(null);
    
    // Try to load projects from IndexedDB first, unless forcing refresh
    if (!forceRefresh) {
      try {
        console.log('Attempting to load projects from IndexedDB...');
        const localProjects = await dbService.getAllProjects();
        
        if (localProjects && localProjects.length > 0) {
          console.log(`Loaded ${localProjects.length} projects from IndexedDB`);
          // Use projects directly from the database
          setProjects(localProjects);
          setLoadingState('complete');
          setLoadingMessage(`${localProjects.length} projecten geladen uit lokale cache`);
        } else {
          console.log('No projects in IndexedDB or empty response, fetching from API');
          
          // Load directly from API if no projects in local database
          console.log('API call to: /dashboard/projects/active');
          setLoadingMessage('Projecten worden geladen vanaf API...');
          
          const activeProjects = await fetchActiveProjects();
          console.log(`Loaded ${activeProjects.length} projects from API`);
          
          // Use projects directly from the API
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
    
    // If we're here, we're loading projects directly from the API (forceRefresh=true)
    try {
      console.log('API call to: /dashboard/projects/active');
      setLoadingMessage('Projecten worden geladen vanaf API...');
      
      const activeProjects = await fetchActiveProjects();
      console.log(`Loaded ${activeProjects.length} projects from API`);
      
      // Use projects directly from the API
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
  
  // Sync projects
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
      
      // First sync Gripp projects
      await syncProjects();
      
      toast({
        title: "Data gesynchroniseerd",
        description: "Projecten zijn gesynchroniseerd met Gripp, gegevens worden opgehaald...",
      });
      
      // Wait a second to make sure the database is updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear IndexedDB cache
      setLoadingMessage("Cache wordt leeggemaakt...");
      await dbService.clearProjects();
      
      toast({
        title: "Data ophalen",
        description: "Bijgewerkte project gegevens worden opgehaald...",
      });
      
      console.log('Forcing projects refresh');
      
      // Force a direct refresh from the API
      const timestamp = new Date().getTime();
      const refreshedProjects = await fetchActiveProjects(`?refresh=true&_t=${timestamp}`);
      
      if (refreshedProjects && refreshedProjects.length > 0) {
        console.log(`Successfully loaded ${refreshedProjects.length} projects after sync`);
        
        // Update state directly with the new projects
        setProjects(refreshedProjects);
        setLoadingState('complete');
        setLoadingMessage(`${refreshedProjects.length} projecten succesvol gesynchroniseerd.`);
        
        // Also update IndexedDB for future load cycles
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
      
      // Try to load projects anyway (not forced) to ensure
      // the user doesn't end up with an empty UI
      try {
        await loadProjects(false);
      } catch (loadError) {
        console.error('Error loading projects after sync failure:', loadError);
      }
    } finally {
      setSyncing(false);
    }
  }, [syncing, toast, loadProjects]);
  
  // Select project
  const selectProject = useCallback(async (id: number) => {
    try {
      setLoadingDetails(true);
      setError(null);
      
      // Look for the project in local projects first
      const localProject = projects.find(p => p.id === id);
      if (localProject) {
        setSelectedProject(localProject);
        setLoadingDetails(false);
        return;
      }
      
      // If the project is not found locally, fetch it from the API
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
  
  // Close project details
  const closeProjectDetails = useCallback(() => {
    setSelectedProject(null);
  }, []);
  
  // Refresh selected project
  const refreshSelectedProject = useCallback(async () => {
    if (!selectedProject) return;
    
    try {
      setLoadingDetails(true);
      const refreshedProject = await syncProjectById(selectedProject.id);
      
      if (refreshedProject) {
        // Update the project in the state
        setSelectedProject(refreshedProject);
        
        // Update the project in the list of projects
        setProjects(prev =>
          prev.map(p => p.id === refreshedProject.id ? refreshedProject : p)
        );
        
        // Update the project in the cache
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
  
  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      setLoadingState('loading');
      setLoadingMessage('Cache wordt leeggemaakt...');
      
      // Clear the cache
      await dbService.clearCache();
      console.log('Cache cleared');
      
      // Remove projects from IndexedDB
      await dbService.clearProjects();
      console.log('Projects cleared from IndexedDB');
      
      // Load projects directly from the API
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
  }, [loadProjects, toast]);
  
  // Calculate project progress
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
  
  // Get project status
  const getProjectStatus = useCallback((project: GrippProject) => {
    const progress = calculateProjectProgress(project);
    
    if (progress > 100) return 'over-budget';
    if (progress >= 75) return 'warning';
    return 'normal';
  }, [calculateProjectProgress]);
  
  // Filter options
  const clients = useMemo(() => {
    const uniqueClients = new Set(projects.map(p => p.company?.searchname || '').filter(Boolean));
    return Array.from(uniqueClients).sort();
  }, [projects]);
  
  const phases = useMemo(() => {
    const uniquePhases = new Set(projects.map(p => p.phase?.searchname || '').filter(Boolean));
    return Array.from(uniquePhases).sort();
  }, [projects]);
  
  const tags = useMemo(() => {
    // Collect all tags from all projects
    const allTags: string[] = [];
    
    projects.forEach(project => {
      // If tags is a string (JSON format), try to parse it
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
      // If tags is an array, use directly
      else if (Array.isArray(project.tags)) {
        project.tags.forEach(tag => {
          const tagName = typeof tag === 'object' ? (tag.searchname || tag.name) : tag;
          if (tagName) allTags.push(tagName);
        });
      }
    });
    
    // Filter unique tags
    const uniqueTags = new Set(allTags);
    return Array.from(uniqueTags).sort();
  }, [projects]);
  
  // Filtered projects
  const filteredProjects = useMemo(() => {
    console.log('Filter/sort running on projects:', projects.length);
    if (projects.length === 0) {
      console.log('No projects to filter/sort');
      return [];
    }
    
    // Log first few projects to see what we have
    console.log('First few projects:', projects.slice(0, 3).map(p => ({ id: p.id, name: p.name })));
    
    return projects
      .filter(project => {
        // Filter by search term
        if (searchQuery && !project.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        
        // Filter by client
        if (selectedClient && selectedClient !== 'all' && project.company?.searchname !== selectedClient) {
          return false;
        }
        
        // Filter by phase
        if (selectedPhase && selectedPhase !== 'all' && project.phase?.searchname !== selectedPhase) {
          return false;
        }
        
        // Filter by status (progress)
        if (selectedStatus && selectedStatus !== 'all') {
          const status = getProjectStatus(project);
          if (status !== selectedStatus) {
            return false;
          }
        }
        
        // Filter by tag
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
            // If deadline is null, put it at the end
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
  
  // Effect to load projects and filters on component mount
  useEffect(() => {
    // Only load if not already done
    if (!initialLoadDone.current) {
      console.log('Initial page load - loading filters and projects...');
      
      // First load saved filters
      loadFiltersFromStorage();
      
      // Then load projects
      loadProjects();
      
      // Mark initial load as done
      initialLoadDone.current = true;
    }
  }, [loadProjects, loadFiltersFromStorage]);
  
  // Effect to listen for focus events to reload filters
  useEffect(() => {
    const handleFocus = () => {
      console.log('Window got focus - checking if filters need to be updated');
      loadFiltersFromStorage();
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadFiltersFromStorage]);
  
  // Effect to save filters on every change
  useEffect(() => {
    // If filters are still being loaded, don't save yet
    if (!initialLoadDone.current) {
      return;
    }
    
    const filterSettings = {
      searchQuery,
      selectedClient,
      selectedPhase,
      selectedStatus,
      selectedTag,
      sortOrder
    };
    
    saveFiltersToStorage(filterSettings);
  }, [searchQuery, selectedClient, selectedPhase, selectedStatus, selectedTag, sortOrder, saveFiltersToStorage]);
  
  // Log filtered projects count
  console.log('Filtered projects count:', filteredProjects.length);
  
  // Create the context value
  const contextValue: ProjectsContextType = {
    // State
    projects,
    filteredProjects,
    selectedProject,
    loading,
    syncing,
    error,
    loadingState,
    loadingMessage,
    loadingDetails,
    
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
    loadProjects,
    syncProjects: handleSync,
    selectProject,
    closeProjectDetails,
    refreshSelectedProject,
    saveFilters,
    loadSavedFilters,
    clearFilters,
    clearCache,
    
    // Utility functions
    calculateProjectProgress,
    getProjectStatus
  };
  
  return (
    <ProjectsContext.Provider value={contextValue}>
      {children}
    </ProjectsContext.Provider>
  );
};

// Custom hook to use the projects context
export const useProjects = (): ProjectsContextType => {
  const context = useContext(ProjectsContext);
  
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  
  return context;
};
