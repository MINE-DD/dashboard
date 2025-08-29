/**
 * Data configuration using environment variables
 * Update VITE_LATEST_DATA_DATE in .env when uploading new data
 */

const R2_BASE_URL = import.meta.env.VITE_R2_POINTS_BASE_URL || 'https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/01_Points';
const LATEST_DATA_DATE = import.meta.env.VITE_LATEST_DATA_DATE || '2025-08-25';

/**
 * Get the latest data file URL based on environment configuration
 */
export function getConfiguredDataUrl(): { url: string; date: string } {
  const fileName = `${LATEST_DATA_DATE}_Plan-EO_Dashboard_point_data.csv`;
  const url = `${R2_BASE_URL}/${fileName}`;
  
  console.log(`Using configured data file: ${fileName}`);
  
  return {
    url,
    date: LATEST_DATA_DATE
  };
}

/**
 * Check if a newer data file exists (optional enhancement)
 * This can be called when user clicks refresh
 */
export async function checkForNewerData(currentDate: string): Promise<{ url: string; date: string } | null> {
  // Generate a few dates after the current one to check
  const current = new Date(currentDate);
  const today = new Date();
  const datesToCheck: string[] = [];
  
  // Only check if current data is at least a day old
  const daysSinceData = Math.floor((today.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceData < 1) {
    return null;
  }
  
  // Check up to 10 recent dates
  for (let i = 0; i < Math.min(daysSinceData, 10); i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    datesToCheck.push(checkDate.toISOString().split('T')[0]);
  }
  
  // Check each date
  for (const date of datesToCheck) {
    if (date <= currentDate) continue;
    
    const fileName = `${date}_Plan-EO_Dashboard_point_data.csv`;
    const url = `${R2_BASE_URL}/${fileName}`;
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        console.log(`Found newer data file: ${fileName}`);
        return { url, date };
      }
    } catch {
      // Continue checking
    }
  }
  
  return null;
}