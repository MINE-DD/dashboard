import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const R2_BASE_URL = import.meta.env.VITE_R2_POINTS_BASE_URL;

export const GET: RequestHandler = async () => {
  try {
    // For public R2 buckets, we'll dynamically check for recent files
    // since R2 doesn't expose directory listing for public buckets
    
    // Try to fetch a manifest file first (if one exists)
    const manifestUrl = `${R2_BASE_URL}/manifest.json`;
    
    try {
      const manifestResponse = await fetch(manifestUrl);
      
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        return json(manifest);
      }
    } catch (manifestError) {
      // Manifest doesn't exist, fall back to checking dates
    }
    
    // Generate dates for the last 60 days to check
    const datesToCheck: string[] = [];
    const today = new Date();
    
    for (let i = 0; i <= 60; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      datesToCheck.push(dateStr);
    }
    
    // Also add some historical dates we know might exist
    const historicalDates = ['2025-07-31', '2025-06-30', '2025-05-31'];
    datesToCheck.push(...historicalDates);
    
    // Check files in batches to avoid too many concurrent requests
    const existingFiles: any[] = [];
    const batchSize = 10;
    
    for (let i = 0; i < datesToCheck.length; i += batchSize) {
      const batch = datesToCheck.slice(i, i + batchSize);
      
      const batchChecks = batch.map(async (date) => {
        const fileName = `${date}_Plan-EO_Dashboard_point_data.csv`;
        const fileUrl = `${R2_BASE_URL}/${fileName}`;
        
        try {
          // Use HEAD request to check if file exists without downloading it
          const response = await fetch(fileUrl, { method: 'HEAD' });
          if (response.ok) {
            return { date, fileName, url: fileUrl };
          }
        } catch {
          // File doesn't exist
        }
        return null;
      });
      
      const results = await Promise.all(batchChecks);
      const validResults = results.filter(Boolean);
      existingFiles.push(...validResults);
      
      // Stop checking once we find at least 3 files or have checked recent dates
      if (existingFiles.length >= 3 || i >= 30) {
        break;
      }
    }
    
    // Sort by date (newest first) - using proper date comparison
    existingFiles.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
    
    if (existingFiles.length > 0) {
      console.log(`Found ${existingFiles.length} files in R2. Latest: ${existingFiles[0]?.fileName}`);
      return json({
        files: existingFiles,
        source: 'detected',
        lastChecked: new Date().toISOString()
      });
    }
    
    // If no files found, return a default file that should exist
    console.log('No files found in R2, using default');
    return json({
      files: [{
        date: '2025-08-25',
        fileName: '2025-08-25_Plan-EO_Dashboard_point_data.csv',
        url: `${R2_BASE_URL}/2025-08-25_Plan-EO_Dashboard_point_data.csv`
      }],
      source: 'default',
      lastChecked: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error listing R2 files:', error);
    return json({ error: 'Failed to list files from R2' }, { status: 500 });
  }
};