"""
Trains the academic-risk ensemble on synthetic-but-realistic data.

Why synthetic data: this is a demo/portfolio deployment with no real
institutional dataset wired in yet. The generation logic below encodes
domain-reasonable rules (low attendance + backlogs + low engagement ->
higher risk) so the model behaves sensibly out of the box. Swap this
script for a real loader (CSV export from the college ERP, etc.) once
actual student records are available — the FastAPI service and the
feature contract (see FEATURES below) do not need to change.
"""

import numpy as np
import joblib
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score

FEATURES = [
    "attendance_percent",
    "average_grade",
    "assignments_completed_percent",
    "backlogs",
    "lms_logins_per_week",
]

RNG = np.random.default_rng(42)


def generate_synthetic_dataset(n=4000):
    attendance = np.clip(RNG.normal(80, 15, n), 30, 100)
    grade = np.clip(RNG.normal(68, 18, n), 0, 100)
    assignments = np.clip(RNG.normal(82, 18, n), 0, 100)
    backlogs = np.clip(RNG.poisson(0.8, n), 0, 8)
    lms_logins = np.clip(RNG.normal(5, 3, n), 0, 20)

    # Weighted risk signal -> probability -> binary label with noise,
    # so the model learns a smooth, explainable boundary rather than a
    # hard rule.
    risk_signal = (
        (100 - attendance) * 0.035
        + (100 - grade) * 0.03
        + (100 - assignments) * 0.015
        + backlogs * 0.35
        + np.clip(3 - lms_logins, 0, 3) * 0.25
    )
    prob = 1 / (1 + np.exp(-(risk_signal - 4.0)))
    label = (RNG.random(n) < prob).astype(int)

    X = np.column_stack([attendance, grade, assignments, backlogs, lms_logins])
    return X, label


def train_and_save(path="model.joblib"):
    X, y = generate_synthetic_dataset()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    gb = GradientBoostingClassifier(n_estimators=150, max_depth=3, learning_rate=0.08, random_state=42)
    rf = RandomForestClassifier(n_estimators=200, max_depth=6, random_state=42)

    gb.fit(X_train, y_train)
    rf.fit(X_train, y_train)

    # Simple ensemble: average the two models' probability outputs.
    gb_pred = gb.predict_proba(X_test)[:, 1]
    rf_pred = rf.predict_proba(X_test)[:, 1]
    ensemble_pred = (gb_pred + rf_pred) / 2

    acc = accuracy_score(y_test, ensemble_pred > 0.5)
    auc = roc_auc_score(y_test, ensemble_pred)
    print(f"[train] holdout accuracy={acc:.3f} auc={auc:.3f}")

    joblib.dump({"gb": gb, "rf": rf, "features": FEATURES}, path)
    print(f"[train] saved ensemble to {path}")


if __name__ == "__main__":
    train_and_save()
