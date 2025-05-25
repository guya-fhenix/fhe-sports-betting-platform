/**
 * Utility functions for handling time conversions between UTC (blockchain) and local time (UI)
 */

/**
 * Converts a UTC timestamp (in seconds) from blockchain to a formatted local date string
 * @param utcTimestamp - UTC timestamp in seconds from blockchain
 * @returns Formatted date string in local time zone
 */
export function formatBlockchainDateToLocal(utcTimestamp: number): string {
  try {
    if (!utcTimestamp || isNaN(utcTimestamp) || utcTimestamp <= 0) {
      return 'Invalid date';
    }
    
    // Create date from UTC timestamp
    const utcDate = new Date(utcTimestamp * 1000);
    
    if (isNaN(utcDate.getTime())) {
      return 'Invalid date';
    }
    
    // Format in local time zone with time zone indicator
    return utcDate.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short' // Show time zone name to indicate local time
    });
  } catch (error) {
    console.error('Error formatting blockchain date:', error);
    return 'Invalid date';
  }
}

/**
 * Converts a local date to a UTC timestamp (in seconds) for blockchain
 * @param localDate - Date object in local time
 * @returns UTC timestamp in seconds for blockchain
 */
export function convertLocalDateToBlockchainTime(localDate: Date): number {
  if (isNaN(localDate.getTime())) {
    throw new Error('Invalid date provided');
  }
  
  // Convert to Unix timestamp (seconds)
  const utcTimestamp = Math.floor(localDate.getTime() / 1000);
  
  // Simple logging
  console.log(`Converting to blockchain time: ${localDate.toLocaleString()} -> ${utcTimestamp}`);
  
  return utcTimestamp;
}

/**
 * Gets the current UTC timestamp in seconds for blockchain
 * @returns Current UTC timestamp in seconds
 */
export function getCurrentBlockchainTime(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Checks if a timestamp is in the future (with optional buffer time)
 * @param utcTimestamp - UTC timestamp in seconds
 * @param bufferSeconds - Optional buffer time in seconds
 * @returns boolean indicating if time is in the future
 */
export function isTimestampInFuture(utcTimestamp: number, bufferSeconds = 0): boolean {
  const currentTime = getCurrentBlockchainTime();
  return utcTimestamp > (currentTime + bufferSeconds);
}

/**
 * Formats a Date object for use in datetime-local input (in local timezone)
 * HTML datetime-local inputs need format: YYYY-MM-DDTHH:MM
 * @param date - The Date object to format
 * @returns String formatted for datetime-local input
 */
export function formatDateForLocalInput(date: Date): string {
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }
  
  // Format using padded local date parts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  // Format as YYYY-MM-DDTHH:MM (required format for datetime-local inputs)
  const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`;
  
  // Simple debug logging
  console.log(`Formatting date for input: ${date.toLocaleString()} -> ${formattedDate}`);
  
  return formattedDate;
} 