import { NextResponse } from 'next/server';
import { getAuthUser } from '@/utils/serverAuth';

export async function POST(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const fastapiUrl = process.env.MODAL_BREED_URL || 'https://venkatesh0001--guinea-pig-ml-service-guineapigmodel-clas-cdc9f9.modal.run';
    console.log(`Forwarding breed classification to Modal Serverless API: ${fastapiUrl}`);

    const response = await fetch(fastapiUrl, {
      method: 'POST',
      body: forwardFormData,
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Modal server returned error (${response.status}):`, errorBody);
      try {
        const parsedError = JSON.parse(errorBody);
        return NextResponse.json(
          { error: parsedError.error || parsedError.detail || `ML Service returned status ${response.status}` },
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
