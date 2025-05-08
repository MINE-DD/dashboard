// Generate colors for a dataset
export function generateColors(uniqueValues: Set<string>): Map<string, string> {
  const colorMap = new Map<string, string>();
  const colors = [
    '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
    '#FFB336', '#a65628', '#f781bf', '#999999', '#8dd3c7',
    '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69'
  ];

  let colorIndex = 0;
  for (const value of uniqueValues) {
    colorMap.set(value, colors[colorIndex % colors.length]);
    colorIndex++;
  }

  return colorMap;
}
