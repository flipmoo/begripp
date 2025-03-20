import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { GrippProject } from '../../types/gripp';
import { EmployeeWithStats } from '../../services/employee.service';

interface ProjectStatsProps {
  projects: GrippProject[];
  employees?: EmployeeWithStats[];
}

const ProjectStats: React.FC<ProjectStatsProps> = ({ projects, employees = [] }) => {
  // Calculate project progress
  const calculateProjectProgress = (project: GrippProject) => {
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
  };

  // Filter for active projects
  const activeProjects = projects.filter(project => !project.archived);
  
  // Count projects over budget
  const projectsOverBudget = activeProjects
    .map(project => ({
      ...project,
      progress: calculateProjectProgress(project)
    }))
    .filter(project => project.progress > 100)
    .length;
  
  // Count projects over deadline
  const now = new Date();
  const projectsOverDeadline = activeProjects
    .filter(project => {
      if (!project.deadline) return false;
      try {
        const deadlineDate = new Date(project.deadline.date);
        return deadlineDate < now && !project.archived;
      } catch {
        return false;
      }
    })
    .length;
  
  // Count project types (based on phase)
  const projectTypeDistribution = activeProjects.reduce((acc, project) => {
    const phase = project.phase?.searchname || 'Onbekend';
    acc[phase] = (acc[phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Count active employees
  const activeEmployeesCount = employees.filter(employee => employee.active !== false).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Projecten Over Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-500">{projectsOverBudget}</div>
          <div className="text-sm text-gray-500">
            {((projectsOverBudget / activeProjects.length) * 100).toFixed(1)}% van alle actieve projecten
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Projecten Over Deadline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-500">{projectsOverDeadline}</div>
          <div className="text-sm text-gray-500">
            {((projectsOverDeadline / activeProjects.length) * 100).toFixed(1)}% van alle actieve projecten
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Project Type Verdeling</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(projectTypeDistribution)
              .sort(([, countA], [, countB]) => countB - countA)
              .slice(0, 3)
              .map(([phase, count]) => (
                <div key={phase} className="flex justify-between items-center">
                  <span className="text-sm">{phase}</span>
                  <span className="text-sm font-medium">{count} ({((count / activeProjects.length) * 100).toFixed(0)}%)</span>
                </div>
              ))
            }
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Actieve Medewerkers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeEmployeesCount}</div>
          <div className="text-sm text-gray-500">
            {employees.length > 0 
              ? `${((activeEmployeesCount / employees.length) * 100).toFixed(0)}% van alle medewerkers`
              : 'Medewerker gegevens laden...'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectStats; 