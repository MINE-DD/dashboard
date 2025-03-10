import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sql } from '$lib/db';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const startTime = new Date().toISOString();

    console.log('Creating validation with data:', data);

    // Get the model first to ensure it exists
    const model = await sql`
      SELECT * FROM model_checkpoints
      WHERE checkpoint_id = ${data.modelId}
    `;

    if (model.length === 0) {
      console.error('Model not found:', data.modelId);
      return json({ error: 'Model not found' }, { status: 404 });
    }

    console.log('Found model:', model[0]);

    // Create new validation record
    const result = await sql`
      INSERT INTO validations (
        fair_model_id,
        model_checkpoint_id,
        description,
        validation_dataset,
        validation_status,
        start_datetime,
        validation_result
      ) VALUES (
        ${model[0].fair_model_id},
        ${data.modelId},
        ${data.datasetDescription || ''},
        ${JSON.stringify({
      userName: data.userName,
      dataset: data.uploadedFile
    })},
        ${'pending'},
        ${startTime},
        ${JSON.stringify({
      metrics: data.metricsDescription,
      performance: data.performanceMetrics
    })}
      )
            RETURNING *
        `;

    console.log('Validation created:', result[0]);

    // Get updated validations for this model
    const validations = await sql`
      SELECT * FROM validations
      WHERE model_checkpoint_id = ${data.modelId}
      ORDER BY start_datetime DESC
    `;

    console.log('Updated validations:', validations);

    return json({
      success: true,
      validation: result[0],
      validations: validations
    });
  } catch (error) {
    console.error('Error creating validation:', error);
    return json({ error: 'Failed to create validation' }, { status: 500 });
  }
};
