from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client
from dotenv import load_dotenv
import os
from flask import send_from_directory
import anthropic

load_dotenv()
ANTHROPIC_KEY = os.getenv("ANTHROPIC_KEY")

app = Flask(__name__)
CORS(app)

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# ── Health check ──────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

# ── Auth ──────────────────────────────────────────────────
@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.json
    response = supabase.auth.sign_up({
        "email": data["email"],
        "password": data["password"]
    })
    return jsonify({"message": "Check your email to confirm signup"})

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    response = supabase.auth.sign_in_with_password({
        "email": data["email"],
        "password": data["password"]
    })
    return jsonify({
        "access_token": response.session.access_token,
        "user": response.user.email
    })

# ── Trips ─────────────────────────────────────────────────
@app.route("/api/trips", methods=["GET"])
def get_trips():
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    response = client.table("trips").select("*").order("start_date").execute()
    return jsonify(response.data)

@app.route("/api/trips", methods=["POST"])
def create_trip():
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    data = request.json
    response = client.table("trips").insert(data).execute()
    return jsonify(response.data), 201

@app.route("/api/trips/<trip_id>", methods=["PUT"])
def update_trip(trip_id):
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    data = request.json
    response = client.table("trips").update(data).eq("id", trip_id).execute()
    return jsonify(response.data)

@app.route("/api/trips/<trip_id>", methods=["DELETE"])
def delete_trip(trip_id):
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    client.table("trips").delete().eq("id", trip_id).execute()
    return jsonify({"message": "Trip deleted"})

# ── Documents ─────────────────────────────────────────────
@app.route("/api/documents", methods=["GET"])
def get_documents():
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    response = client.table("documents").select("*").order("expiry_date").execute()
    return jsonify(response.data)

@app.route("/api/documents", methods=["POST"])
def create_document():
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    data = request.json
    response = client.table("documents").insert(data).execute()
    return jsonify(response.data), 201

@app.route("/api/documents/<doc_id>", methods=["PUT"])
def update_document(doc_id):
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    data = request.json
    response = client.table("documents").update(data).eq("id", doc_id).execute()
    return jsonify(response.data)

@app.route("/api/documents/<doc_id>", methods=["DELETE"])
def delete_document(doc_id):
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    client.table("documents").delete().eq("id", doc_id).execute()
    return jsonify({"message": "Document deleted"})

# ── Loyalty Accounts ──────────────────────────────────────
@app.route("/api/loyalty", methods=["GET"])
def get_loyalty():
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    response = client.table("loyalty_accounts").select("*").order("program").execute()
    return jsonify(response.data)

@app.route("/api/loyalty", methods=["POST"])
def create_loyalty():
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    data = request.json
    response = client.table("loyalty_accounts").insert(data).execute()
    return jsonify(response.data), 201

@app.route("/api/loyalty/<loyalty_id>", methods=["PUT"])
def update_loyalty(loyalty_id):
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    data = request.json
    response = client.table("loyalty_accounts").update(data).eq("id", loyalty_id).execute()
    return jsonify(response.data)

@app.route("/api/loyalty/<loyalty_id>", methods=["DELETE"])
def delete_loyalty(loyalty_id):
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    client.table("loyalty_accounts").delete().eq("id", loyalty_id).execute()
    return jsonify({"message": "Loyalty account deleted"})

# ── Itinerary ─────────────────────────────────────────────
@app.route("/api/itinerary/<trip_id>", methods=["GET"])
def get_itinerary(trip_id):
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    response = client.table("itinerary_items").select("*").eq("trip_id", trip_id).order("item_date").order("sort_order").execute()
    return jsonify(response.data)

@app.route("/api/itinerary", methods=["POST"])
def create_itinerary_item():
    token = request.headers.get("Authorization")
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    client.auth.set_session(token, token)
    data = request.json
    response = client.table("itinerary_items").insert(data).execute()
    return jsonify(response.data), 201

@app.route("/api/ai", methods=["POST"])
def ai_chat():
    data = request.json
    messages = data.get("messages", [])
    system = data.get("system", "You are a helpful travel assistant.")
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        system=system,
        messages=messages
    )
    return jsonify({"content": response.content[0].text})

@app.route('/')
def serve_frontend():
    return send_from_directory('.', 'travel-hub.html')

if __name__ == "__main__":
    app.run(debug=True)