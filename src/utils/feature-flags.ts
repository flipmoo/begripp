// Define all available feature flags
export type FeatureFlag = 
  | 'ENABLE_DATA_VALIDATION'  // Controls validation dashboard visibility
  | 'ENABLE_DATA_CORRECTION'  // Controls data correction feature
  | 'ENABLE_EXPERIMENTAL_UI'  // Controls experimental UI elements
  | 'ENABLE_DEBUG_TOOLS'      // Controls debug tools visibility
  | 'ENABLE_PERFORMANCE_MONITORING'; // Controls performance monitoring

// Feature flag configuration
// This could be loaded from an API in a real-world scenario
const featureFlags: Record<FeatureFlag, boolean> = {
  ENABLE_DATA_VALIDATION: true,
  ENABLE_DATA_CORRECTION: true,
  ENABLE_EXPERIMENTAL_UI: false, 
  ENABLE_DEBUG_TOOLS: process.env.NODE_ENV === 'development',
  ENABLE_PERFORMANCE_MONITORING: true
};

/**
 * Check if a feature is enabled
 * @param flag The feature flag to check
 * @returns true if the feature is enabled, false otherwise
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag] === true;
}

/**
 * Set a feature flag status (usually only for development/testing)
 * @param flag The feature flag to set
 * @param enabled The new status
 */
export function setFeatureFlag(flag: FeatureFlag, enabled: boolean): void {
  // Only allow setting flags in development mode
  if (process.env.NODE_ENV !== 'production') {
    featureFlags[flag] = enabled;
  } else {
    console.warn('Feature flags cannot be modified in production mode');
  }
}

/**
 * Get all feature flags and their status
 * @returns A record of all feature flags and their current status
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  return { ...featureFlags };
}

/**
 * Reset all feature flags to their default values
 */
export function resetFeatureFlags(): void {
  featureFlags.ENABLE_DATA_VALIDATION = true;
  featureFlags.ENABLE_DATA_CORRECTION = true;
  featureFlags.ENABLE_EXPERIMENTAL_UI = false;
  featureFlags.ENABLE_DEBUG_TOOLS = process.env.NODE_ENV === 'development';
  featureFlags.ENABLE_PERFORMANCE_MONITORING = true;
} 