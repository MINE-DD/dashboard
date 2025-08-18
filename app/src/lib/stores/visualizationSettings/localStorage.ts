import { browser } from '$app/environment';

const STORAGE_KEY = 'visualizationSettings';

export interface VisualizationSettings {
  globalOpacity: number;
  barThickness: number;
  dataPointsVisible: boolean;
}

const defaultSettings: VisualizationSettings = {
  globalOpacity: 80,
  barThickness: 0.2,
  dataPointsVisible: true
};

export function loadStoredSettings(): VisualizationSettings {
  if (!browser) return defaultSettings;

  try {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (!savedSettings) return defaultSettings;

    const parsed = JSON.parse(savedSettings);

    // Validate and merge with defaults to handle missing properties
    return {
      globalOpacity: typeof parsed.globalOpacity === 'number' ? parsed.globalOpacity : defaultSettings.globalOpacity,
      barThickness: typeof parsed.barThickness === 'number' ? parsed.barThickness : defaultSettings.barThickness,
      dataPointsVisible: typeof parsed.dataPointsVisible === 'boolean' ? parsed.dataPointsVisible : defaultSettings.dataPointsVisible
    };
  } catch (error) {
    console.warn('Failed to load visualization settings from localStorage:', error);
    return defaultSettings;
  }
}

export function saveSettingsToStorage(settings: Partial<VisualizationSettings>): void {
  if (!browser) return;

  try {
    const currentSettings = loadStoredSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
  } catch (error) {
    console.warn('Failed to save visualization settings to localStorage:', error);
  }
}

export function clearStoredSettings(): void {
  if (browser) {
    localStorage.removeItem(STORAGE_KEY);
  }
}
