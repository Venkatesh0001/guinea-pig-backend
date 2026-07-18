import { NextResponse } from 'next/server';
import { getAuthUser } from '@/utils/serverAuth';

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path } = await params;
    const pathStr = path.join('/');
    const searchParams = new URL(request.url).search;
    const ecommerceBaseUrl = process.env.ECOMMERCE_SERVICE_URL || 'http://127.0.0.1:8001';
    const url = `${ecommerceBaseUrl}/api/ecommerce/${pathStr}${searchParams}`;

    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Upstream service timed out' },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path } = await params;
    const pathStr = path.join('/');
    const ecommerceBaseUrl = process.env.ECOMMERCE_SERVICE_URL || 'http://127.0.0.1:8001';
    const url = `${ecommerceBaseUrl}/api/ecommerce/${pathStr}`;

    const contentType = request.headers.get('content-type') || '';
    let body;
    let headers = {};

    if (contentType.includes('multipart/form-data')) {
      body = await request.formData();
      // fetch will automatically set the correct boundary for FormData, so we don't set Content-Type header manually
    } else {
      body = await request.text();
      // Forward the client's original content type when present
      if (contentType) {
        headers['Content-Type'] = contentType;
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      body,
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Upstream service timed out' },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
