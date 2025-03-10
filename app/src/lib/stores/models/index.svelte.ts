import { error } from '@sveltejs/kit';
import type { Model, DBModelRow, DBModelWithValidationRow, ValidationRow } from './types';

// State
let modelsList = $state<Model[]>([]);
let selectedModel = $state<Model | null>(null);

export function getModels(): Model[] {
  return modelsList;
}

export function getSelectedModel(): Model | null {
  return selectedModel;
}

// Load all models with validation info
export async function loadModels() {
  try {
    const response = await fetch('/api/models/list');
    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }

    const rows = await response.json();
    modelsList = rows.map((row: DBModelWithValidationRow) => ({
      checkpoint_id: row.checkpoint_id,
      fair_model_id: row.fair_model_id,
      fair_model_url: row.fair_model_url,
      metadata: row.metadata,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      validations: {
        count: parseInt(row.validation_count),
        latest: row.latest_validation_date ? {
          status: row.latest_validation_status,
          date: row.latest_validation_date
        } : undefined
      }
    }));
  } catch (e) {
    console.error('Error loading models:', e);
    throw error(500, 'Failed to load models');
  }
}

// Load specific model with validations
export async function getModel(checkpointId: string) {
  try {
    const response = await fetch(`/api/models/${checkpointId}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw error(404, 'Model not found');
      }
      throw new Error('Failed to fetch model');
    }

    const data = await response.json();
    selectedModel = data;
    return selectedModel;
  } catch (e) {
    console.error('Error loading model:', e);
    throw error(500, 'Failed to load model');
  }
}

// Search models
export async function searchModels(query: string) {
  try {
    const response = await fetch(`/api/models/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Failed to search models');
    }

    const rows = await response.json();
    return rows.map((row: DBModelRow) => ({
      checkpoint_id: row.checkpoint_id,
      fair_model_id: row.fair_model_id,
      fair_model_url: row.fair_model_url,
      metadata: row.metadata,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (e) {
    console.error('Error searching models:', e);
    throw error(500, 'Failed to search models');
  }
}

// Import model
export async function importModel(url: string) {
  try {
    // TODO: Implement model import logic
    // This would involve:
    // 1. Fetching model info from the URL
    // 2. Validating the model data
    // 3. Inserting into database
    throw new Error('Not implemented');
  } catch (e) {
    console.error('Error importing model:', e);
    throw error(500, 'Failed to import model');
  }
}
