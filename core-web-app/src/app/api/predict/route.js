import { NextResponse } from 'next/server';
import { Client } from "@gradio/client";

export async function POST(request) {
  try {
    // 1. Parse incoming FormData securely
    const formData = await request.formData();
    const file = formData.get('file');
    const xPct = formData.get('x_pct') !== null ? parseFloat(formData.get('x_pct')) : 0.5;
    const yPct = formData.get('y_pct') !== null ? parseFloat(formData.get('y_pct')) : 0.5;
    const boxScale = formData.get('box_scale') !== null ? parseFloat(formData.get('box_scale')) : 0.4;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file found in the request payload.' },
        { status: 400 }
      );
    }

    // 2. Connect to the Gradio API 
    // We connect to local server if ML_SERVICE_URL is set, otherwise default to the deployed Hugging Face Space
    const spaceId = process.env.HF_SPACE_ID || "Venkatesh001/gui-pig-ml-service";
    console.log(`Connecting to Gradio API space: ${spaceId}`);
    
    // Convert the File object to Blob for Gradio Client compatibility
    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });

    // Connect to the client
    const app = await Client.connect(spaceId);

    // 3. Make the API call to the predict_gender endpoint
    console.log(`Predicting gender with (x: ${xPct}, y: ${yPct}, scale: ${boxScale})`);
    const result = await app.predict("/predict_gender", [
      fileBlob,
      xPct,
      yPct,
      boxScale
    ]);

    // 4. Return the JSON payload back to browser
    // Gradio returns data in a "data" array
    const data = result.data[0];
    
    if (data.error) {
      console.error(`Gradio returned error:`, data.error);
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in Gradio API bridge route:', error);
    return NextResponse.json(
      { error: `Internal Server Error in Next.js Bridge: ${error.message || error}` },
      { status: 500 }
    );
  }
}
