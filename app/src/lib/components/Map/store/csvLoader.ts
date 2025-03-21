// Import Papa Parse with compatibility for different module systems
let Papa: any;
try {
  // @ts-ignore - Special handling for CommonJS/UMD modules in ES context
  Papa = (await import('papaparse')).default;
} catch (e) {
  console.error('Error loading PapaParse:', e);
  // Fallback to a minimal parser for emergency cases
  Papa = {
    parse: (text: string, config: any) => {
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const results: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',');
        const row: any = {};

        headers.forEach((header, index) => {
          row[header] = values[index] ? values[index].trim() : '';
        });

        results.push(row);
      }

      return { data: results, errors: [] };
    }
  };
}

export { Papa };
