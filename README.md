# Campus Pulse

**One platform that follows a student through college: predicting who's struggling academically, giving every student an AI assistant that actually knows their college, and getting them placement-ready — all from a single login.**

Multi-tenant by design: any number of colleges can run on one deployment, each with fully isolated data.

---

## Who this is for

| Role | What they get |
|---|---|
| **Student** | A personal risk score with plain-English reasons, an AI chatbot for campus FAQs, a resume builder that feeds placement screening, and full control over their own data |
| **Faculty / Mentor** | A Risk Radar dashboard ranking every student by predicted risk, plus CSV bulk import so attendance/grades don't need manual entry |
| **Placement Officer (TPO)** | An AI resume screener that ranks every student's resume against a job description in seconds |
| **College Admin** | Institution-wide analytics, the college's join code, an audit trail of who accessed what, and a queue of data-deletion requests |

---

## What's new in this version

- **Multi-tenancy** — any college can self-serve onboard via `/api/colleges/setup`, gets a private workspace and a join code, and can never see another college's data
- **CSV bulk import** — faculty upload one CSV to update attendance/grades for the whole class instead of editing profiles by hand
- **Email notifications** — students get emailed automatically when they cross into high risk (works out of the box in dev mode by logging to console; wire in real SMTP for production)
- **Consent & privacy** — explicit consent checkbox at signup, self-service data export (`/api/privacy/export`), and a deletion-request queue admins review
- **Security hardening** — helmet, rate limiting, input validation on every write route, NoSQL-injection protection, and an audit log of every access to sensitive student data

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  React frontend (role-based dashboards)       │
│  Student · Faculty · TPO · Admin               │
└───────────────────┬────────────────────────────┘
                     │  REST (JWT auth, collegeId embedded in token)
        ┌────────────┴────────────┐
        │  Node.js / Express API   │  ← auth, colleges, profiles, resumes, jobs, privacy
        │  (backend/)               │     MongoDB via Mongoose, every collection college-scoped
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
              MongoDB (shared, tenant-isolated by collegeId)
```

---

## Running it locally

### Option A — Docker Compose (recommended)

```bash
docker compose up -d --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- ML service: http://localhost:8001
- RAG service: http://localhost:8002

Then seed a demo college with data:
```bash
docker compose exec backend node seed.js
```

Always use `-d` (detached) so the stack survives terminal closes — see the FAQ below if you've hit `exited with code 137` before.

### Option B — Run each service manually

**1. ml-service**
```bash
cd ml-service && pip install -r requirements.txt && uvicorn main:app --port 8001
```

**2. rag-service**
```bash
cd rag-service && pip install -r requirements.txt && uvicorn main:app --port 8002
```

**3. backend** (needs a running MongoDB)
```bash
cd backend
cp .env.example .env   # edit MONGO_URI if not using localhost
npm install
npm run dev
node seed.js            # optional: populate demo college + accounts
```

**4. frontend**
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Demo accounts (after running `seed.js`)

College join code: **`DEMO1234`**

| Role | Email | Password |
|---|---|---|
| Faculty | faculty@campuspulse.demo | password123 |
| TPO | tpo@campuspulse.demo | password123 |
| Admin | admin@campuspulse.demo | password123 |
| Student (low risk) | 21cs001@campuspulse.demo | password123 |
| Student (high risk) | 21cs014@campuspulse.demo | password123 |

Or, on the login screen, click **"New college"** to set up your own tenant from scratch — you'll get a fresh join code to share with your own test accounts.

---

## Onboarding a new college (multi-tenancy)

1. Whoever is setting up Campus Pulse for a college goes to the login screen → **"New college"** → fills in college name + their own admin details → agrees to the consent notice.
2. This calls `POST /api/colleges/setup`, which creates a `College` document and that person as its first `admin` user, and returns a generated join code (e.g. `KCET4821`).
3. The admin shares that code with students, faculty, and TPOs. Everyone else registers via **"Join a college"**, entering the code.
4. Optionally, the admin can restrict registration to official email domains by setting `emailDomains` on the `College` document directly in MongoDB (e.g. `["kcet.ac.in"]`) — there's no UI for this yet, it's a one-line update via `mongosh` or Compass. See "Natural next steps" below.

Every subsequent request carries `collegeId` inside the JWT, and every route that touches student data filters by it — a user from one college can never read or write another college's records, even by guessing IDs.

---

## CSV bulk import format

Faculty/admin can upload a CSV on the Risk Radar page with these columns:

```csv
rollNumber,attendancePercent,averageGrade,assignmentsCompletedPercent,backlogs,lmsLoginsPerWeek
21CS001,92,84,95,0,8
21CS014,58,46,40,3,1
```

