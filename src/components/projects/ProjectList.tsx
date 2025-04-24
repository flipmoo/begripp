import React from 'react';
import ProjectCard from '../../components/dashboard/ProjectCard';
import { useProjects } from '../../contexts/ProjectsContext';

interface ProjectListProps {
  className?: string;
}

const ProjectList: React.FC<ProjectListProps> = ({ className }) => {
  const {
    filteredProjects,
    selectProject,
    calculateProjectProgress
  } = useProjects();
  
  if (filteredProjects.length === 0) {
    return (
      <div className="text-center p-8 border rounded-md">
        <p className="text-muted-foreground">Geen projecten gevonden die voldoen aan de geselecteerde filters.</p>
      </div>
    );
  }
  
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {filteredProjects.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          onClick={() => selectProject(project.id)}
          progress={calculateProjectProgress(project)}
        />
      ))}
    </div>
  );
};

export default ProjectList;
