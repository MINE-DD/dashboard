import { json, error } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { pool } from '$lib/db';
import bcryptjs from 'bcryptjs';

export async function PUT({ request, locals }: RequestEvent) {
  const session = await locals.getSession();
  if (!session?.user?.email) {
    throw error(401, 'Not authenticated');
  }

  const { oldPassword, newPassword } = await request.json();

  try {
    // Get user from database
    const user = await pool.query(
      'SELECT id, password FROM auth_user WHERE email = $1',
      [session.user.email]
    );

    if (!user.rows[0]) {
      return json({ message: 'User not found' }, { status: 404 });
    }

    // Verify old password
    const validPassword = await bcryptjs.compare(oldPassword, user.rows[0].password);
    if (!validPassword) {
      throw error(400, 'Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcryptjs.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE auth_user SET password = $1 WHERE id = $2',
      [hashedPassword, user.rows[0].id]
    );

    return json({ message: 'Password updated successfully' });
  } catch (err: unknown) {
    console.error('Password update error:', err);
    throw error(500, 'Failed to update password');
  }
};
