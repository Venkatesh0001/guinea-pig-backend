import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. Parse incoming FormData securely
    const formData = await request.formData();
    const file = formData.get('file');
    const xPct = formData.get('x_pct');
    const yPct = formData.get('y_pct');
    const boxScale = formData.get('box_scale');

    if (!file) {
      return NextResponse.json(
        { error: 'No image file found in the request payload.' },
        { status: 400 }
      );
    }

    // 2. Re-package the file payload and variables into secondary FormData
    const forwardFormData = new FormData();
    forwardFormData.append('file', file);
    forwardFormData.append('x_pct', xPct !== null ? xPct : '0.5');
    forwardFormData.append('y_pct', yPct !== null ? yPct : '0.5');
    forwardFormData.append('box_scale', boxScale !== null ? boxScale : '0.4');

    // 3. Forward request to FastAPI server running at port 8000
    const fastapiBaseUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
    const fastapiUrl = `${fastapiBaseUrl}/predict-gender`;
    console.log(`Forwarding proxy request to FastAPI: ${fastapiUrl} with (x: ${xPct}, y: ${yPct}, scale: ${boxScale})`);
    
    const response = await fetch(fastapiUrl, {
      method: 'POST',
      body: forwardFormData,
    });

    // 4. Handle non-2xx responses from the FastAPI server
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`FastAPI server returned error (${response.status}):`, errorBody);
      return NextResponse.json(
        { error: `ML Service returned status ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    // 5. Return the JSON payload (containing prediction, confidence, cam_image) back to browser
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in secure API bridge route:', error);
    return NextResponse.json(
      { error: `Internal Server Error in Next.js Bridge: ${error.message || error}` },
      { status: 500 }
    );
  }
}
