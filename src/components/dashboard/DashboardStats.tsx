import React from 'react';
import { Card, CardContent } from '../ui/card';
import { GrippProject } from '../../types/gripp';
import { EmployeeWithStats } from '../../services/employee.service';
import { BarChart3, DollarSign, Users, AlertTriangle, PieChart, AlertCircle, Tag } from 'lucide-react';

interface DashboardStatsProps {
  projects: GrippProject[];
  employees?: EmployeeWithStats[];
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ projects, employees = [] }) => {
  // Filter voor actieve projecten
  const activeProjects = projects.filter(project => !project.archived);
  
  // Filter projecten met tag "Vaste prijs"
  const projectsWithFixedPrice = activeProjects.filter(project => {
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
  });
  
  // Bereken gemiddeld start uurtarief en gerealiseerd uurtarief voor vaste prijs projecten
  let totalBudget = 0;
  let totalWrittenHours = 0;
  let totalBudgetedHours = 0;
  
  projectsWithFixedPrice.forEach(project => {
    const budget = parseFloat(project.totalexclvat || '0');
    totalBudget += budget;
    
    if (project.projectlines && Array.isArray(project.projectlines)) {
      const writtenHours = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
      totalWrittenHours += writtenHours;
      
      const budgetedHours = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amount ? line.amount : 0), 0);
      totalBudgetedHours += budgetedHours;
    }
  });
  
  const averageStartRate = totalBudgetedHours > 0 ? totalBudget / totalBudgetedHours : 0;
  const averageRealizedRate = totalWrittenHours > 0 ? totalBudget / totalWrittenHours : 0;
  
  // Bereken verlopen deadlines
  const now = new Date();
  const projectsOverDeadline = activeProjects.filter(project => {
    if (!project.deadline) return false;
    try {
      const deadlineDate = new Date(project.deadline.date);
      return deadlineDate < now;
    } catch {
      return false;
    }
  });
  
  // Bereken projecten over budget
  const projectsOverBudget = activeProjects
    .map(project => {
      if (!project.projectlines || !Array.isArray(project.projectlines)) return { ...project, progress: 0 };
      
      try {
        const written = project.projectlines.reduce((sum, line) => 
          sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
        const budgeted = project.projectlines.reduce((sum, line) => 
          sum + (line && line.amount ? line.amount : 0), 0);
        return { ...project, progress: budgeted > 0 ? (written / budgeted) * 100 : 0 };
      } catch (error) {
        console.error('Error calculating project progress:', error);
        return { ...project, progress: 0 };
      }
    })
    .filter(project => project.progress > 100);
  
  // Bereken totale waarde
  const totalValue = activeProjects.reduce((sum, project) => 
    sum + parseFloat(project.totalexclvat || '0'), 0);
  
  // Bereken actieve medewerkers
  const activeEmployeesCount = employees.filter(employee => employee.active !== false).length;
  
  // Bereken gemiddelde projectwaarde
  const averageProjectValue = activeProjects.length > 0 
    ? totalValue / activeProjects.length 
    : 0;
  
  // Statistieken array
  const stats = [
    {
      title: 'Totaal projecten',
      value: activeProjects.length,
      icon: <BarChart3 className="h-5 w-5 text-blue-500" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Verlopen deadlines',
      value: projectsOverDeadline.length,
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      color: 'text-red-500',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Over budget',
      value: projectsOverBudget.length,
      icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'Totale waarde',
      value: `€ ${totalValue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`,
      icon: <DollarSign className="h-5 w-5 text-purple-500" />,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Start uurtarief (vaste prijs)',
      value: `€ ${averageStartRate.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <Tag className="h-5 w-5 text-green-500" />,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      tooltip: 'Gemiddeld start uurtarief voor projecten met tag "Vaste prijs"'
    },
    {
      title: 'Gerealiseerd uurtarief (vaste prijs)',
      value: `€ ${averageRealizedRate.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <Tag className="h-5 w-5 text-blue-500" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      tooltip: 'Gemiddeld gerealiseerd uurtarief voor projecten met tag "Vaste prijs"'
    },
    {
      title: 'Actieve medewerkers',
      value: activeEmployeesCount,
      icon: <Users className="h-5 w-5 text-green-500" />,
      color: 'text-green-500',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Gem. projectwaarde',
      value: `€ ${averageProjectValue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`,
      icon: <PieChart className="h-5 w-5 text-blue-500" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, index) => (
        <Card key={index} className="border-none shadow-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`p-2 rounded-full ${stat.bgColor}`}>
              {stat.icon}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-gray-500 truncate">{stat.title}</p>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DashboardStats; 