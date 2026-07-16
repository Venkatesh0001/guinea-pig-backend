import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    const searchParams = new URL(request.url).search;
    const url = `http://127.0.0.1:8001/api/ecommerce/${pathStr}${searchParams}`;

    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { path } = await params;
    const pathStr = path.join('/');
    const url = `http://127.0.0.1:8001/api/ecommerce/${pathStr}`;

    const contentType = request.headers.get('content-type') || '';
    let body;
    let headers = {};

    if (contentType.includes('multipart/form-data')) {
      body = await request.formData();
      // fetch will automatically set the correct boundary for FormData, so we don't set Content-Type header manually
    } else {
      body = await request.text();
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: 'POST',
      body,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
