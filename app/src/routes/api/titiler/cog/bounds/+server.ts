import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// TiTiler endpoint from our docker service
const TITILER_BASE_URL = 'http://localhost:8000';

export const GET: RequestHandler = async ({ url, fetch }) => {
  try {
    // Extract the COG URL or path from the request
    const cogUrl = url.searchParams.get('url');

    if (!cogUrl) {
      return json({ error: 'Missing URL parameter' }, { status: 400 });
    }

    // Create params for TiTiler request, keeping any additional params
    const params = new URLSearchParams(url.searchParams);

    // Construct the target URL for TiTiler bounds endpoint
    const targetUrl = `${TITILER_BASE_URL}/cog/bounds?${params.toString()}`;
    console.log(`Proxying TiTiler bounds request to: ${targetUrl}`);

    // Forward the request to TiTiler
    const response = await fetch(targetUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TiTiler bounds error (${response.status}): ${errorText}`);
      return new Response(errorText, { status: response.status });
    }

    // Parse and return the bounds JSON
    const boundsData = await response.json();
    return json(boundsData);
  } catch (error) {
    console.error('Error in TiTiler bounds proxy:', error);
    return json({ error: 'Internal Server Error' }, { status: 500 });
  }
};