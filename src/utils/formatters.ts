/**
 * Utility functions for formatting data
 */

/**
 * Format a date string to a localized date string
 * @param dateString Date string in ISO format
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  if (!dateString) return 'Onbekend';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}

/**
 * Format a number as currency (Euro)
 * @param value Number to format
 * @param compact Whether to use compact notation for large numbers
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, compact: boolean = false): string {
  if (value === undefined || value === null) return '€ 0,00';

  try {
    if (compact && Math.abs(value) >= 10000) {
      // Voor grote bedragen, gebruik compacte notatie (bijv. € 1,2 mln)
      return new Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency: 'EUR',
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(value);
    } else {
      // Voor normale bedragen, gebruik standaard notatie
      return new Intl.NumberFormat('nl-NL', {
        style: 'currency',
        currency: 'EUR'
      }).format(value);
    }
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `€ ${value.toFixed(2)}`;
  }
}

/**
 * Format a number as hours
 * @param hours Number of hours
 * @returns Formatted hours string
 */
export function formatHours(hours: number): string {
  if (hours === undefined || hours === null) return '0 uur';

  try {
    return `${hours.toFixed(1)} uur`;
  } catch (error) {
    console.error('Error formatting hours:', error);
    return `${hours} uur`;
  }
}

/**
 * Format a percentage
 * @param value Percentage value (0-100)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number): string {
  if (value === undefined || value === null) return '0%';

  try {
    return `${value.toFixed(1)}%`;
  } catch (error) {
    console.error('Error formatting percentage:', error);
    return `${value}%`;
  }
}

/**
 * Helper function to fetch project details
 * @param id Project ID
 * @returns Project details
 */
export async function fetchProjectDetails(id: number) {
  try {
    const response = await fetch(`/api/dashboard/projects/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch project details: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching project details:', error);
    throw error;
  }
}
