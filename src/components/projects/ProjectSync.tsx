import React from 'react';
import { Button } from '../../components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useProjects } from '../../contexts/ProjectsContext';

interface ProjectSyncProps {
  className?: string;
}

const ProjectSync: React.FC<ProjectSyncProps> = ({ className }) => {
  const {
    syncing,
    syncProjects,
    loadProjects,
    clearCache
  } = useProjects();
  
  return (
    <div className={`flex space-x-2 ${className}`}>
      <Button
        variant="outline"
        onClick={async () => await clearCache()}
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
        onClick={syncProjects}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        Synchroniseren
      </Button>
    </div>
  );
};

export default ProjectSync;
