import { NextResponse, after } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseAdmin';

// Valid Printify product topics (https://developers.printify.com/#product-events):
// product:created, product:updated, product:deleted, product:publish:started
const SYNC_EVENTS = ['product:created', 'product:updated', 'product:publish:started'];
const DELETE_EVENTS = ['product:deleted'];

export async function GET(request) {
  return NextResponse.json({ status: "success", message: "Webhook GET validated" });
}

export async function HEAD(request) {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request) {
  const rawText = await request.text();

  // Printify validation pings may be empty or non-JSON — always 200 them
  if (!rawText) {
    return NextResponse.json({ status: "success", message: "Webhook validated (empty)" });
  }

  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch (parseError) {
    return NextResponse.json({ status: "success", message: "Webhook validated (non-JSON)" });
  }

  // ACK immediately so Printify always gets a fast 200; sync work runs after the response is sent
  after(async () => {
    try {
      await processWebhookEvent(payload);
    } catch (error) {
      console.error("Webhook background processing failed:", error);
    }
  });

  return NextResponse.json({ status: "success", message: "Webhook acknowledged" });
}

async function processWebhookEvent(payload) {
  // Printify event shape: { id, type, created_at, resource: { id, type, data } }
  const eventType = payload.type || "";
  const resource = payload.resource || {};
  const productId = resource.id || payload.data?.id;

  console.log(`Printify webhook received: type=${eventType}, product=${productId || 'n/a'}`);

  if (!productId) {
    return;
  }

  if (!SYNC_EVENTS.includes(eventType) && !DELETE_EVENTS.includes(eventType)) {
    return;
  }

  const API_TOKEN = process.env.PRINTIFY_API_TOKEN;
  const SHOP_ID = process.env.PRINTIFY_SHOP_ID;

  if (!API_TOKEN || !SHOP_ID) {
    console.error("Missing Printify API keys in environment.");
    return;
  }

  const supabase = getSupabaseAdmin();

  if (SYNC_EVENTS.includes(eventType)) {
    // Fetch fresh product data from Printify
    const url = `https://api.printify.com/v1/shops/${SHOP_ID}/products/${productId}.json`;
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "GuineaPigDoctor Vercel Webhook"
      }
    });

    if (response.ok) {
      const productData = await response.json();

      const { error } = await supabase.from('products').upsert({
        product_id: productId,
        raw_data: JSON.stringify(productData),
        updated_at: new Date().toISOString()
      }, { onConflict: 'product_id' });

      if (error) {
        console.error("Failed to upsert to Supabase:", error);
      } else {
        console.log(`Successfully synced product ${productId} to Supabase`);
      }
    } else if (response.status === 404) {
      // Product no longer exists in Printify — remove locally
      await supabase.from('products').delete().eq('product_id', productId);
      console.log(`Product ${productId} deleted from DB (404 from Printify API)`);
    } else {
      console.error(`Printify product fetch failed (${response.status}) for ${productId}`);
    }
  } else {
    // product:deleted — remove from DB immediately
    const { error } = await supabase.from('products').delete().eq('product_id', productId);
    if (error) {
      console.error("Failed to delete from Supabase:", error);
    } else {
      console.log(`Successfully deleted product ${productId} from DB`);
    }
  }
}
