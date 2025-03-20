export interface MapStyle {
  id: string;
  name: string;
  url: string;
  category: MapStyleCategory;
  description: string;
  thumbnail?: string;
}

export enum MapStyleCategory {
  BASE = 'Base Maps',
  TERRAIN = 'Satellite & Terrain',
  THEME = 'Themes',
}

// Helper function to append the API key to MapTiler URLs
function getMapTilerURL(baseURL: string): string {
  const apiKey = import.meta.env.VITE_MAPTILER_KEY || '';
  if (apiKey) {
    return `${baseURL}?key=${apiKey}`;
  }
  return baseURL;
}

export const MAP_STYLES: MapStyle[] = [
  // Base Maps
  {
    id: 'osm-default',
    name: 'OSM Default',
    url: 'https://demotiles.maplibre.org/style.json',
    category: MapStyleCategory.BASE,
    description: 'Default OpenStreetMap style'
  },
  {
    id: 'street-map',
    name: 'Street Map',
    url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    category: MapStyleCategory.BASE,
    description: 'Detailed street map'
  },



  // Satellite & Terrain from MapTiler
  {
    id: 'satellite',
    name: 'Satellite',
    url: getMapTilerURL('https://api.maptiler.com/maps/satellite/style.json'),
    category: MapStyleCategory.TERRAIN,
    description: 'Satellite imagery'
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    url: getMapTilerURL('https://api.maptiler.com/maps/hybrid/style.json'),
    category: MapStyleCategory.TERRAIN,
    description: 'Satellite with labels'
  },
  {
    id: 'terrain',
    name: 'Terrain',
    url: getMapTilerURL('https://api.maptiler.com/maps/topographique/style.json'),
    category: MapStyleCategory.TERRAIN,
    description: 'Elevation with terrain visualization'
  },

  // Themes
  {
    id: 'light-data',
    name: 'Light',
    url: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
    category: MapStyleCategory.THEME,
    description: 'Light theme for data overlays'
  },
  {
    id: 'light',
    name: 'Light Hybird',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    category: MapStyleCategory.THEME,
    description: 'Light, minimal style'
  },
  {
    id: 'dark-data',
    name: 'Dark',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
    category: MapStyleCategory.THEME,
    description: 'Dark theme for data overlays'
  },
  {
    id: 'dark',
    name: 'Dark Hybird',
    url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    category: MapStyleCategory.THEME,
    description: 'Dark mode map'
  },
];

// Group styles by category for easier rendering
export function getStylesByCategory(): Record<MapStyleCategory, MapStyle[]> {
  const result: Record<MapStyleCategory, MapStyle[]> = {
    [MapStyleCategory.BASE]: [],
    [MapStyleCategory.TERRAIN]: [],
    [MapStyleCategory.THEME]: []
  };

  MAP_STYLES.forEach(style => {
    result[style.category].push(style);
  });

  return result;
}

// Find a style by ID
export function getStyleById(id: string): MapStyle {
  const style = MAP_STYLES.find(style => style.id === id);
  if (!style) {
    return MAP_STYLES[0]; // Return default if not found
  }
  return style;
}
