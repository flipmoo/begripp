/**
 * Format utilities
 * Contains functions for formatting values like currency, dates, etc.
 */

/**
 * Format a number as currency (Euro)
 * @param value Number to format
 * @param locale Locale to use for formatting (default: nl-NL)
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number, locale = 'nl-NL'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Format a date as a string
 * @param date Date to format
 * @param locale Locale to use for formatting (default: nl-NL)
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string,
  locale = 'nl-NL',
  options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(dateObj);
};

/**
 * Format a number as a percentage
 * @param value Number to format as percentage
 * @param locale Locale to use for formatting (default: nl-NL)
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number,
  locale = 'nl-NL',
  decimals = 0
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value / 100);
};

/**
 * Format a number with thousand separators
 * @param value Number to format
 * @param locale Locale to use for formatting (default: nl-NL)
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted number string
 */
export const formatNumber = (
  value: number,
  locale = 'nl-NL',
  decimals = 0
): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

/**
 * Format hours as a string (e.g. "8:30")
 * @param hours Number of hours (can include decimals)
 * @returns Formatted hours string
 */
export const formatHours = (hours: number): string => {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
};
