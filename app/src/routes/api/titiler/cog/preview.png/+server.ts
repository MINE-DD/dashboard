import type { RequestHandler } from './$types';

// TiTiler endpoint from our docker service
const TITILER_BASE_URL = 'http://localhost:8000';

export const GET: RequestHandler = async ({ url, fetch }) => {
  try {
    // Extract the COG URL from the request
    const cogUrl = url.searchParams.get('url');

    if (!cogUrl) {
      return new Response('Missing URL parameter', { status: 400 });
    }

    // Create params for TiTiler request, keeping any additional params
    const params = new URLSearchParams(url.searchParams);

    // Construct the target URL for TiTiler preview endpoint
    const targetUrl = `${TITILER_BASE_URL}/cog/preview.png?${params.toString()}`;
    console.log(`Proxying TiTiler preview request to: ${targetUrl}`);

    // Forward the request to TiTiler
    const response = await fetch(targetUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TiTiler preview error (${response.status}): ${errorText}`);
      return new Response(errorText, { status: response.status });
    }

    // Get the image data
    const imageBlob = await response.blob();
    const contentType = response.headers.get('content-type') || 'image/png';

    // Return the image directly
    return new Response(imageBlob, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=3600' // Cache for an hour
      }
    });
  } catch (error) {
    console.error('Error in TiTiler preview proxy:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};