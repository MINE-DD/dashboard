import { json, error } from '@sveltejs/kit';
import { pool } from '$lib/db';
import { Role } from '$lib/types';
import type { RequestEvent } from './$types';
import bcrypt from 'bcryptjs';

export async function POST({ request, locals }: RequestEvent) {
  const session = await locals.getSession();
  if (!session?.user?.id) {
    throw error(401, 'Unauthorized');
  }

  const userRole = session.user.roles?.[0];
  if (userRole !== Role.ADMIN) {
    throw error(403, 'Forbidden');
  }

  const { email, password, name, role } = await request.json();

  try {
    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw error(400, 'User already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user with role
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email, hashedPassword, name, role || Role.USER]
    );

    return json(result.rows[0]);
  } catch (err) {
    console.error('User creation error:', err);
    throw error(500, 'Failed to create user');
  }
}

export async function GET({ locals }: RequestEvent) {
  const session = await locals.getSession();
  if (!session?.user?.id) {
    throw error(401, 'Unauthorized');
  }

  const userRole = session.user.roles?.[0];
  if (userRole !== Role.ADMIN) {
    throw error(403, 'Forbidden');
  }

  try {
    const result = await pool.query(`
      SELECT
        id,
        email,
        name,
        ARRAY[role] as roles
      FROM users
      ORDER BY id
    `);

    return json(result.rows);
  } catch (err) {
    throw error(500, 'Failed to fetch users');
  }
}
