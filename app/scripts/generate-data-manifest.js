#!/usr/bin/env node

/**
 * Script to generate manifest.json for data files in the 01_Points directory
 * Run this script whenever new data files are added:
 * node scripts/generate-data-manifest.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the data directory
const dataDir = path.join(__dirname, '..', 'static', 'data', '01_Points');
const manifestPath = path.join(dataDir, 'manifest.json');

// Function to format date for display
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-US', options);
}

// Read directory and filter CSV files
try {
  const files = fs.readdirSync(dataDir);
  
  // Filter and process CSV files matching the pattern
  const dataFiles = files
    .filter(file => file.match(/^\d{4}-\d{2}-\d{2}_Plan-EO_Dashboard_point_data\.csv$/))
    .map(filename => {
      const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : null;
      
      return {
        filename,
        date,
        displayDate: date ? formatDate(date) : 'Unknown Date'
      };
    })
    .filter(file => file.date !== null)
    .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
  
  // Create manifest object
  const manifest = {
    dataFiles,
    lastUpdated: new Date().toISOString(),
    generatedBy: 'generate-data-manifest.js'
  };
  
  // Write manifest file
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`✅ Manifest generated successfully at: ${manifestPath}`);
  console.log(`📊 Found ${dataFiles.length} data files:`);
  dataFiles.forEach(file => {
    console.log(`   - ${file.filename} (${file.displayDate})`);
  });
  
} catch (error) {
  console.error('❌ Error generating manifest:', error);
  process.exit(1);
}