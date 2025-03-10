import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sql } from '$lib/db';

export const PUT: RequestHandler = async ({ request, params }) => {
  try {
    const data = await request.json();

    const result = await sql`
      UPDATE validations
      SET
        description = ${data.datasetDescription},
        validation_dataset = ${JSON.stringify({
      userName: data.userName,
      dataset: data.uploadedFile,
      metricsDescription: data.metricsDescription,
      performanceMetrics: data.performanceMetrics
    })}
      WHERE val_id = ${params.id}
      RETURNING *
    `;

    if (result.length === 0) {
      return json({ error: 'Validation not found' }, { status: 404 });
    }

    return json(result[0]);
  } catch (error) {
    console.error('Error updating validation:', error);
    return json({ error: 'Failed to update validation' }, { status: 500 });
  }
};
