import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No image file found in the request payload.' },
        { status: 400 }
      );
    }

    const forwardFormData = new FormData();
    forwardFormData.append('file', file);

    const fastapiBaseUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
    const fastapiUrl = `${fastapiBaseUrl}/classify-breed`;
    console.log(`Forwarding breed classification to FastAPI: ${fastapiUrl}`);

    const response = await fetch(fastapiUrl, {
      method: 'POST',
      body: forwardFormData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`FastAPI server returned error (${response.status}):`, errorBody);
      try {
        const parsedError = JSON.parse(errorBody);
        return NextResponse.json(
          { error: parsedError.detail || `ML Service returned status ${response.status}` },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          { error: `ML Service returned status ${response.status}: ${response.statusText}` },
          { status: response.status }
        );
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in secure breed-check API bridge route:', error);
    return NextResponse.json(
      { error: `Internal Server Error in Next.js Bridge: ${error.message || error}` },
      { status: 500 }
    );
  }
}
