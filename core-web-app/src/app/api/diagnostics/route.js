import { NextResponse } from 'next/server';
import { getAuthUser } from '@/utils/serverAuth';

export const maxDuration = 60; // Allow up to 60 seconds for Render cold starts

export async function POST(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Query text is required.' },
        { status: 400 }
      );
    }

    const backendBaseUrl = process.env.DIAGNOSTICS_SERVICE_URL || 'http://127.0.0.1:8002';
    const backendUrl = `${backendBaseUrl}/search_hybrid`;
    console.log(`Forwarding diagnostics query to FastAPI: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`FastAPI diagnostics service returned error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: `Diagnostics service error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in Next.js diagnostics API bridge:', error);
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Upstream service timed out' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: `Internal Server Error in Next.js Bridge: ${error.message || error}` },
      { status: 500 }
    );
  }
}
