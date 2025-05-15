import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { GrippProject } from '../../types/gripp';
import { CalendarClock } from 'lucide-react';
import { Badge } from '../ui/badge';

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

  // Functie om status badge te bepalen op basis van voortgang
  const getProgressStatus = () => {
    if (progress > 100) {
      return {
        label: 'Over budget',
        variant: 'destructive' as const,
        className: ''
      };
    }

    if (progress >= 75) {
      return {
        label: 'Opletten',
        variant: 'outline' as const,
        className: 'bg-amber-100 text-amber-700 border-amber-200'
      };
    }

    return {
      label: 'Normaal',
      variant: 'outline' as const,
      className: 'bg-green-100 text-green-700 border-green-200'
    };
  };

  const progressStatus = getProgressStatus();

  // Functie om progress bar kleur te bepalen op basis van voortgang
  const getProgressBarColor = () => {
    if (progress > 100) return 'bg-red-500';
    if (progress >= 75) return 'bg-amber-500';
    return 'bg-green-500';
  };

  // Functie om de kaart achtergrondkleur te bepalen op basis van de voortgang
  const getCardBackgroundColor = () => {
    if (progress > 100) return 'bg-red-50 border-red-200';
    if (progress >= 75) return 'bg-amber-50 border-amber-200';
    return 'bg-green-50 border-green-200';
  };

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md border-0"
      onClick={() => onClick(project.id)}
    >
      <CardHeader className="pb-2 bg-white">
        <div className="flex justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-medium text-gray-800">{project.name}</CardTitle>
              <Badge
                variant={progressStatus.variant}
                className={`text-xs font-normal px-2 py-0.5 ${
                  progress > 100
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : progress >= 75
                      ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : 'bg-green-50 text-green-600 border border-green-200'
                }`}
              >
                {progressStatus.label}
              </Badge>
            </div>
            <div className="text-sm text-gray-600">{project.company?.searchname || 'Geen klant'}</div>
            {project.type && <div className="text-xs text-gray-500">Type: {project.type}</div>}
          </div>
          <div className="text-xs text-gray-500 mt-1">#{project.number}</div>
        </div>
      </CardHeader>
      <CardContent className="bg-white pt-0">
        <div className="space-y-4">
          <div className="flex items-center text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-gray-500" />
              <span>{formatDeadline()}</span>
            </div>
          </div>

          {renderTags()}

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Voortgang</span>
              <span className={
                progress > 100
                  ? 'text-red-600 font-medium'
                  : progress >= 75
                    ? 'text-amber-600 font-medium'
                    : 'text-green-600 font-medium'
              }>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" indicatorClassName={getProgressBarColor()} />
          </div>

          <div className="pt-3 border-t border-gray-100">
            <div className="flex justify-between text-xs">
              <div className="flex flex-col gap-2">
                <div>
                  <div className="text-gray-500">Budget</div>
                  <div className="text-sm font-medium text-gray-700">
                    {formatCurrency(parseFloat(project.totalexclvat || '0'))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div>
                  <div className="text-gray-500 text-right">Start uurtarief</div>
                  <div className="text-sm font-medium text-gray-700 text-right">
                    {formatCurrency(startHourlyRate)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div>
                  <div className="text-gray-500 text-right">Gerealiseerd</div>
                  <div className={`text-sm font-medium text-right ${
                    startHourlyRate > realizedHourlyRate
                      ? 'text-red-500'
                      : startHourlyRate < realizedHourlyRate
                        ? 'text-green-500'
                        : 'text-gray-700'
                  }`}>
                    {formatCurrency(realizedHourlyRate)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectCard;