import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("diagnostics-service")

# Database configuration
DB_CONFIG = {
    "host": "localhost",
    "database": "facebook_qa_db",
    "user": "admin",
    "password": "localpassword",
    "port": "5432"
}

# Request schema
class SearchQuery(BaseModel):
    query: str

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load SentenceTransformer model at startup
    logger.info("Loading SentenceTransformer model 'all-MiniLM-L6-v2'...")
    try:
        app.state.model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Model loaded successfully.")
    except Exception as e:
        logger.critical(f"Failed to load SentenceTransformer model: {e}")
        raise e
    yield
    # Cleanup if necessary (none required here)

app = FastAPI(title="GuineaPigDoctor Diagnostics Service", lifespan=lifespan)

# Enable CORS for Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Next.js will call this through server-side fetch or direct local requests
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Predefined Category-Based Advice Dictionary
ADVICE_KNOWLEDGE_BASE = [
    {
        "category": "Digestive & Gastrointestinal Issues",
        "keywords": ["poop", "clump", "diarrhea", "soft", "constipat", "watery poop", "clumps", "digest", "stomach", "bloat", "critical care", "appetite"],
        "advice": (
            "Pooping in clumps (commonly known as impaction, especially prevalent in older males) or soft stools "
            "signals a gastrointestinal imbalance. \n\n"
            "Community Recommended Care:\n"
            "- Ensure unlimited access to high-quality Timothy hay to keep their gut moving.\n"
            "- Temporarily reduce or eliminate watery fresh vegetables.\n"
            "- Keep the guinea pig well-hydrated. If appetite drops, syringe-feed Critical Care immediately.\n"
            "- Note: True diarrhea is a life-threatening emergency in guinea pigs—visit an exotic vet immediately if stools are liquid."
        )
    },
    {
        "category": "Skin, Hair & Parasite Control",
        "keywords": ["patch", "bald", "scratch", "hair", "skin", "bath", "mites", "fungal", "ringworm", "scab", "crusty", "lice", "fur"],
        "advice": (
            "Bald spots, flaky skin, scratching, or scabs are typically caused by fungal infections "
            "(such as Ringworm) or microscopic parasites (such as mange mites).\n\n"
            "Community Recommended Care:\n"
            "- Treat external parasites with veterinary-approved topical Ivermectin or Selamectin (Revolution).\n"
            "- For fungal infections, use an anti-fungal shampoo (like Nizoral or miconazole-based washes) and apply anti-fungal cream (like Clotrimazole).\n"
            "- Disinfect the cage thoroughly and wash all fleece bedding at high temperatures to kill spores/mites."
        )
    },
    {
        "category": "Cage Odor & Cleanliness Management",
        "keywords": ["stinky", "smell", "odor", "clean", "cage", "gnat", "fly", "flies", "fleece", "wash", "bedding", "pee", "dirty"],
        "advice": (
            "Strong odor and gnats are usually caused by moisture build-up in bedding or damp hay.\n\n"
            "Community Recommended Care:\n"
            "- Spot clean high-moisture areas (like sleeping corners or under hay racks) daily.\n"
            "- Switch to high-absorbency washable fleece liners with a thick absorbent layer (like U-Haul pads) underneath to keep the surface dry.\n"
            "- Clean hay racks regularly and remove damp hay off the floor.\n"
            "- Place a pet-safe fruit fly trap (like a Zevo plug-in or vinegar trap) nearby, completely out of reach of the guinea pigs."
        )
    },
    {
        "category": "Eye & Face Injuries",
        "keywords": ["eye", "cloudy", "watery", "poke", "blind", "crusty eye", "squint", "cornea", "tear", "ulcer"],
        "advice": (
            "A cloudy, watery, or squinted eye is typically caused by a physical corneal scratch (known as 'hay poke') "
            "or a serious respiratory infection.\n\n"
            "Community Recommended Care:\n"
            "- Physical eye injuries require a vet visit to perform a fluorescein stain test to check for ulcers.\n"
            "- The vet will prescribe specialized antibiotic eye drops (like Tobramycin or Terramycin).\n"
            "- Warning: Never use leftover steroid eye drops or human eye drops, as they can cause permanent blindness if an ulcer is present."
        )
    },
    {
        "category": "Gender Identification & Sexing",
        "keywords": ["boy", "girl", "sex", "gender", "identify", "male", "female", "baby", "litter", "pregnant"],
        "advice": (
            "Determining the gender of a guinea pig is crucial to prevent accidental litters.\n\n"
            "Community Recommended Care:\n"
            "- Place the guinea pig on a flat surface and gently apply light pressure just above the genital area.\n"
            "- Males: A penis will easily protrude, showing a distinct 'i' shape (a Y-shape with a dot above it).\n"
            "- Females: The genital opening will show a clean, flat 'Y' shape.\n"
            "- Keep males and females separated immediately starting at 3-4 weeks of age to avoid unwanted pregnancies."
        )
    }
]

