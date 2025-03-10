import { json, error } from '@sveltejs/kit';
import { pool } from '$lib/db';
import { Role } from '$lib/types';
import type { RequestEvent } from './$types';

export async function DELETE({ params, locals }: RequestEvent) {
  const session = await locals.getSession();
  if (!session?.user?.id) {
    throw error(401, 'Unauthorized');
  }

  const userRole = session.user.roles?.[0];
  if (userRole !== Role.ADMIN) {
    throw error(403, 'Forbidden');
  }

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [params.userId]);

    if (result.rowCount === 0) {
      throw error(404, 'User not found');
    }

    return json({ success: true });
  } catch (err) {
    console.error('User deletion error:', err);
    throw error(500, 'Failed to delete user');
  }
}
