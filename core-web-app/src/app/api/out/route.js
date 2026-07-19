import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const offerId = searchParams.get('offerId');

    if (!offerId) {
      return NextResponse.json({ error: 'Missing offerId parameter' }, { status: 400 });
    }

    const ecommerceBaseUrl = process.env.ECOMMERCE_SERVICE_URL || 'http://127.0.0.1:8001';
    const url = `${ecommerceBaseUrl}/api/out?offerId=${offerId}`;

    // Call the backend redirect endpoint without following the redirect automatically
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
    });

    // If it's a 302 redirect, extract the Location header and redirect the browser
    if (response.status === 302 || response.status === 307) {
      const redirectUrl = response.headers.get('location');
      if (redirectUrl) {
        return NextResponse.redirect(redirectUrl, 302);
      }
    }

    // If backend returned success but followed redirect, or returned the URL in body
    if (response.ok) {
      const data = await response.json();
      if (data.url) {
        return NextResponse.redirect(data.url, 302);
      }
    }

    // Handle errors from backend
    const errorText = await response.text();
    console.error(`Backend redirect error (${response.status}):`, errorText);
    return NextResponse.json({ error: 'Failed to process redirect link.' }, { status: response.status });
  } catch (error) {
    console.error('Error in Next.js public redirect router:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
