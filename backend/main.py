from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import spacy
import uvicorn
import os

app = FastAPI(title="Warehouse Assistant API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for now, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load spaCy model
try:
    nlp = spacy.load("es_core_news_lg")
    print("SUCCESS: spaCy model 'es_core_news_lg' loaded successfully.")
except OSError:
    print("WARNING: Model 'es_core_news_lg' not found. It should be installed in the Docker build.")
    print("   Run: python -m spacy download es_core_news_lg")
    nlp = None

class TextRequest(BaseModel):
    text: str

@app.get("/")
def read_root():
    return {
        "status": "online", 
        "message": "Warehouse Assistant Brain is Running 🧠",
        "nlp_ready": nlp is not None
    }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # Mock OCR for now (Phase 2 Foundation)
    # TODO: Integrate Google Vision API here
    
    filename = file.filename
    print(f"📥 Received file: {filename}")
    
    return {
        "filename": filename,
        "ocr_text": f"[MOCK OCR] Texto detectado en {filename}. Contenido simulado: 'Llegaron 5 cajas de tornillos ref-202'",
        "status": "processed"
    }

@app.post("/parse")
def parse_text(request: TextRequest):
    if not nlp:
        raise HTTPException(status_code=503, detail="NLP model not loaded")
    
    doc = nlp(request.text)
    
    # Extract entities
    entities = [{"text": ent.text, "label": ent.label_} for ent in doc.ents]
    
    # Mock Intent Detection (To be improved with Rule-Based Logic or Training)
    # Simple keyword matching for prototype
    intent = "UNKNOWN"
    text_lower = request.text.lower()
    
    if any(word in text_lower for word in ["mover", "movido", "llevado", "cambiar"]):
        intent = "MOVE"
    elif any(word in text_lower for word in ["llegado", "recibido", "entrado", "alta"]):
        intent = "ADD"
    elif any(word in text_lower for word in ["regalo", "regalado", "donado"]):
        intent = "GIFT"
    elif any(word in text_lower for word in ["buscar", "donde", "dónde", "encuentra"]):
        intent = "SEARCH"

    return {
        "text": request.text,
        "intent": intent,
        "entities": entities,
        "tokens": [token.text for token in doc]
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
