import React from 'react';
import { ProjectsProvider, useProjects } from '../../contexts/ProjectsContext';
import ProjectFilters from '../../components/projects/ProjectFilters';
import ProjectList from '../../components/projects/ProjectList';
import ProjectSync from '../../components/projects/ProjectSync';
import ProjectDetails from '../../components/projects/ProjectDetails';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';

const ProjectsPage: React.FC = () => {
  return (
    <ProjectsProvider>
      <ProjectsPageContent />
    </ProjectsProvider>
  );
};

const ProjectsPageContent: React.FC = () => {
  const { loadingState, loadingMessage, error, filteredProjects } = useProjects();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projecten</h2>
          <p className="text-muted-foreground">
            Bekijk en beheer alle projecten
          </p>
        </div>
        <ProjectSync />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fout</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ProjectFilters />

      {loadingState === 'loading' || loadingState === 'syncing' ? (
        <div className="space-y-4">
          <div className="text-center text-muted-foreground mb-4">
            {loadingMessage}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[200px] rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">
              {filteredProjects.length} projecten gevonden
            </p>
          </div>
          <ProjectList />
        </>
      )}

      <ProjectDetails />
    </div>
  );
};

export default ProjectsPage;
