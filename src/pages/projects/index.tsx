/**
 * Projects Page
 *
 * This page displays project data with filtering, sorting, and detailed views.
 * It supports synchronization with the Gripp API and local caching.
 */

// React and hooks
import React, { useState, useEffect, useMemo, useCallback } from 'react';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';

// Icons
import {
  RefreshCw,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  Save,
  RotateCcw,
  X,
  AlertTriangle
} from 'lucide-react';

// Custom components
import ProjectCard from '@/components/dashboard/ProjectCard';
import ProjectDetails from '@/components/dashboard/ProjectDetails';

// Types
import { GrippProject } from '@/types/gripp';

// Services and APIs
import {
  fetchActiveProjects,
  fetchProjectDetails,
  syncProjects,
  syncProjectById
} from '@/api/dashboard/grippApi';
import { dbService } from '@/api/dashboard/dbService';

/**
 * Key used for storing filter settings in localStorage
 */
const FILTER_STORAGE_KEY = 'projectFilterSettings';

/**
 * ProjectsPage Component
 *
 * Main page for displaying and managing project data with various filtering,
 * sorting, and synchronization options.
 *
 * Features:
 * - Project listing with filtering and sorting
 * - Project details view
 * - Synchronization with Gripp API
 * - Local caching with IndexedDB
 * - Filter persistence with localStorage
 */
