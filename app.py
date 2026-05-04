from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from supabase import create_client
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from pathlib import Path
import anthropic
import base64
import json
import os
import shutil
import tempfile
import uuid

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

load_dotenv()

app = Flask(__name__)
CORS(app)

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

UPLOAD_BASE = Path("uploads")
ALLOWED_EXT = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MEDIA_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}

EXTRACTION_PROMPT = """Extract reservation metadata from this travel document and return a JSON object with exactly these fields:
{
  "type": "<one of: flight, hotel, car, train, activity, dining, transport, other>",
  "vendor": "<airline, hotel, car rental company, or service name>",
  "confirmation_number": "<booking reference or confirmation code>",
  "start_date": "<YYYY-MM-DD or null>",
  "end_date": "<YYYY-MM-DD or null>",
  "start_time": "<HH:MM in 24h format or null>",
  "location": "<airport codes, hotel address, pickup location, or route>",
  "notes": "<seat, room type, car class, flight number, or other key details>"
}
Return only the JSON object — no markdown, no explanation."""


# ── Helpers ───────────────────────────────────────────────

def user_from_token(token: str):
    return supabase.auth.get_user(token.replace("Bearer ", "")).user

def save_upload(src: str, original_name: str, res_type: str) -> str:
    folder = UPLOAD_BASE / res_type
    folder.mkdir(parents=True, exist_ok=True)
    ext = Path(original_name).suffix.lower()
    dest = folder / f"{uuid.uuid4().hex}{ext}"
    shutil.move(src, dest)
    return str(dest)

def extract_pdf_text(path: str) -> str:
    if not HAS_PDFPLUMBER:
        return ""
    with pdfplumber.open(path) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)

def claude_extract(content: str, is_image: bool, media_type: str = "") -> dict:
    ac = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_KEY"))
    if is_image:
        msg_content = [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": content}},
            {"type": "text", "text": EXTRACTION_PROMPT},
        ]
    else:
        msg_content = f"Document text:\n\n{content[:8000]}\n\n{EXTRACTION_PROMPT}"

    resp = ac.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        messages=[{"role": "user", "content": msg_content}],
    )
    text = resp.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)


# ── Health ────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


# ── Auth ──────────────────────────────────────────────────

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.json
    supabase.auth.sign_up({"email": data["email"], "password": data["password"]})
    return jsonify({"message": "Check your email to confirm signup"})

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    resp = supabase.auth.sign_in_with_password({"email": data["email"], "password": data["password"]})
    return jsonify({"access_token": resp.session.access_token, "user": resp.user.email})


# ── Trips ─────────────────────────────────────────────────

@app.route("/api/trips", methods=["GET"])
def get_trips():
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("trips").select("*").order("start_date").execute().data)

@app.route("/api/trips", methods=["POST"])
def create_trip():
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("trips").insert(request.json).execute().data), 201

@app.route("/api/trips/<trip_id>", methods=["PUT"])
def update_trip(trip_id):
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("trips").update(request.json).eq("id", trip_id).execute().data)

@app.route("/api/trips/<trip_id>", methods=["DELETE"])
def delete_trip(trip_id):
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    c.table("trips").delete().eq("id", trip_id).execute()
    return jsonify({"message": "Trip deleted"})


# ── Documents ─────────────────────────────────────────────

@app.route("/api/documents", methods=["GET"])
def get_documents():
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("documents").select("*").order("expiry_date").execute().data)

@app.route("/api/documents", methods=["POST"])
def create_document():
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("documents").insert(request.json).execute().data), 201

@app.route("/api/documents/<doc_id>", methods=["PUT"])
def update_document(doc_id):
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("documents").update(request.json).eq("id", doc_id).execute().data)

@app.route("/api/documents/<doc_id>", methods=["DELETE"])
def delete_document(doc_id):
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    c.table("documents").delete().eq("id", doc_id).execute()
    return jsonify({"message": "Document deleted"})


# ── Loyalty ───────────────────────────────────────────────

@app.route("/api/loyalty", methods=["GET"])
def get_loyalty():
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("loyalty_accounts").select("*").order("program").execute().data)

@app.route("/api/loyalty", methods=["POST"])
def create_loyalty():
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("loyalty_accounts").insert(request.json).execute().data), 201

@app.route("/api/loyalty/<loyalty_id>", methods=["PUT"])
def update_loyalty(loyalty_id):
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("loyalty_accounts").update(request.json).eq("id", loyalty_id).execute().data)

