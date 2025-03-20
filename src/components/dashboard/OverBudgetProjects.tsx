import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { GrippProject } from '../../types/gripp';
import { useNavigate } from 'react-router-dom';

interface OverBudgetProjectsProps {
  projects: GrippProject[];
}

const OverBudgetProjects: React.FC<OverBudgetProjectsProps> = ({ projects }) => {
  const navigate = useNavigate();
  
  // Format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString('nl-NL', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };
  
  // Check if a project has "Vaste prijs" tag
  const hasFixedPriceTag = (project: GrippProject) => {
    if (!project.tags) return false;
    
    // Als tags een string is (JSON formaat), probeer te parsen
    if (typeof project.tags === 'string') {
      try {
        const parsedTags = JSON.parse(project.tags);
        return parsedTags.some((tag: { searchname?: string; name?: string }) => 
          (tag.searchname === "Vaste prijs") || (tag.name === "Vaste prijs")
        );
      } catch (error) {
        console.error('Error parsing tags JSON:', error);
        return false;
      }
    } 
    // Als tags een array is, gebruik direct
    else if (Array.isArray(project.tags)) {
      return project.tags.some(tag => {
        if (typeof tag === 'string') return tag === "Vaste prijs";
        return (tag.searchname === "Vaste prijs") || (tag.name === "Vaste prijs");
      });
    }
    return false;
  };
  
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
  
  // Calculate project hourly rates
  const calculateProjectRates = (project: GrippProject) => {
    if (!project.projectlines || !Array.isArray(project.projectlines)) {
      return { startHourlyRate: 0, realizedHourlyRate: 0 };
    }
    
    try {
      const totalBudget = parseFloat(project.totalexclvat || '0');
      const totalBudgetedHours = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amount ? line.amount : 0), 0);
      const totalWrittenHours = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
      
      const startHourlyRate = totalBudgetedHours > 0 ? totalBudget / totalBudgetedHours : 0;
      const realizedHourlyRate = totalWrittenHours > 0 
        ? Math.min(totalBudget / totalWrittenHours, startHourlyRate) 
        : 0;
      
      return { startHourlyRate, realizedHourlyRate };
    } catch (error) {
      console.error('Error calculating project rates:', error);
      return { startHourlyRate: 0, realizedHourlyRate: 0 };
    }
  };

  // Get projects that are over budget (progress > 100%) and have fixed price
  const overBudgetProjects = projects
    .filter(project => !project.archived && hasFixedPriceTag(project))
    .map(project => ({
      ...project,
      progress: calculateProjectProgress(project),
      ...calculateProjectRates(project)
    }))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 10);

  const handleProjectClick = (projectId: number) => {
    navigate(`/projects/${projectId}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 10 Vaste Prijs Projecten</CardTitle>
      </CardHeader>
      <CardContent>
        {overBudgetProjects.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            Geen vaste prijs projecten gevonden
          </div>
        ) : (
          <div className="space-y-4">
            {overBudgetProjects.map(project => (
              <div 
                key={project.id} 
                className="space-y-1 cursor-pointer hover:bg-gray-50 p-2 rounded-md"
                onClick={() => handleProjectClick(project.id)}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{project.name}</span>
                  <span className={`font-medium ${project.progress > 100 ? 'text-red-500' : 'text-green-500'}`}>
                    {Math.round(project.progress)}%
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  <span>{project.company?.searchname || 'Onbekende klant'}</span>
                </div>
                <Progress 
                  value={Math.min(project.progress, 100)} 
                  className="h-2 bg-gray-200" 
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Budget: {formatCurrency(parseFloat(project.totalexclvat || '0'))}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Start: {formatCurrency(project.startHourlyRate)}</span>
                  <span>Gerealiseerd: {formatCurrency(project.realizedHourlyRate)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OverBudgetProjects; 