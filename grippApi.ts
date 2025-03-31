/**
 * Haal actieve projecten op van de API
 */
export const fetchActiveProjects = async (queryParams = ''): Promise<GrippProject[]> => {
  try {
    console.log(`Fetching active projects with params: ${queryParams}`);
    
    // Add a timestamp to prevent caching
    const timestamp = Date.now();
    const url = `/dashboard/projects/active${queryParams}${
      queryParams.includes('?') ? '&' : '?'
    }_t=${timestamp}`;
    
    const response = await dashboardApi.get(url);

    if (!response.data) {
      throw new Error('No data received from API');
    }

    const projects = response.data.response;
    
    console.log(`Received ${projects.length} active projects from API`);
    
    // Process projects
    return projects.map(transformGrippProject);
  } catch (error) {
    console.error('Error fetching active projects:', error);
    throw error;
  }
}; 