@app.route("/api/loyalty/<loyalty_id>", methods=["DELETE"])
def delete_loyalty(loyalty_id):
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    c.table("loyalty_accounts").delete().eq("id", loyalty_id).execute()
    return jsonify({"message": "Loyalty account deleted"})


# ── Itinerary ─────────────────────────────────────────────

@app.route("/api/itinerary/<trip_id>", methods=["GET"])
def get_itinerary(trip_id):
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("itinerary_items").select("*").eq("trip_id", trip_id).order("item_date").order("sort_order").execute().data)

@app.route("/api/itinerary", methods=["POST"])
def create_itinerary_item():
    token = request.headers.get("Authorization")
    c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    c.auth.set_session(token, token)
    return jsonify(c.table("itinerary_items").insert(request.json).execute().data), 201


# ── Reservations (AI import) ───────────────────────────────

@app.route("/api/reservations/import", methods=["POST"])
def import_reservation():
    token = request.headers.get("Authorization", "")
    file = request.files.get("file")
    trip_id = request.form.get("trip_id") or None

    if not file or not file.filename:
        return jsonify({"error": "No file provided"}), 400

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        return jsonify({"error": f"Unsupported type. Allowed: {', '.join(sorted(ALLOWED_EXT))}"}), 400

    is_image = ext in IMAGE_EXT
    tmp_path = None

    try:
        # Write to temp file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        tmp_path = tmp.name
        tmp.close()
        file.save(tmp_path)

        # Extract & call Claude
        if is_image:
            with open(tmp_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            metadata = claude_extract(b64, is_image=True, media_type=MEDIA_TYPES[ext])
        else:
            text = extract_pdf_text(tmp_path)
            if not text.strip():
                return jsonify({"error": "Could not extract text from PDF"}), 422
            metadata = claude_extract(text, is_image=False)

        res_type = metadata.get("type", "other")

        # Move file to typed subfolder — temp file is consumed here
        file_path = save_upload(tmp_path, secure_filename(file.filename), res_type)
        tmp_path = None  # moved; don't delete in finally

        user = user_from_token(token)
        row = {
            "user_id": user.id,
            "trip_id": trip_id,
            "type": res_type,
            "vendor": metadata.get("vendor"),
            "confirmation_number": metadata.get("confirmation_number"),
            "start_date": metadata.get("start_date"),
            "end_date": metadata.get("end_date"),
            "start_time": metadata.get("start_time"),
            "location": metadata.get("location"),
            "notes": metadata.get("notes"),
            "file_path": file_path,
            "file_name": file.filename,
        }

        result = supabase.table("reservations").insert(row).execute()
        return jsonify(result.data[0]), 201

    except json.JSONDecodeError:
        return jsonify({"error": "Claude could not extract structured data from this document"}), 422
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

@app.route("/api/reservations", methods=["GET"])
def get_reservations():
    token = request.headers.get("Authorization", "")
    trip_id = request.args.get("trip_id")
    user = user_from_token(token)
    query = supabase.table("reservations").select("*").eq("user_id", user.id).order("start_date")
    if trip_id:
        query = query.eq("trip_id", trip_id)
    return jsonify(query.execute().data)

@app.route("/api/reservations/<res_id>", methods=["PUT"])
def update_reservation(res_id):
    result = supabase.table("reservations").update(request.json).eq("id", res_id).execute()
    return jsonify(result.data)

@app.route("/api/reservations/<res_id>", methods=["DELETE"])
def delete_reservation(res_id):
    row = supabase.table("reservations").select("file_path").eq("id", res_id).execute().data
    if row:
        fp = Path(row[0].get("file_path", ""))
        if fp.exists():
            fp.unlink()
    supabase.table("reservations").delete().eq("id", res_id).execute()
    return jsonify({"message": "Reservation deleted"})

@app.route("/api/reservations/<res_id>/file", methods=["GET"])
def serve_reservation_file(res_id):
    row = supabase.table("reservations").select("file_path, file_name").eq("id", res_id).execute().data
    if not row:
        return jsonify({"error": "Not found"}), 404
    fp = Path(row[0]["file_path"])
    return send_from_directory(str(fp.parent.resolve()), fp.name, as_attachment=False)


# ── AI chat ───────────────────────────────────────────────

@app.route("/api/ai", methods=["POST"])
def ai_chat():
    data = request.json
    ac = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_KEY"))
    resp = ac.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        system=data.get("system", "You are a helpful travel assistant."),
        messages=data.get("messages", []),
    )
    return jsonify({"content": resp.content[0].text})


@app.route("/")
def serve_frontend():
    return send_from_directory(".", "travel-hub.html")


if __name__ == "__main__":
    app.run(debug=True)
