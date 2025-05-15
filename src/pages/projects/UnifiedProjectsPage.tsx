/**
 * UnifiedProjectsPage Component
 * 
 * This component serves as a wrapper around the existing ProjectsPage component
 * to maintain compatibility with the unified data structure approach.
 */

import React from 'react';
import ProjectsPage from './ProjectsPage';

const UnifiedProjectsPage: React.FC = () => {
  return <ProjectsPage />;
};

export default UnifiedProjectsPage;
