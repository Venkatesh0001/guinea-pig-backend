import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Query text is required.' },
        { status: 400 }
      );
    }

    const backendUrl = 'http://127.0.0.1:8002/search';
    console.log(`Forwarding diagnostics query to FastAPI: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
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
    return NextResponse.json(
      { error: `Internal Server Error in Next.js Bridge: ${error.message || error}` },
      { status: 500 }
    );
  }
}
