/**
 * Build-time script to fetch the list of available data files from R2
 * This runs during build and generates a manifest file
 */

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

// Configuration from environment variables
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'mine-dd-data';
const R2_PREFIX = '01_Points/';
const R2_PUBLIC_URL = process.env.VITE_R2_POINTS_BASE_URL || 'https://pub-6e8836a7d8be4fd1adc1317bb416ad75.r2.dev/01_Points';

/**
 * Try to detect files using public HTTP requests (no credentials needed)
 */
async function detectPublicFiles(): Promise<any[]> {
  console.log('Detecting files from public R2 URL...');
  const files: any[] = [];
  const today = new Date();
  
  // Check the last 60 days
  const datesToCheck: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    datesToCheck.push(checkDate.toISOString().split('T')[0]);
  }
  
  // Check in batches
  const batchSize = 10;
  for (let i = 0; i < datesToCheck.length; i += batchSize) {
    const batch = datesToCheck.slice(i, i + batchSize);
    
    const batchChecks = batch.map(async (date) => {
      const fileName = `${date}_Plan-EO_Dashboard_point_data.csv`;
      const url = `${R2_PUBLIC_URL}/${fileName}`;
      
      try {
        // Use HEAD request to check if file exists
        const response = await fetch(url, { 
          method: 'HEAD',
          mode: 'cors'
        });
        
        if (response.ok) {
          const size = parseInt(response.headers.get('content-length') || '0');
          const lastModified = response.headers.get('last-modified') || '';
          
          return {
            date,
            fileName,
            size,
            lastModified: lastModified ? new Date(lastModified).toISOString() : date + 'T00:00:00Z'
          };
        }
      } catch {
        // File doesn't exist or network error
      }
      return null;
    });
    
    const results = await Promise.all(batchChecks);
    const validResults = results.filter(r => r !== null);
    files.push(...validResults);
    
    // Stop after finding at least 5 files
    if (files.length >= 5) {
      break;
    }
  }
  
  return files.sort((a, b) => b.date.localeCompare(a.date));
}

async function fetchR2Manifest() {
  // Try authenticated API first if credentials are provided
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
    console.log('Using R2 credentials to fetch manifest...');
    try {
      await fetchWithCredentials();
      return;
    } catch (error) {
      console.error('Failed to fetch with credentials:', error);
      console.log('Falling back to public detection...');
    }
  }
  
  // Fallback to public detection (works for local dev)
  try {
    const files = await detectPublicFiles();
    
    if (files.length > 0) {
      const manifest = {
        generated: new Date().toISOString(),
        source: 'public-detection',
        latestFile: files[0],
        files: files.slice(0, 10)
      };
      
      writeManifest(manifest);
      console.log(`✓ Detected ${files.length} files from public R2`);
      console.log(`  Latest: ${files[0]?.fileName} (${files[0]?.date})`);
      return;
    }
  } catch (error) {
    console.error('Public detection failed:', error);
  }
  
  // Ultimate fallback
  console.log('Using fallback manifest');
  const fallbackManifest = {
    generated: new Date().toISOString(),
    source: 'fallback',
    files: [{
      date: '2025-08-25',
      fileName: '2025-08-25_Plan-EO_Dashboard_point_data.csv',
      size: 0,
      lastModified: '2025-08-25T00:00:00Z'
    }]
  };
  
  writeManifest(fallbackManifest);
}

async function fetchWithCredentials() {
  // Configure S3 client for R2
  const client = new S3Client({
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: "auto",
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!
    }
  });

    // List objects in the bucket
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: R2_PREFIX,
      MaxKeys: 100
    });

    const response = await client.send(command);
    
    if (!response.Contents || response.Contents.length === 0) {
      console.error('No files found in R2 bucket');
      return;
    }

    // Parse and sort the files
    const files = response.Contents
      .filter(obj => obj.Key?.endsWith('.csv'))
      .map(obj => {
        const fileName = obj.Key?.replace(R2_PREFIX, '') || '';
        // Extract date from filename (format: YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv)
        const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
        const date = dateMatch ? dateMatch[1] : '';
        
        return {
          date,
          fileName,
          size: obj.Size || 0,
          lastModified: obj.LastModified?.toISOString() || ''
        };
      })
      .filter(file => file.date) // Only include files with valid dates
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending

    // Create manifest
    const manifest = {
      generated: new Date().toISOString(),
      source: 'r2',
      latestFile: files[0],
      files: files.slice(0, 10) // Keep only the 10 most recent files
    };

    writeManifest(manifest);
    
    console.log(`✓ R2 manifest generated with ${files.length} files`);
    console.log(`  Latest: ${files[0]?.fileName} (${files[0]?.date})`);
}

function writeManifest(manifest: any) {
  // Write to static directory so it's included in the build
  const outputPath = path.join(process.cwd(), 'static', 'data-manifest.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  
  // Also update the .env file with the latest date
  if (manifest.files && manifest.files.length > 0) {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      const latestDate = manifest.files[0].date;
      
      if (envContent.includes('VITE_LATEST_DATA_DATE=')) {
        envContent = envContent.replace(
          /VITE_LATEST_DATA_DATE=.*/,
          `VITE_LATEST_DATA_DATE=${latestDate}`
        );
      } else {
        envContent += `\nVITE_LATEST_DATA_DATE=${latestDate}`;
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log(`  Updated VITE_LATEST_DATA_DATE to ${latestDate}`);
    }
  }
}

// Run the script
fetchR2Manifest();