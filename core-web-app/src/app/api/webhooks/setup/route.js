import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';

// Valid Printify product topics (https://developers.printify.com/#product-events)
const TOPICS_TO_REGISTER = [
  "product:created",
  "product:updated",
  "product:deleted",
  "product:publish:started"
];

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
      "User-Agent": "GuineaPigDoctor Webhook Setup"
    };

    // 1. Fetch current webhooks
    const getRes = await fetch(printifyUrl, { headers });
    if (!getRes.ok) {
      const err = await getRes.text();
      return NextResponse.json({ status: "error", message: `Failed to fetch existing webhooks: ${err}` }, { status: 500 });
    }

    const existing = await getRes.json();
    const registeredTopics = existing.filter(w => w.url === webhookUrl).map(w => w.topic);

    const results = [];

    // 2. Register missing topics
    for (const topic of TOPICS_TO_REGISTER) {
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

    // 3. Initial catalog backfill: fetch all products from Printify (paginated) and upsert into Supabase
    let productsSynced = 0;
    let syncError = null;
    try {
      const supabase = getSupabaseAdmin();
      let page = 1;
      let lastPage = 1;
      do {
        const res = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json?page=${page}`, { headers });
        if (!res.ok) {
          throw new Error(`Printify products fetch failed with status ${res.status}`);
        }
        const json = await res.json();
        const items = Array.isArray(json.data) ? json.data : [];
        lastPage = json.last_page || page;

        if (items.length > 0) {
          const rows = items.map(p => ({
            product_id: p.id,
            raw_data: JSON.stringify(p),
            updated_at: new Date().toISOString()
          }));
          const { error } = await supabase.from('products').upsert(rows, { onConflict: 'product_id' });
          if (error) {
            throw new Error(`Supabase upsert failed: ${error.message}`);
          }
          productsSynced += items.length;
        }
        page++;
      } while (page <= lastPage);
    } catch (e) {
      syncError = e.message;
    }

    return NextResponse.json({
      status: "complete",
      webhook_url: webhookUrl,
      results,
      products_synced: productsSynced,
      sync_error: syncError
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
