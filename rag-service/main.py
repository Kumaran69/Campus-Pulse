"""
Campus Pulse - Knowledge & Matching Service.

Two jobs live here because they share the same retrieval primitive
(TF-IDF + cosine similarity over text):
  1. /chat    -> Campus Copilot: answers student questions from the FAQ
                 knowledge base.
  2. /screen  -> Resume Screener: ranks candidate resumes against a job
                 description for the TPO dashboard.

PRODUCTION UPGRADE PATH (documented, not wired by default):
This demo uses scikit-learn's TF-IDF vectorizer so the service runs
anywhere with zero external dependencies or downloads. Kumaran's
original RAG projects used LangChain + ChromaDB + Ollama for local,
cost-free semantic embeddings — swap that in here by:
  - replacing TfidfRetriever with a ChromaDB collection
  - embedding documents with an Ollama-served embedding model
  - replacing the extractive answer below with an LLM call
    (LangChain's RetrievalQA chain, or a direct Ollama /generate call)
    over the top-k retrieved chunks.
The FastAPI route contracts (/chat, /screen) stay identical either way,
so the Node backend and React frontend never need to change.
"""

import json
import os
from typing import List, Optional

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

KB_PATH = os.path.join(os.path.dirname(__file__), "knowledge_base.json")

app = FastAPI(title="Campus Pulse - Knowledge & Matching Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class TfidfRetriever:
    """Minimal local vector-search stand-in: fit once, query many times."""

    def __init__(self, documents: List[dict], text_key: str = "text"):
        self.documents = documents
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        self.matrix = self.vectorizer.fit_transform([d[text_key] for d in documents])

    def query(self, text: str, top_k: int = 3):
        query_vec = self.vectorizer.transform([text])
        scores = cosine_similarity(query_vec, self.matrix).flatten()
        ranked_idx = np.argsort(scores)[::-1][:top_k]
        return [(self.documents[i], float(scores[i])) for i in ranked_idx]


# --- Load Campus Copilot's FAQ knowledge base at startup ---
with open(KB_PATH) as f:
    raw_kb = json.load(f)
for entry in raw_kb:
    entry["text"] = f"{entry['question']} {entry['answer']}"
kb_retriever = TfidfRetriever(raw_kb)


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []
    user_role: Optional[str] = "student"


@app.get("/health")
def health():
    return {"status": "ok", "service": "rag-service", "kb_size": len(raw_kb)}


@app.post("/chat")
def chat(req: ChatRequest):
    results = kb_retriever.query(req.message, top_k=3)
    best_doc, best_score = results[0]

    if best_score < 0.12:
        answer = (
            "I couldn't find anything specific to that in the campus knowledge base. "
            "Try rephrasing, or reach out to your department office / mentor directly — "
            "I'm most reliable on fees, attendance, exams, hostel, library, and placement questions."
        )
        sources = []
    else:
        # Extractive answer: return the matched FAQ's answer directly.
        # Swap for an LLM call over the retrieved context for a more
        # conversational, synthesized response (see module docstring).
        answer = best_doc["answer"]
        sources = [
            {"id": d["id"], "question": d["question"], "relevance": round(s, 3)}
            for d, s in results
            if s > 0.05
        ]

    return {"answer": answer, "sources": sources}


class Candidate(BaseModel):
    id: str
    name: str
    text: str


class ScreenRequest(BaseModel):
    job_description: str
    required_skills: Optional[List[str]] = []
    candidates: List[Candidate]


@app.post("/screen")
def screen(req: ScreenRequest):
    if not req.candidates:
        return {"rankings": []}

    documents = [{"id": c.id, "name": c.name, "text": c.text} for c in req.candidates]
    retriever = TfidfRetriever(documents)

    query_text = req.job_description + " " + " ".join(req.required_skills or [])
    matches = retriever.query(query_text, top_k=len(documents))

    rankings = []
    for doc, similarity in matches:
        candidate_text_lower = doc["text"].lower()
        matched_skills = [s for s in (req.required_skills or []) if s.lower() in candidate_text_lower]
        missing_skills = [s for s in (req.required_skills or []) if s.lower() not in candidate_text_lower]

        # Blend semantic similarity with an explicit required-skills hit rate,
        # so a resume can't rank #1 purely by generic wording overlap.
        skill_hit_rate = len(matched_skills) / len(req.required_skills) if req.required_skills else 1.0
        final_score = 0.6 * similarity + 0.4 * skill_hit_rate

        rankings.append({
            "candidateId": doc["id"],
            "name": doc["name"],
            "matchScore": round(float(final_score), 4),
            "semanticSimilarity": round(float(similarity), 4),
            "matchedSkills": matched_skills,
            "missingSkills": missing_skills,
        })

    rankings.sort(key=lambda r: r["matchScore"], reverse=True)
    return {"rankings": rankings}