- Matches rows to existing students by `rollNumber` **within the uploader's own college** — a student must already have an account (registered via the college's join code) before their row will match.
- Unmatched roll numbers are reported back in the response, not silently dropped.
- Max 2000 rows / 2MB per upload.

---

## Email notifications

Configured via environment variables on the backend (`.env` or `docker-compose.yml`):

```
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=Campus Pulse <no-reply@yourcollege.edu>
```

Without `SMTP_HOST` set, the backend runs in **dev mode**: instead of sending real email, it logs what would have been sent to the console (visible via `docker compose logs backend`). This means notifications work end-to-end for testing without needing a real mail account.

Currently triggers on: a student's risk score crossing into `high`.

---

## Privacy & compliance

- **Consent**: required checkbox at registration and college setup; timestamp stored on the user record (`consentGiven`, `consentAt`)
- **Right to access**: `GET /api/privacy/export` — any logged-in user can download everything Campus Pulse holds about them as JSON (account info, and for students: academic profile, resume, risk history)
- **Right to erasure**: `POST /api/privacy/delete-request` queues a request rather than instantly deleting — academic records may need a retention check first. Admins review pending requests on their dashboard / `GET /api/privacy/deletion-requests`
- **Audit trail**: every view of a student's risk score/history, the Risk Radar, a resume by non-owners, and each resume-screener run is logged (`GET /api/analytics/audit-logs`, admin-only)

This is a *starting point* for India's DPDP Act (2023) and similar regulations elsewhere — not a substitute for a real legal/compliance review before handling real student data at scale.

---

## Security & hardening

- **Helmet** — standard security headers
- **Rate limiting** — 300 req/15min per IP generally, 20 req/15min on `/api/auth` and `/api/colleges` (account-creation endpoints) specifically
- **express-mongo-sanitize** — blocks NoSQL operator-injection payloads
- **express-validator** on every write route — bad input gets a clean `400` instead of reaching the database
- **asyncHandler** wrapping — every route's errors reach the centralized handler instead of hanging the request; 500s never leak stack traces to the client
- **Cross-tenant guards** — every route touching a specific student/resume/job verifies it belongs to the caller's own college before acting on it

---

## Why TF-IDF instead of LangChain + ChromaDB + Ollama for the RAG service?

The original RAG projects used LangChain, ChromaDB, and Ollama for local, cost-free semantic search. This build uses scikit-learn's TF-IDF vectorizer instead, so the whole stack runs anywhere with **zero external downloads or GPU**.

The upgrade path is a documented drop-in swap at the top of `rag-service/main.py`:
- Replace `TfidfRetriever` with a ChromaDB collection
- Embed documents with an Ollama-served embedding model
- Replace the extractive answer with an LLM call over the retrieved context

The `/chat` and `/screen` route contracts don't change either way, so the Node backend and React frontend are unaffected by the swap.

---

## What's implemented vs. what's next

**Working end-to-end:**
- Multi-tenant college setup, join codes, cross-tenant data isolation
- Role-based auth (JWT) for student / faculty / TPO / admin, with consent tracking
- ML risk scoring: trained ensemble, explainable top-3 factors, history, email alerts on high risk
- CSV bulk import for attendance/grades
- Campus Copilot: FAQ retrieval chatbot with source attribution
- Resume builder + AI resume screener (TF-IDF + skill-hit-rate blended ranking)
- Faculty Risk Radar, TPO screener, Admin analytics + audit log + deletion queue
- Self-service data export and deletion requests
- Security hardening: rate limiting, validation, sanitization, audit logging

**Natural next steps for a real multi-college product:**
- Subdomain-based tenant routing (`kcet.campuspulse.app`) instead of a shared login screen with a join code
- Admin UI for setting a college's allowed email domains (currently a manual DB edit)
- Real ERP/LMS integration instead of CSV upload, once a college's system is known
- Weekly digest emails to faculty, not just individual high-risk alerts
- Swap TF-IDF for LangChain + ChromaDB + Ollama once GPU/local-LLM infra is available
- A proper legal/compliance review of the DPDP Act (or equivalent) before onboarding real student data at scale
- CI pipeline running the syntax/build checks this project was validated with locally

---

## Tech stack

- **Frontend:** React 18, React Router, Vite, custom design system (no UI framework)
- **Backend:** Node.js, Express, MongoDB/Mongoose, JWT auth, bcrypt, helmet, express-validator, express-rate-limit, express-mongo-sanitize, nodemailer, csv-parse, multer
- **ML service:** FastAPI, scikit-learn (Gradient Boosting + Random Forest ensemble)
- **RAG service:** FastAPI, scikit-learn TF-IDF (swappable for LangChain/ChromaDB/Ollama)
- **Infra:** Docker Compose, Nginx (frontend serving, with SPA fallback routing)
