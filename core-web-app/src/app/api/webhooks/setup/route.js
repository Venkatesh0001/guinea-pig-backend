import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const API_TOKEN = process.env.PRINTIFY_API_TOKEN;
    const SHOP_ID = process.env.PRINTIFY_SHOP_ID;

    if (!API_TOKEN || !SHOP_ID) {
      return NextResponse.json({ status: "error", message: "Printify API keys missing in environment variables" }, { status: 500 });
    }

    // Determine the base URL dynamically from the request host
    // Vercel populates the host header, or we can use VERCEL_PROJECT_PRODUCTION_URL
    const host = request.headers.get('host');
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    
    const webhookUrl = `${baseUrl}/api/webhooks/printify`;
    const printifyUrl = `https://api.printify.com/v1/shops/${SHOP_ID}/webhooks.json`;

    const headers = {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "Vercel Webhook Auto-Setup"
    };

    // 1. Fetch current webhooks
    const getRes = await fetch(printifyUrl, { headers });
    if (!getRes.ok) {
      const err = await getRes.text();
      return NextResponse.json({ status: "error", message: `Failed to fetch existing webhooks: ${err}` }, { status: 500 });
    }
    
    const existing = await getRes.json();
    const registeredTopics = existing.filter(w => w.url === webhookUrl).map(w => w.topic);
    
    const topicsToRegister = ["shop:product:published", "shop:product:updated", "shop:product:deleted"];
    const results = [];

    // 2. Register missing topics
    for (const topic of topicsToRegister) {
      if (registeredTopics.includes(topic)) {
        results.push({ topic, status: "already_registered" });
        continue;
      }
      
      const regRes = await fetch(printifyUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: webhookUrl, topic })
      });

      if (regRes.ok) {
        results.push({ topic, status: "success" });
      } else {
        const err = await regRes.text();
        results.push({ topic, status: "error", error: err });
      }
    }

    return NextResponse.json({
      status: "complete",
      webhook_url: webhookUrl,
      results
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