def get_expert_advice(content: str, query: str) -> dict:
    """Scans content and query for keywords and returns corresponding category and advice."""
    combined_text = (content + " " + query).lower()
    
    # Try to find a matching category
    for kb in ADVICE_KNOWLEDGE_BASE:
        for keyword in kb["keywords"]:
            if keyword in combined_text:
                return {
                    "category": kb["category"],
                    "advice": kb["advice"]
                }
                
    # Fallback default advice
    return {
        "category": "General Guinea Pig Health & Wellness",
        "advice": (
            "For general symptoms, keep a close eye on the guinea pig's eating and drinking habits. \n\n"
            "Community Recommended Care:\n"
            "- Monitor weight weekly (weight loss is the first sign of illness).\n"
            "- Ensure they are getting 80% Timothy hay, high-quality pellets, and daily Vitamin C (either fresh bell peppers or Oxbow tablets).\n"
            "- Consult an exotic veterinarian if they show lethargy, puffed-up fur, or stop eating for more than 12 hours."
        )
    }

@app.post("/search")
async def search_problems(payload: SearchQuery):
    query_text = payload.query.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")

    # 1. Generate embedding for query
    try:
        model = app.state.model
        query_embedding = model.encode(query_text).tolist()
    except Exception as e:
        logger.error(f"Error generating query embedding: {e}")
        raise HTTPException(status_code=500, detail="Failed to vectorize the query.")

    # 2. Connect to database and run cosine similarity search on comments
    try:
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            if db_url.startswith("postgres://"):
                db_url = db_url.replace("postgres://", "postgresql://", 1)
            conn = psycopg2.connect(db_url)
        else:
            conn = psycopg2.connect(**DB_CONFIG)
            
        cursor = conn.cursor()
        
        # pgvector <=> operator computes Cosine Distance on facebook_comments.content
        cursor.execute("""
            SELECT comment_id, parent_post_id, author_name, post_url, content, text_embedding <=> %s::vector AS distance
            FROM facebook_comments
            ORDER BY distance ASC
            LIMIT 15; -- Fetch slightly more to account for threshold filtering
        """, (query_embedding,))
        
        comment_results = cursor.fetchall()
        
        # 3. For each comment with > 50% match, fetch parent post and other thread comments
        formatted_results = []
        for row in comment_results:
            comment_id, parent_post_id, author_name, post_url, content, distance = row
            similarity_score = 1.0 - float(distance) if distance is not None else 0.0
            
            # 1- only show the content which has a match more than 50%
            if similarity_score > 0.50:
                # A. Fetch parent post content if it exists
                cursor.execute("""
                    SELECT content FROM facebook_posts 
                    WHERE legacy_id = %s LIMIT 1;
                """, (parent_post_id,))
                parent_row = cursor.fetchone()
                parent_post_content = parent_row[0] if parent_row else None
                
                # B. Fetch other comments associated with this thread (legacyId)
                cursor.execute("""
                    SELECT author_name, content FROM facebook_comments
                    WHERE parent_post_id = %s AND comment_id != %s
                    LIMIT 3;
                """, (parent_post_id, comment_id))
                other_comments_rows = cursor.fetchall()
                other_replies = [
                    {"author": r[0], "content": r[1]} for r in other_comments_rows
                ]
                
                # C. Extract expert advice category (scanning comment content + user query)
                advice_info = get_expert_advice(content, query_text)
                
                formatted_results.append({
                    "comment_id": comment_id,
                    "parent_post_id": parent_post_id,
                    "url": post_url,
                    "matched_comment": {
                        "author": author_name,
                        "content": content
                    },
                    "parent_post_content": parent_post_content,
                    "other_replies": other_replies,
                    "score": round(similarity_score, 4),
                    "category": advice_info["category"],
                    "advice": advice_info["advice"]
                })

        cursor.close()
        conn.close()
    except Exception as e:
        logger.error(f"Database query or lookup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Database search failed: {str(e)}")

    # Return top 5 matches after filtering
    return {
        "query": query_text,
        "results": formatted_results[:5]
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}


