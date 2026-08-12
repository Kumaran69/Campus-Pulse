import os
from contextlib import asynccontextmanager

import joblib
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from train import train_and_save, FEATURES

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")
model_bundle = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Train once on first boot if no saved model exists yet (keeps the
    # container self-contained — no separate training step required to
    # get a working demo).
    if not os.path.exists(MODEL_PATH):
        print("[ml-service] no saved model found, training on synthetic data...")
        train_and_save(MODEL_PATH)
    bundle = joblib.load(MODEL_PATH)
    model_bundle["gb"] = bundle["gb"]
    model_bundle["rf"] = bundle["rf"]
    print("[ml-service] model loaded, ready to serve predictions")
    yield
    model_bundle.clear()


app = FastAPI(title="Campus Pulse - Risk Prediction Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class StudentSignals(BaseModel):
    attendance_percent: float = Field(..., ge=0, le=100)
    average_grade: float = Field(..., ge=0, le=100)
    assignments_completed_percent: float = Field(..., ge=0, le=100)
    backlogs: int = Field(..., ge=0)
    lms_logins_per_week: float = Field(..., ge=0)


def level_from_score(score: float) -> str:
    if score < 0.33:
        return "low"
    if score < 0.66:
        return "medium"
    return "high"


def explain(signals: StudentSignals):
    """
    Lightweight, rule-based explainability layer: how far each signal is
    from a "healthy" reference point, weighted by how much that signal
    typically drives risk. This is what faculty see under 'why is this
    student flagged' — it has to be human-readable, not just a SHAP dump.
    """
    healthy = {
        "attendance_percent": 90,
        "average_grade": 75,
        "assignments_completed_percent": 90,
        "backlogs": 0,
        "lms_logins_per_week": 6,
    }
    weights = {
        "attendance_percent": 0.30,
        "average_grade": 0.25,
        "assignments_completed_percent": 0.15,
        "backlogs": 0.20,
        "lms_logins_per_week": 0.10,
    }
    values = signals.model_dump()
    contributions = []
    for feat in FEATURES:
        gap = healthy[feat] - values[feat] if feat != "backlogs" else values[feat] - healthy[feat]
        contribution = max(gap, 0) * weights[feat]
        contributions.append({"factor": feat, "contribution": round(float(contribution), 3)})

    contributions.sort(key=lambda c: c["contribution"], reverse=True)
    return contributions[:3]


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service", "model_loaded": bool(model_bundle)}


@app.post("/predict")
def predict(signals: StudentSignals):
    X = np.array([[
        signals.attendance_percent,
        signals.average_grade,
        signals.assignments_completed_percent,
        signals.backlogs,
        signals.lms_logins_per_week,
    ]])

    gb_prob = model_bundle["gb"].predict_proba(X)[0, 1]
    rf_prob = model_bundle["rf"].predict_proba(X)[0, 1]
    risk_score = float((gb_prob + rf_prob) / 2)

    return {
        "risk_score": round(risk_score, 4),
        "risk_level": level_from_score(risk_score),
        "top_factors": explain(signals),
        "model": "ensemble(gradient_boosting, random_forest)",
    }
