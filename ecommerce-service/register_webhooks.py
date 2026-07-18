import os
import sys
import requests
from dotenv import load_dotenv

# Load environment
load_dotenv()

API_TOKEN = os.getenv("PRINTIFY_API_TOKEN")
SHOP_ID = os.getenv("PRINTIFY_SHOP_ID")

def register(external_url):
    if not API_TOKEN or not SHOP_ID:
        print("Error: PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID is not set in your .env file.")
        sys.exit(1)
        
    webhook_url = f"{external_url.rstrip('/')}/api/webhooks/printify"
    print(f"Target Webhook URL: {webhook_url}")
    print(f"Shop ID: {SHOP_ID}")
    
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
        "User-Agent": "Printify Webhook Setup Tool"
    }
    
    # 1. Fetch current webhooks
    url = f"https://api.printify.com/v1/shops/{SHOP_ID}/webhooks.json"
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if not response.ok:
            print(f"Failed to fetch existing webhooks: {response.text}")
            sys.exit(1)
            
        existing = response.json()
        registered_topics = {w["topic"] for w in existing if w["url"] == webhook_url}
        print(f"Currently registered topics for this URL: {list(registered_topics)}")
        
        # 2. Register missing topics
        topics_to_register = ["shop:product:published", "shop:product:updated", "shop:product:deleted"]
        for topic in topics_to_register:
            if topic in registered_topics:
                print(f"Topic '{topic}' is already registered.")
                continue
                
            print(f"Registering topic '{topic}'...")
            payload = {"url": webhook_url, "topic": topic}
            reg_response = requests.post(url, json=payload, headers=headers, timeout=10)
            if reg_response.ok:
                print(f"Successfully registered topic '{topic}'!")
            else:
                print(f"Failed to register topic '{topic}': {reg_response.text}")
                
        print("Webhook registration complete!")
    except Exception as e:
        print(f"Error occurred during registration: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python register_webhooks.py <your_render_service_url>")
        print("Example: python register_webhooks.py https://guinea-pig-ecommerce.onrender.com")
        sys.exit(1)
        
    register(sys.argv[1])
