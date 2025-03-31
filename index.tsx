import React, { useEffect } from 'react';

// Listen for refresh events from child components
useEffect(() => {
  const handleRefreshEvent = (event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('Received refresh event from child component:', customEvent.detail);
    
    // Just use the regular refresh
    loadDashboardData();
  };
  
  // Add event listener
  window.addEventListener('refresh-dashboard-data', handleRefreshEvent);
  
  // Clean up
  return () => {
    window.removeEventListener('refresh-dashboard-data', handleRefreshEvent);
  };
}, [loadDashboardData]); 