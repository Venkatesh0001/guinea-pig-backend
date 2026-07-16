import { NextResponse } from 'next/server';
import { Client } from "@gradio/client";

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

    const spaceId = process.env.HF_SPACE_ID || "Venkatesh001/gui-pig-ml-service";
    console.log(`Connecting to Gradio API space: ${spaceId} for breed classification`);
    
    // Convert the File object to Blob for Gradio Client compatibility
    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });

    // Connect to the client
    const app = await Client.connect(spaceId);

    // Make the API call to the classify_breed endpoint
    const result = await app.predict("/classify_breed", [fileBlob]);

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
