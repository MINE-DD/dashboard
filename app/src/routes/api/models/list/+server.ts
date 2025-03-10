import postgres from 'postgres';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { DBModelWithValidationRow } from '$lib/stores/models/types';

const sql = postgres();

export const GET: RequestHandler = async () => {
  try {
    const result: DBModelWithValidationRow[] = await sql`
      SELECT
        m.*,
        COUNT(v.val_id) as validation_count,
        MAX(v.start_datetime) as latest_validation_date,
        (
          SELECT validation_status
          FROM validations
          WHERE model_checkpoint_id = m.checkpoint_id
          ORDER BY start_datetime DESC
          LIMIT 1
        ) as latest_validation_status
      FROM model_checkpoints m
      LEFT JOIN validations v ON m.checkpoint_id = v.model_checkpoint_id
      GROUP BY m.checkpoint_id
    `;

    return json(result);
  } catch (e) {
    console.error('Error loading models:', e);
    return new Response(JSON.stringify({ error: 'Failed to load models' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
