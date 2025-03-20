import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { GrippProject } from '../../types/gripp';
import { CalendarClock } from 'lucide-react';

// Extend Window interface to allow our custom property
declare global {
  interface Window {
    hasLoggedTags?: boolean;
  }
}

interface ProjectCardProps {
  project: GrippProject;
  onClick: (id: number) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
  // Bereken project voortgang
  const calculateProgress = () => {
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

  const progress = calculateProgress();
  
  // Format deadline
  const formatDeadline = () => {
    if (!project.deadline) return 'Geen deadline';
    
    try {
      const deadlineDate = new Date(project.deadline.date);
      return deadlineDate.toLocaleDateString('nl-NL', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting deadline:', error);
      return 'Ongeldige datum';
    }
  };

  // Bepaal card kleur op basis van project kleur of voortgang
  const getCardStyle = () => {
    if (project.color) {
      return { borderTop: `4px solid ${project.color}` };
    }
    
    // Fallback naar voortgang kleur
    if (progress > 90) return { borderTop: '4px solid #ef4444' }; // Rood
    if (progress > 75) return { borderTop: '4px solid #f97316' }; // Oranje
    if (progress > 50) return { borderTop: '4px solid #eab308' }; // Geel
    return { borderTop: '4px solid #22c55e' }; // Groen
  };

  // Bereken start uurtarief (totaal bedrag / gebudgetteerde uren)
  const calculateStartHourlyRate = () => {
    if (!project.projectlines || !Array.isArray(project.projectlines)) return 0;
    
    try {
      const totalBudget = parseFloat(project.totalexclvat || '0');
      const budgetedHours = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amount ? line.amount : 0), 0);
      
      return budgetedHours > 0 ? totalBudget / budgetedHours : 0;
    } catch (error) {
      console.error('Error calculating start hourly rate:', error);
      return 0;
    }
  };

  // Bereken gerealiseerd uurtarief (totaal bedrag / geschreven uren)
  const calculateRealizedHourlyRate = () => {
    if (!project.projectlines || !Array.isArray(project.projectlines)) return 0;
    
    try {
      const totalBudget = parseFloat(project.totalexclvat || '0');
      const writtenHours = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
      
      return writtenHours > 0 ? totalBudget / writtenHours : 0;
    } catch (error) {
      console.error('Error calculating realized hourly rate:', error);
      return 0;
    }
  };

  const startHourlyRate = calculateStartHourlyRate();
  const realizedHourlyRate = calculateRealizedHourlyRate();

  // Format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString('nl-NL', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Debug tags - alleen de eerste keer om console spam te vermijden
  React.useEffect(() => {
    // Controleer of het de eerste keer is dat we dit loggen
    if (!window.hasLoggedTags && project.id) {
      console.log(`Project ${project.name} (${project.id}) tags:`, project.tags);
      console.log('Tags data structure:', project.tags ? JSON.stringify(project.tags) : 'undefined');
      console.log('Tags type:', project.tags ? typeof project.tags : 'undefined');
      console.log('Is array:', project.tags ? Array.isArray(project.tags) : 'undefined');
      // Voorkom dat we het meerdere keren loggen
      window.hasLoggedTags = true;
    }
  }, [project.id, project.name, project.tags]);

  // Alternatieve implementatie als tags niet in het verwachte formaat zijn
  const renderTags = () => {
    if (!project.tags) return null;
    
    // Definieer een type voor de tag objecten
    type TagObject = {
      id?: string | number;
      searchname?: string;
      name?: string;
      color?: string;
      [key: string]: unknown;
    };
    
    let tagsArray: TagObject[] = [];
    
    // Als tags een string is, probeer het te parsen als JSON
    if (typeof project.tags === 'string') {
      try {
        tagsArray = JSON.parse(project.tags);
      } catch (error) {
        console.error('Failed to parse tags JSON:', error);
        return null;
      }
    } 
    // Als tags al een array is, gebruik het direct
    else if (Array.isArray(project.tags)) {
      tagsArray = project.tags;
    }
    // Als tags een object is maar geen array, controleer of het een enkele tag is
    else if (typeof project.tags === 'object' && project.tags !== null) {
      // Als het een enkel object is, zet het in een array
      tagsArray = [project.tags];
    }
    
    // Als er geen tags zijn, toon niets
    if (!tagsArray.length) return null;

    return (
      <div className="flex flex-wrap gap-1.5">
        {tagsArray.map((tag, index) => {
          // Controleer eerst of tag een object of een string is
          const tagId = typeof tag === 'object' && tag !== null ? (tag.id || index) : index;
          let tagName = '';
          let tagColor = null;
          
          if (typeof tag === 'string') {
            tagName = tag;
          } else if (typeof tag === 'object' && tag !== null) {
            // Probeer alle mogelijke veldnamen voor de naam van de tag
            tagName = tag.searchname || tag.name || String(tagId);
            
            // Als het object andere eigenschappen heeft, probeer die te gebruiken
            if (!tagName && typeof tag === 'object') {
              const tagObj = tag as Record<string, unknown>;
              const tagValue = tagObj.tag || tagObj.value;
              if (tagValue !== undefined) {
                tagName = String(tagValue);
              }
            }
            
            tagColor = tag.color || null;
          }
          
          return (
            <span 
              key={tagId} 
              className="inline-block px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded-full"
              style={tagColor ? { backgroundColor: `${tagColor}20`, color: tagColor } : {}}
            >
              {tagName}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      style={getCardStyle()}
      onClick={() => onClick(project.id)}
    >
      <CardHeader className="pb-2">
        <div>
          <CardTitle className="text-xl font-medium mb-1">{project.name}</CardTitle>
          <div className="text-base text-gray-700">{project.company?.searchname || 'Geen klant'}</div>
        </div>
        <div className="text-sm text-gray-500 mt-1">#{project.number}</div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center text-sm">
            <div className="flex items-center gap-1">
              <CalendarClock className="h-4 w-4 text-gray-500" />
              <span>{formatDeadline()}</span>
            </div>
          </div>
          
          {renderTags()}
          
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Voortgang</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          <div className="text-sm">
            <div className="flex justify-between">
              <span>Budget</span>
              <span className="font-medium">
                € {parseFloat(project.totalexclvat || '0').toLocaleString('nl-NL', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </span>
            </div>

            <div className="flex justify-between mt-1">
              <span>Start uurtarief</span>
              <span className="font-medium">{formatCurrency(startHourlyRate)}</span>
            </div>

            <div className="flex justify-between mt-1">
              <span>Gerealiseerd uurtarief</span>
              <span className="font-medium">{formatCurrency(realizedHourlyRate)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectCard; 