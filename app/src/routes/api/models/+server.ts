import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadModels, importModel } from '$lib/stores/models/index.svelte';

export const GET: RequestHandler = async () => {
  try {
    await loadModels();
    return json({ success: true, models });
  } catch (error) {
    console.error('Error in GET /api/models:', error);
    return json(
      { success: false, error: 'Failed to load models' },
      { status: 500 }
    );
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const { url } = data;

    if (!url) {
      return json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    const model = await importModel(url);
    return json({ success: true, model });
  } catch (error) {
    console.error('Error in POST /api/models:', error);
    return json(
      { success: false, error: 'Failed to import model' },
      { status: 500 }
    );
  }
};
