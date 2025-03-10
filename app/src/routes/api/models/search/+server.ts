import postgres from 'postgres';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { DBModelRow } from '$lib/stores/models/types';

const sql = postgres();

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q');
  if (!query) {
    return new Response(JSON.stringify({ error: 'Query parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const searchPattern = `%${query}%`;
    const result: DBModelRow[] = await sql`
      SELECT * FROM model_checkpoints
      WHERE
        fair_model_id ILIKE ${searchPattern} OR
        description ILIKE ${searchPattern} OR
        metadata::text ILIKE ${searchPattern}
    `;

    return json(result);
  } catch (e) {
    console.error('Error searching models:', e);
    return new Response(JSON.stringify({ error: 'Failed to search models' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
