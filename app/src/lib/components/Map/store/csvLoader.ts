// Import Papa Parse with compatibility for different module systems
let Papa: any;
try {
  // @ts-ignore - Special handling for CommonJS/UMD modules in ES context
  Papa = (await import('papaparse')).default;
} catch (e) {
  console.error('Error loading PapaParse, using robust fallback parser:', e);

  // Enhanced fallback parser that handles quoted fields properly
  Papa = {
    parse: (text: string, config: any) => {
      console.log('Using enhanced fallback CSV parser');

      // Normalize line endings
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      const lines = text.split('\n');
      let headers: string[] = [];
      const results: any[] = [];
      const errors: any[] = [];

      // Get headers - assuming first row
      if (lines.length > 0) {
        // Simple but effective header parsing for CSV
        headers = parseCSVLine(lines[0]);
        console.log('Parsed headers:', headers);
      }

      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim() && config.skipEmptyLines) continue;

        try {
          const values = parseCSVLine(lines[i]);

          // Handle header mode
          if (config.header) {
            const row: any = {};
            headers.forEach((header, index) => {
              if (header) {
                row[header] = index < values.length ? values[index] : '';
                if (config.transform && typeof config.transform === 'function') {
                  row[header] = config.transform(row[header]);
                }
              }
            });
            results.push(row);
          } else {
            results.push(values);
          }
        } catch (e) {
          // Record errors but continue parsing
          if (e instanceof Error) {
            errors.push({
              type: 'ParseError',
              code: 'ParseError',
              message: e.message,
              row: i
            });
          }
        }
      }

      // Call complete callback if provided
      if (config.complete && typeof config.complete === 'function') {
        config.complete({ data: results, errors });
      }

      return { data: results, errors };
    }
  };
}

// Helper function to parse CSV lines with proper handling of quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let currentValue = '';
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      // Check if it's an escaped quote
      if (i + 1 < line.length && line[i + 1] === '"') {
        currentValue += '"';
        i += 2;
        continue;
      }

      // Toggle quote mode
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === ',' && !inQuotes) {
      // End of field
      result.push(currentValue);
      currentValue = '';
      i++;
      continue;
    }

    // Add character to current field
    currentValue += char;
    i++;
  }

  // Add the last field
  result.push(currentValue);

  return result;
}

export { Papa };
