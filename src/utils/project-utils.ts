import { GrippProject } from '../types/gripp';

/**
 * Calculate the progress percentage of a project based on its project lines
 * 
 * @param project The project to calculate progress for
 * @returns The progress percentage (0-100+)
 */
export const calculateProjectProgress = (project: GrippProject): number => {
  // Parse projectlines als het een string is
  let projectLines = [];
  if (project.projectlines) {
    if (typeof project.projectlines === 'string') {
      try {
        projectLines = JSON.parse(project.projectlines);
      } catch (error) {
        console.error(`Error parsing projectlines for project ${project.id}:`, error);
        return 0;
      }
    } else if (Array.isArray(project.projectlines)) {
      projectLines = project.projectlines;
    }
  }

  if (!projectLines || projectLines.length === 0) {
    return 0;
  }

  try {
    const written = projectLines.reduce((sum, line) =>
      sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
    const budgeted = projectLines.reduce((sum, line) =>
      sum + (line && line.amount ? line.amount : 0), 0);

    return budgeted > 0 ? (written / budgeted) * 100 : 0;
  } catch (error) {
    console.error(`Error calculating project progress for project ${project.id}:`, error);
    return 0;
  }
};

/**
 * Calculate the hourly rates for a project
 * 
 * @param project The project to calculate rates for
 * @returns Object with startHourlyRate and realizedHourlyRate
 */
export const calculateProjectRates = (project: GrippProject): { startHourlyRate: number, realizedHourlyRate: number } => {
  // Parse projectlines als het een string is
  let projectLines = [];
  if (project.projectlines) {
    if (typeof project.projectlines === 'string') {
      try {
        projectLines = JSON.parse(project.projectlines);
      } catch (error) {
        console.error(`Error parsing projectlines for project ${project.id}:`, error);
        return { startHourlyRate: 0, realizedHourlyRate: 0 };
      }
    } else if (Array.isArray(project.projectlines)) {
      projectLines = project.projectlines;
    }
  }

  if (!projectLines || projectLines.length === 0) {
    return { startHourlyRate: 0, realizedHourlyRate: 0 };
  }

  try {
    const totalBudget = parseFloat(project.totalexclvat || '0');
    const totalBudgetedHours = projectLines.reduce((sum, line) =>
      sum + (line && line.amount ? line.amount : 0), 0);
    const totalWrittenHours = projectLines.reduce((sum, line) =>
      sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
    
    const startHourlyRate = totalBudgetedHours > 0 ? totalBudget / totalBudgetedHours : 0;
    const realizedHourlyRate = totalWrittenHours > 0 
      ? Math.min(totalBudget / totalWrittenHours, startHourlyRate) 
      : 0;
    
    return { startHourlyRate, realizedHourlyRate };
  } catch (error) {
    console.error(`Error calculating project rates for project ${project.id}:`, error);
    return { startHourlyRate: 0, realizedHourlyRate: 0 };
  }
};
