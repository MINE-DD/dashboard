/**
 * Client-side R2 file detector for static hosting
 * This works directly in the browser without server-side API
 */

const R2_BASE_URL = import.meta.env.VITE_R2_POINTS_BASE_URL || 'https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/01_Points';

export interface R2File {
  date: string;
  fileName: string;
  url: string;
}

/**
 * Detect available data files in R2 bucket
 * Uses an adaptive search strategy to find files regardless of age
 */
export async function detectR2Files(): Promise<R2File[]> {
  const existingFiles: R2File[] = [];
  const today = new Date();
  
  // Strategy 1: Check recent dates (last 30 days)
  const recentDates: string[] = [];
  for (let i = 0; i <= 30; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    recentDates.push(checkDate.toISOString().split('T')[0]);
  }
  
  // Check recent dates first
  const recentFiles = await checkDatesInBatches(recentDates, 5);
  if (recentFiles.length > 0) {
    return recentFiles;
  }
  
  // Strategy 2: Check monthly samples going back up to 2 years
  const monthlyDates: string[] = [];
  for (let monthsAgo = 1; monthsAgo <= 24; monthsAgo++) {
    const checkDate = new Date(today);
    checkDate.setMonth(checkDate.getMonth() - monthsAgo);
    // Check the 1st and 15th of each month
    const firstOfMonth = new Date(checkDate.getFullYear(), checkDate.getMonth(), 1);
    const midMonth = new Date(checkDate.getFullYear(), checkDate.getMonth(), 15);
    monthlyDates.push(firstOfMonth.toISOString().split('T')[0]);
    monthlyDates.push(midMonth.toISOString().split('T')[0]);
  }
  
  const monthlyFiles = await checkDatesInBatches(monthlyDates, 10);
  if (monthlyFiles.length > 0) {
    // If we found older files, do a more detailed search around those dates
    const oldestFound = monthlyFiles[monthlyFiles.length - 1];
    const newestFound = monthlyFiles[0];
    
    // Search more thoroughly between the oldest and newest found dates
    const detailedDates = await searchDateRange(
      new Date(oldestFound.date),
      new Date(newestFound.date),
      7 // Check weekly
    );
    
    const detailedFiles = await checkDatesInBatches(detailedDates, 10);
    return [...detailedFiles, ...monthlyFiles].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }).filter((file, index, self) => 
      index === self.findIndex(f => f.date === file.date)
    );
  }
  
  // Strategy 3: Known fallback dates
  const fallbackDates = [
    '2025-08-25',
    '2024-12-31',
    '2024-06-30',
    '2023-12-31'
  ];
  
  return await checkDatesInBatches(fallbackDates, 4);
}

/**
 * Helper function to check multiple dates in batches
 */
async function checkDatesInBatches(dates: string[], batchSize: number): Promise<R2File[]> {
  const existingFiles: R2File[] = [];
  
  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    
    const batchChecks = batch.map(async (date) => {
      const fileName = `${date}_Plan-EO_Dashboard_point_data.csv`;
      const fileUrl = `${R2_BASE_URL}/${fileName}`;
      
      try {
        // Use HEAD request to check if file exists
        const response = await fetch(fileUrl, { 
          method: 'HEAD',
          mode: 'cors',
          cache: 'no-cache'
        });
        
        if (response.ok) {
          return { date, fileName, url: fileUrl };
        }
      } catch {
        // File doesn't exist or CORS issue
      }
      return null;
    });
    
    const results = await Promise.all(batchChecks);
    const validResults = results.filter((r): r is R2File => r !== null);
    existingFiles.push(...validResults);
    
    // For recent dates, stop early if we found files
    if (existingFiles.length > 0 && i < 30) {
      break;
    }
  }
  
  // Sort by date (newest first)
  existingFiles.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });
  
  return existingFiles;
}

/**
 * Generate dates between start and end with given day intervals
 */
function searchDateRange(start: Date, end: Date, dayInterval: number): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + dayInterval);
  }
  
  return dates;
}

/**
 * Get the latest data file URL
 * Returns the most recent file or a fallback
 */
export async function getLatestDataFileUrl(): Promise<{ url: string; date: string }> {
  console.log('Detecting latest data file from R2...');
  
  try {
    const files = await detectR2Files();
    
    if (files.length > 0) {
      const latest = files[0];
      console.log(`✓ Found latest data file: ${latest.fileName}`);
      return { url: latest.url, date: latest.date };
    }
  } catch (error) {
    console.error('Error detecting R2 files:', error);
  }
  
  // Fallback to known file
  const fallbackDate = '2025-08-25';
  const fallbackUrl = `${R2_BASE_URL}/${fallbackDate}_Plan-EO_Dashboard_point_data.csv`;
  console.log('Using fallback data file');
  return { url: fallbackUrl, date: fallbackDate };
}