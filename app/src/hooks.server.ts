// https://kit.svelte.dev/docs/hooks
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { handleAuth } from "./auth";
import { protectRoute } from '$lib/server/gatekeeper';
import { redirect } from '@sveltejs/kit';

const handleProtectedRoutes: Handle = async ({ event, resolve }) => {
  const session = await event.locals.getSession();
  const path = event.url.pathname;

  // Redirect logged-in users from root to models page
  if (path === '/' && session?.user) {
    throw redirect(303, '/models');
  }

  // Allow access to public routes and assets
  if (
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/api/register') ||
    path.startsWith('/_app') ||  // SvelteKit internal routes
    path.startsWith('/favicon') ||
    path.startsWith('/images') ||
    path.startsWith('/manifest.json') ||
    path.startsWith('/about') ||
    path.startsWith('/terms') ||
    path.startsWith('/privacy') ||
    path.startsWith('/table')
  ) {
    return resolve(event);
  }

  // Redirect to home if not logged in
  if (!session?.user) {
    throw redirect(303, '/');
  }

  return resolve(event);
};

// Sequence of middleware to run
// 1. handleAuth - Handles authentication from @auth
// 2. handleProtectedRoutes - Redirects to home if not logged in
// 3. protectRoute - Our gatekeeper for RBAC (no role required by default)
export const handle = sequence(handleAuth, handleProtectedRoutes, protectRoute());
