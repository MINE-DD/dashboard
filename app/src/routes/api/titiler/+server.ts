import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// TiTiler endpoint from our docker service
const TITILER_BASE_URL = 'http://localhost:8000';

export const GET: RequestHandler = async ({ url, fetch }) => {
  try {
    // Extract path and query parameters from the request URL
    const path = url.searchParams.get('path') || '';
    const params = new URLSearchParams(url.searchParams);
    params.delete('path'); // Remove the path parameter

    // Construct the target URL for TiTiler
    const targetUrl = `${TITILER_BASE_URL}/${path}?${params.toString()}`;
    console.log(`Proxying TiTiler request to: ${targetUrl}`);

    // Forward the request to TiTiler
    const response = await fetch(targetUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TiTiler error (${response.status}): ${errorText}`);
      return new Response(errorText, { status: response.status });
    }

    // Get content type to determine how to handle the response
    const contentType = response.headers.get('content-type') || '';

    // For JSON responses
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return json(data);
    }

    // For binary data (images, etc.)
    if (contentType.includes('image/')) {
      const blob = await response.blob();
      return new Response(blob, {
        status: 200,
        headers: {
          'content-type': contentType
        }
      });
    }

    // For text responses
    const text = await response.text();
    return new Response(text, {
      status: 200,
      headers: {
        'content-type': contentType
      }
    });
  } catch (error) {
    console.error('Error in TiTiler proxy:', error);
    return json({ error: 'Internal Server Error' }, { status: 500 });
  }
};