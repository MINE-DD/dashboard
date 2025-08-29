#!/usr/bin/env bun

/**
 * Generate a TypeScript module with the manifest data embedded
 * This ensures the manifest is included in the build bundle
 */

import fs from 'fs';
import path from 'path';

const manifestPath = path.join(process.cwd(), 'static', 'data-manifest.json');
const outputPath = path.join(process.cwd(), 'src', 'lib', 'generated', 'dataManifest.ts');

// Ensure the generated directory exists
const generatedDir = path.join(process.cwd(), 'src', 'lib', 'generated');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

// Read the manifest
let manifest: any;
try {
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } else {
    // Default manifest if none exists
    manifest = {
      generated: new Date().toISOString(),
      source: 'fallback',
      files: [{
        date: '2025-08-25',
        fileName: '2025-08-25_Plan-EO_Dashboard_point_data.csv',
        size: 0,
        lastModified: '2025-08-25T00:00:00Z'
      }]
    };
  }
} catch (error) {
  console.error('Error reading manifest:', error);
  process.exit(1);
}

// Generate the TypeScript module - just the URL info, not the data
const moduleContent = `/**
 * Auto-generated data URL configuration
 * Generated at: ${new Date().toISOString()}
 * DO NOT EDIT - This file is auto-generated
 */

// Just the filename and date - the actual data is fetched at runtime
export const latestDataDate = "${manifest.latestFile?.date || manifest.files?.[0]?.date || '2025-08-25'}";
export const latestDataFile = "${manifest.latestFile?.fileName || manifest.files?.[0]?.fileName || '2025-08-25_Plan-EO_Dashboard_point_data.csv'}";
`;

// Write the module
fs.writeFileSync(outputPath, moduleContent);
console.log('✓ Generated data manifest module');
console.log(`  Latest data: ${manifest.latestFile?.date || manifest.files?.[0]?.date}`);