const ProjectsPage: React.FC = () => {
  const { toast } = useToast();

  // ===== Data State =====

  /**
   * Main project data
   */
  const [projects, setProjects] = useState<GrippProject[]>([]);

  /**
   * Currently selected project for detailed view
   */
  const [selectedProject, setSelectedProject] = useState<GrippProject | null>(null);

  // ===== UI State =====

  /**
   * General loading state (legacy)
   */
  const [loading, setLoading] = useState(true);

  /**
   * Error message to display
   */
  const [error, setError] = useState<string | null>(null);

  /**
   * Whether a sync operation is in progress
   */
  const [syncing, setSyncing] = useState(false);

  /**
   * Whether project details are being loaded
   */
  const [loadingDetails, setLoadingDetails] = useState(false);

  /**
   * Detailed loading state for UI feedback
   */
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'syncing' | 'complete' | 'error'>('idle');

  /**
   * Message to display during loading operations
   */
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  // ===== Filter State =====

  /**
   * Text search query
   */
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Selected client filter
   */
  const [selectedClient, setSelectedClient] = useState('all');

  /**
   * Selected project phase filter
   */
  const [selectedPhase, setSelectedPhase] = useState('all');

  /**
   * Selected status filter (based on progress)
   */
  const [selectedStatus, setSelectedStatus] = useState('all');

  /**
   * Selected tag filter
   */
  const [selectedTag, setSelectedTag] = useState('all');

  /**
   * Sort order for projects list
   */
  const [sortOrder, setSortOrder] = useState('deadline-asc');

  /**
   * Load filter settings from localStorage
   *
   * Attempts to load previously saved filter settings from localStorage
   * and apply them to the current state.
   *
   * @returns boolean - Whether filters were successfully loaded
   */
  const loadFiltersFromStorage = useCallback(() => {
    try {
      console.log('Loading filters from localStorage...');
      const savedSettings = localStorage.getItem(FILTER_STORAGE_KEY);

      if (savedSettings) {
        // Parse the saved settings
        const settings = JSON.parse(savedSettings);
        console.log('Found filter settings:', settings);

        // Apply each filter setting with fallbacks
        setSearchQuery(settings.searchQuery || '');
        setSelectedClient(settings.selectedClient || 'all');
        setSelectedPhase(settings.selectedPhase || 'all');
        setSelectedStatus(settings.selectedStatus || 'all');
        setSelectedTag(settings.selectedTag || 'all');
        setSortOrder(settings.sortOrder || 'deadline-asc');

        console.log('Filters successfully loaded from localStorage');
        return true;
      } else {
        console.log('No saved filters found in localStorage');
        return false;
      }
    } catch (error) {
      console.error('Error loading filters:', error);
      return false;
    }
  }, []);

  /**
   * Save filter settings to localStorage
   *
   * @param filterData - Object containing filter settings to save
   * @returns boolean - Whether filters were successfully saved
   */
  const saveFiltersToStorage = useCallback((filterData: Record<string, any>) => {
    try {
      console.log('Saving filters to localStorage:', filterData);
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterData));
      console.log('Filters successfully saved to localStorage');
      return true;
    } catch (error) {
      console.error('Error saving filters:', error);
      return false;
    }
  }, []);

  /**
   * Save current filter settings and show confirmation toast
   *
   * Collects all current filter settings and saves them to localStorage
   */
  const saveFilters = useCallback(() => {
    // Collect all current filter settings
    const filterSettings = {
      searchQuery,
      selectedClient,
      selectedPhase,
      selectedStatus,
      selectedTag,
      sortOrder
    };

    // Save to localStorage and show appropriate toast
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

  /**
   * Load saved filter settings and show confirmation toast
   *
   * Attempts to load filters from localStorage and shows appropriate feedback
   */
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

  /**
   * Reset all filters to default values
   *
   * Clears all filter settings and shows confirmation toast
   */
  const clearFilters = useCallback(() => {
    // Reset all filters to defaults
    setSearchQuery('');
    setSelectedClient('all');
    setSelectedPhase('all');
    setSelectedStatus('all');
    setSelectedTag('all');
    setSortOrder('deadline-asc');

    // Show confirmation toast
    toast({
      title: "Filters gewist",
      description: "Alle filterinstellingen zijn teruggezet naar de standaardwaarden.",
    });
  }, [toast]);

  /**
   * Load projects from cache or API
   *
   * This function attempts to load projects using the following strategy:
   * 1. If forceRefresh is false, try to load from IndexedDB cache first
   * 2. If cache is empty or forceRefresh is true, fetch from API
   * 3. Update the cache with fresh data when fetching from API
   *
   * @param forceRefresh - Whether to bypass cache and fetch directly from API
   */
  const loadProjects = useCallback(async (forceRefresh = false) => {
    // Update UI state to show loading
    setLoadingState('loading');
    setLoadingMessage('Projecten worden geladen...');
    setError(null);

    // Try to load from cache first (unless force refresh is requested)
    if (!forceRefresh) {
      try {
        console.log('Attempting to load projects from IndexedDB...');
        const localProjects = await dbService.getAllProjects();

        // Check if we have valid cached data
        if (localProjects && localProjects.length > 0) {
          console.log(`Loaded ${localProjects.length} projects from IndexedDB`);

          // Update state with cached projects
          setProjects(localProjects);
          setLoadingState('complete');
          setLoadingMessage(`${localProjects.length} projecten geladen uit lokale cache`);
          return; // Exit early if we successfully loaded from cache
        } else {
          // Cache miss - continue to API fetch
          console.log('No projects in IndexedDB or empty response, fetching from API');
          throw new Error('No projects in local database');
        }
      } catch (apiError) {
        // Handle cache loading errors
        console.error('Error loading from cache:', apiError);
        const errorMessage = apiError instanceof Error ? apiError.message : 'Onbekende fout';
        setError('Cache fout: ' + errorMessage);
        setLoadingState('error');
        setLoadingMessage('Er is een fout opgetreden bij het laden uit cache. Probeer het later opnieuw.');
        return; // Exit on error
      }
    }

    // Direct API fetch path (either forceRefresh=true or cache was empty)
    try {
      console.log('API call to: /dashboard/projects/active');
      setLoadingMessage('Projecten worden geladen vanaf API...');

      // Fetch projects from API
      const activeProjects = await fetchActiveProjects();
      console.log(`Loaded ${activeProjects.length} projects from API`);

      // Update state with fetched projects
      setProjects(activeProjects);
      setLoadingState('complete');
      setLoadingMessage(`${activeProjects.length} projecten geladen vanaf API`);

      // Update IndexedDB cache with fresh data
      try {
        await dbService.saveProjects(activeProjects);
        console.log('Projects saved to IndexedDB cache');
      } catch (dbError) {
        console.error('Error saving projects to IndexedDB:', dbError);
        // Non-critical error, don't show to user
      }
    } catch (error) {
      // Handle API fetch errors
      console.error('Error fetching active projects:', error);
      setLoadingState('error');
      setLoadingMessage('Er is een fout opgetreden bij het laden van de projecten. Probeer het later opnieuw.');
      setError('Fout bij laden van projecten');
    }
  }, []);

  /**
   * Track whether initial data loading has been completed
   */
  const initialLoadDone = React.useRef(false);

  /**
   * Load initial data when component mounts
   *
   * This effect runs once when the component mounts and:
   * 1. Loads saved filter settings from localStorage
   * 2. Loads projects data (from cache or API)
   */
  useEffect(() => {
    // Only load if not already done
    if (!initialLoadDone.current) {
      console.log('Initial page load - loading filters and projects...');

      // First load saved filter settings
      loadFiltersFromStorage();

      // Then load projects data
      loadProjects();

      // Mark initial load as complete
      initialLoadDone.current = true;
    }
  }, [loadProjects, loadFiltersFromStorage]);

  /**
   * Reload filter settings when window regains focus
   *
   * This allows filter settings to stay in sync when the user
   * returns to the page after visiting other pages.
   */
  useEffect(() => {
    // Handler for window focus events
    const handleFocus = () => {
      console.log('Window regained focus - checking for updated filter settings');
      loadFiltersFromStorage();
    };

    // Register event listener
    window.addEventListener('focus', handleFocus);

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadFiltersFromStorage]);

  /**
   * Automatically save filter settings when they change
   *
   * This effect runs whenever any filter setting changes and
   * saves the current settings to localStorage.
   */
  useEffect(() => {
    // Skip saving during initial load to avoid overwriting
    // settings that might be loaded from localStorage
    if (!initialLoadDone.current) {
      return;
    }

    // Collect all current filter settings
    const filterSettings = {
      searchQuery,
      selectedClient,
      selectedPhase,
      selectedStatus,
      selectedTag,
      sortOrder
    };

    // Save to localStorage
    saveFiltersToStorage(filterSettings);
  }, [
    // Filter dependencies
    searchQuery,
    selectedClient,
    selectedPhase,
    selectedStatus,
    selectedTag,
    sortOrder,

    // Function dependency
    saveFiltersToStorage
  ]);

  /**
   * Synchronize projects with the Gripp API
   *
   * This function performs a full synchronization process:
   * 1. Call the sync API endpoint to trigger server-side sync
   * 2. Clear local cache
   * 3. Fetch fresh data from API
   * 4. Update local state and cache
   */
  const handleSync = useCallback(async () => {
    // Prevent multiple simultaneous sync operations
    if (syncing) return;

    try {
      // Update UI to show syncing state
      setSyncing(true);
      setLoadingState('syncing');
      setLoadingMessage('Projecten worden gesynchroniseerd met Gripp...');

      // Show initial toast notification
      toast({
        title: "Synchronisatie gestart",
        description: "Projecten worden gesynchroniseerd met Gripp...",
      });

      // Step 1: Call the sync API endpoint to trigger server-side sync
      await syncProjects();

      // Show progress notification
      toast({
        title: "Data gesynchroniseerd",
        description: "Projecten zijn gesynchroniseerd met Gripp, gegevens worden opgehaald...",
      });

      // Wait a moment to ensure server-side processing is complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Clear local cache
      setLoadingMessage("Cache wordt leeggemaakt...");
      await dbService.clearProjects();

      // Show progress notification
      toast({
        title: "Data ophalen",
        description: "Bijgewerkte project gegevens worden opgehaald...",
      });

      console.log('Forcing projects refresh');

      // Step 3: Fetch fresh data from API with cache busting
      const timestamp = new Date().getTime();
      const refreshedProjects = await fetchActiveProjects(`?refresh=true&_t=${timestamp}`);

      // Step 4: Process the fetched data
      if (refreshedProjects && refreshedProjects.length > 0) {
        console.log(`Successfully loaded ${refreshedProjects.length} projects after sync`);

        // Update state with fresh data
        setProjects(refreshedProjects);
        setLoadingState('complete');
        setLoadingMessage(`${refreshedProjects.length} projecten succesvol gesynchroniseerd.`);

        // Update IndexedDB cache for future use
        try {
          console.log('Saving projects to IndexedDB cache');
          await dbService.saveProjects(refreshedProjects);
          console.log('Projects saved to IndexedDB cache');
        } catch (dbError) {
          console.error('Error saving projects to IndexedDB:', dbError);
        }

        // Show success notification
        toast({
          title: "Synchronisatie voltooid",
          description: `${refreshedProjects.length} projecten zijn succesvol bijgewerkt.`,
          variant: "default",
        });
      } else {
        // Handle case where no projects were returned
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
      // Handle errors in the sync process
      console.error('Error syncing projects:', err);
      setLoadingState('error');
      setLoadingMessage('Synchronisatie mislukt. Probeer het later opnieuw.');

      toast({
        title: "Synchronisatie mislukt",
        description: "Er is een fout opgetreden bij het synchroniseren van de projecten.",
        variant: "destructive",
      });

      // Fallback: Try to load projects from cache to ensure
      // the user doesn't end up with an empty UI
      try {
        await loadProjects(false);
      } catch (loadError) {
        console.error('Error loading projects after sync failure:', loadError);
      }
    } finally {
      // Always reset syncing state when done
      setSyncing(false);
    }
  }, [toast, loadProjects]);

  /**
   * Navigate to project details view
   *
   * This function:
   * 1. First tries to find the project in the local state
   * 2. If not found, fetches the project details from the API
   * 3. Updates the UI to show the selected project
   *
   * @param id - The ID of the project to view
   */
  const handleProjectClick = useCallback(async (id: number) => {
    try {
      // Update UI state
      setLoadingDetails(true);
      setError(null);

      // First try to find the project in local state (faster)
      const localProject = projects.find(p => p.id === id);
      if (localProject) {
        console.log(`Found project ${id} in local state`);
        setSelectedProject(localProject);
        setLoadingDetails(false);
        return;
      }

      // If not found locally, fetch from API
      console.log(`Project ${id} not found locally, fetching from API`);
      const projectDetails = await fetchProjectDetails(id);

      if (projectDetails) {
        console.log(`Successfully fetched project ${id} details from API`);
        setSelectedProject(projectDetails);
      } else {
        console.error(`Failed to fetch project ${id} details`);
        setError('Project details konden niet worden geladen');
      }
    } catch (err) {
      console.error('Error loading project details:', err);
      setError('Er is een fout opgetreden bij het laden van de project details');
    } finally {
      setLoadingDetails(false);
    }
  }, [projects]);

  /**
   * Close project details view and return to projects list
   */
  const handleCloseDetails = useCallback(() => {
    setSelectedProject(null);
  }, []);

  /**
   * Extract unique client names from projects for filter dropdown
   */
  const clients = useMemo(() => {
    // Get all unique client names from projects
    const uniqueClients = new Set(
      projects
        .map(p => p.company?.searchname || '')
        .filter(Boolean) // Remove empty strings
    );

    // Convert to sorted array
    return Array.from(uniqueClients).sort();
  }, [projects]);

  /**
   * Extract unique phase names from projects for filter dropdown
   */
  const phases = useMemo(() => {
    // Get all unique phase names from projects
    const uniquePhases = new Set(
      projects
        .map(p => p.phase?.searchname || '')
        .filter(Boolean) // Remove empty strings
    );

    // Convert to sorted array
    return Array.from(uniquePhases).sort();
  }, [projects]);

  /**
   * Extract unique tag names from projects for filter dropdown
   *
   * Handles both string (JSON) and array tag formats.
   */
  const tags = useMemo(() => {
    // Collect all tags from all projects
    const allTags: string[] = [];

    projects.forEach(project => {
      // Handle string format (JSON string that needs parsing)
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
      // Handle array format (direct use)
      else if (Array.isArray(project.tags)) {
        project.tags.forEach(tag => {
          // Handle both object tags and string tags
          const tagName = typeof tag === 'object'
            ? (tag.searchname || tag.name)
            : tag;

          if (tagName) allTags.push(tagName);
        });
      }
    });

    // Remove duplicates and sort
    const uniqueTags = new Set(allTags);
    return Array.from(uniqueTags).sort();
  }, [projects]);

  /**
   * Calculate the progress percentage of a project
   *
   * Compares written hours to budgeted hours to determine
   * how much of the project budget has been used.
   *
   * @param project - The project to calculate progress for
   * @returns Progress percentage (0-100+)
   */
  const calculateProjectProgress = useCallback((project: GrippProject) => {
    // Check if project has valid project lines
    if (!project.projectlines || !Array.isArray(project.projectlines)) return 0;

    try {
      // Calculate total written hours
      const written = project.projectlines.reduce((sum, line) =>
        sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);

      // Calculate total budgeted hours
      const budgeted = project.projectlines.reduce((sum, line) =>
        sum + (line && line.amount ? line.amount : 0), 0);

      // Calculate percentage (can be over 100%)
      return budgeted > 0 ? (written / budgeted) * 100 : 0;
    } catch (error) {
      console.error('Error calculating project progress:', error);
      return 0;
    }
  }, []);

  /**
   * Determine the status category of a project based on its progress
   *
   * Status categories:
   * - 'normal': < 75% of budget used
   * - 'warning': 75-100% of budget used
   * - 'over-budget': > 100% of budget used
   *
   * @param project - The project to determine status for
   * @returns Status category string
   */
  const getProjectStatus = useCallback((project: GrippProject) => {
    const progress = calculateProjectProgress(project);

    if (progress > 100) return 'over-budget';  // Over budget
    if (progress >= 75) return 'warning';      // Approaching budget limit
    return 'normal';                           // Within budget
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