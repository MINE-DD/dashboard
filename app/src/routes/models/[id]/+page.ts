import type { PageLoad } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

export const load = (async ({ fetch, params }) => {
  try {
    const response = await fetch(`/api/models/${params.id}`);
    if (!response.ok) {
      throw error(response.status, 'Failed to load model');
    }

    const data = await response.json();
    if (!data.success) {
      throw error(500, data.error || 'Failed to load model');
    }

    return {
      model: data.model
    };
  } catch (e) {
    if (e instanceof Error) {
      throw error(500, e.message);
    }
    throw error(500, 'Failed to load model');
  }
}) satisfies PageLoad;
