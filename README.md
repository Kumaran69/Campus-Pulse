# Campus Pulse

**One platform that follows a student through college: predicting who's struggling academically, giving every student an AI assistant that actually knows their college, and getting them placement-ready — all from a single login.**

Built by combining three previously separate projects — a RAG chatbot suite, the CV-Genix resume builder, and a student-performance ML model — into one product with four real user roles instead of three disconnected demos.

---

## Who this is for

| Role | What they get |
|---|---|
| **Student** | A personal risk score with plain-English reasons, an AI chatbot for campus FAQs (fees, attendance, exams, hostel), and a resume builder that feeds directly into placement screening |
| **Faculty / Mentor** | A Risk Radar dashboard ranking every student by predicted academic risk, so intervention happens before a student fails, not after |
| **Placement Officer (TPO)** | An AI resume screener that ranks every student's resume against a job description in seconds, with matched/missing skills called out |
| **College Admin** | An institution-wide view: risk distribution, resume completion rate, active postings |

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  React frontend (role-based dashboards)       │
│  Student · Faculty · TPO · Admin               │
└───────────────────┬────────────────────────────┘
                     │  REST (JWT auth)
        ┌────────────┴────────────┐
        │  Node.js / Express API   │  ← auth, profiles, resumes, jobs
        │  (backend/)               │     MongoDB via Mongoose
        └────────────┬────────────┘
                     │
     ┌───────────────┼────────────────────┐
     │                                     │
┌────▼─────────────┐              ┌────────▼──────────┐
│  ml-service        │              │  rag-service        │
│  FastAPI            │              │  FastAPI              │
│  Gradient Boosting  │              │  Campus Copilot chat  │
│  + Random Forest    │              │  + Resume Screener    │
│  ensemble risk model│              │  (TF-IDF retrieval)   │
└─────────────────────┘              └────────────────────────┘
                     │
              MongoDB (shared student data)
```

Each service is independently runnable and independently testable — that's deliberate, so you can demo the ML risk model or the chatbot on its own even before the whole stack is wired up.

### Why TF-IDF instead of LangChain + ChromaDB + Ollama for the RAG service?

The original RAG projects used LangChain, ChromaDB, and Ollama for local, cost-free semantic search. This build uses scikit-learn's TF-IDF vectorizer instead, so the whole stack runs anywhere with **zero external downloads or GPU** — useful for a demo, a free-tier deployment, or a college with no ML infra.

The upgrade path is intentionally a drop-in swap, documented at the top of `rag-service/main.py`:
- Replace `TfidfRetriever` with a ChromaDB collection
- Embed documents with an Ollama-served embedding model
- Replace the extractive answer with an LLM call over the retrieved context (LangChain's `RetrievalQA`, or a direct Ollama call)

The FastAPI route contracts (`/chat`, `/screen`) don't change either way, so the Node backend and React frontend are unaffected by the swap.

---

## Running it locally

### Option A — Docker Compose (recommended)

```bash
docker compose up --build
```

This starts MongoDB, both Python services, the Node API, and the frontend (served via nginx) together.

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- ML service: http://localhost:8001
- RAG service: http://localhost:8002

Then seed demo data:
```bash
docker compose exec backend node seed.js
```

### Option B — Run each service manually

**1. ml-service**
```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --port 8001
```

**2. rag-service**
```bash
cd rag-service
pip install -r requirements.txt
uvicorn main:app --port 8002
```

**3. backend** (needs a running MongoDB — local install or a free MongoDB Atlas cluster)
```bash
cd backend
cp .env.example .env   # edit MONGO_URI if not using localhost
npm install
npm run dev
node seed.js            # optional: populate demo accounts
```

**4. frontend**
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Demo accounts (after running `seed.js`)

| Role | Email | Password |
|---|---|---|
| Faculty | faculty@campuspulse.demo | password123 |
| TPO | tpo@campuspulse.demo | password123 |
| Admin | admin@campuspulse.demo | password123 |
| Student (high risk) | 21cs014@campuspulse.demo | password123 |
| Student (low risk) | 21cs001@campuspulse.demo | password123 |

Or register your own account from the login page and pick any role.

---

## What's implemented vs. what's next

**Working end-to-end today:**
- Role-based auth (JWT) for student / faculty / TPO / admin
- ML risk scoring: trained ensemble, explainable top-3 factors, history tracking
- Campus Copilot: FAQ retrieval chatbot with source attribution
- Resume builder: structured CRUD, feeds a flattened text blob to the screener
- Resume screener: TF-IDF + skill-hit-rate blended ranking
- Faculty Risk Radar, TPO screener, Admin analytics dashboards

**Natural next steps for a real pilot:**
- Bulk import of attendance/grades from the college ERP instead of manual profile edits
- Swap TF-IDF for LangChain + ChromaDB + Ollama (see above) once GPU/local-LLM infra is available
- Notifications (email/SMS) when a student crosses into high risk
- Faculty-to-student messaging inside the platform, not just the risk view
- Audit logging around who viewed which student's risk score (this handles sensitive data — access control matters)

---

## Tech stack

- **Frontend:** React 18, React Router, Vite, custom design system (no UI framework)
- **Backend:** Node.js, Express, MongoDB/Mongoose, JWT auth, bcrypt
- **ML service:** FastAPI, scikit-learn (Gradient Boosting + Random Forest ensemble)
- **RAG service:** FastAPI, scikit-learn TF-IDF (swappable for LangChain/ChromaDB/Ollama)
- **Infra:** Docker Compose, Nginx (frontend serving)
