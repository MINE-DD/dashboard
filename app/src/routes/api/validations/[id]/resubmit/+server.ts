import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sql } from '$lib/db';

export const POST: RequestHandler = async ({ params }) => {
  try {
    // Get the existing validation
    const existingValidation = await sql`
      SELECT *
      FROM validations
      WHERE val_id = ${params.id}
    `;

    if (existingValidation.length === 0) {
      return json({ error: 'Validation not found' }, { status: 404 });
    }

    // Create a new validation record with the same data but reset status
    const result = await sql`
      INSERT INTO validations (
        fair_model_id,
        description,
        validation_dataset,
        validation_status,
        start_datetime
      )
      SELECT
        fair_model_id,
        description,
        validation_dataset,
        'pending' as validation_status,
        ${new Date().toISOString()} as start_datetime
      FROM validations
      WHERE val_id = ${params.id}
      RETURNING *
    `;

    return json(result[0]);
  } catch (error) {
    console.error('Error resubmitting validation:', error);
    return json({ error: 'Failed to resubmit validation' }, { status: 500 });
  }
};
