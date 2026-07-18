import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabaseClient';

export async function GET(request) {
  return NextResponse.json({ status: "success", message: "Webhook GET validated" });
}

export async function HEAD(request) {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request) {
  try {
    const rawText = await request.text();
    if (!rawText) {
      return NextResponse.json({ status: "success", message: "Webhook validated (empty)" });
    }

    let payload;
    try {
      payload = JSON.parse(rawText);
    } catch (parseError) {
      // Printify might send form-urlencoded or other non-JSON data during validation pings
      return NextResponse.json({ status: "success", message: "Webhook validated (non-JSON)" });
    }

    const eventType = payload.type || "";
    const normalizedEvent = eventType.replace("shop:", "");
    
    const data = payload.data || {};
    const resource = payload.resource || {};
    const productId = data.id || resource.id;

    if (!productId) {
      return NextResponse.json({ status: "ignored", message: "No product ID found" });
    }

    if (["product:publish:success", "product:published", "product:updated", "product:created"].includes(normalizedEvent)) {
      // Fetch fresh product data from Printify
      const API_TOKEN = process.env.PRINTIFY_API_TOKEN;
      const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
      
      if (!API_TOKEN || !SHOP_ID) {
        console.error("Missing Printify API keys in Vercel environment.");
        return NextResponse.json({ status: "error", message: "Server misconfigured" }, { status: 500 });
      }

      const url = `https://api.printify.com/v1/shops/${SHOP_ID}/products/${productId}.json`;
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        const productData = await response.json();
        
        // Upsert to Supabase
        const { error } = await supabase.from('products').upsert({
          product_id: productId,
          raw_data: JSON.stringify(productData),
          updated_at: new Date().toISOString()
        }, { onConflict: 'product_id' });
        
        if (error) {
          console.error("Failed to upsert to Supabase:", error);
          return NextResponse.json({ status: "error", message: "DB Error" }, { status: 500 });
        }
        
        console.log(`Successfully synced product ${productId} to Supabase`);
      } else if (response.status === 404) {
        // If 404, product was likely deleted in Printify
        await supabase.from('products').delete().eq('product_id', productId);
        console.log(`Product ${productId} deleted from DB (404 from Printify API)`);
      }
    } else if (normalizedEvent === "product:deleted") {
      // Delete from DB immediately
      const { error } = await supabase.from('products').delete().eq('product_id', productId);
      if (error) {
        console.error("Failed to delete from Supabase:", error);
      } else {
        console.log(`Successfully deleted product ${productId} from DB`);
      }
    }

    return NextResponse.json({ status: "success", message: "Webhook acknowledged" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
