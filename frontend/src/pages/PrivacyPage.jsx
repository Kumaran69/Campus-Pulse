import { useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import client from "../api/client";

export default function PrivacyPage() {
  const [exporting, setExporting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const downloadExport = async () => {
    setExporting(true);
    setError("");
    try {
      const res = await client.get("/privacy/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "campus-pulse-my-data.json");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError("Could not generate your data export right now. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const requestDeletion = async () => {
    if (!window.confirm("This sends a request to your college admin to delete your account and data. Continue?")) return;
    setRequesting(true);
    setError("");
    setMessage("");
    try {
      await client.post("/privacy/delete-request");
      setMessage("Your deletion request has been sent to your college admin for review.");
    } catch (err) {
      setError(err.response?.data?.error || "Could not submit your request. Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1>My Data & Privacy</h1>
        <p className="subtitle">What Campus Pulse holds about you, and how to control it.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="card" style={{ background: "rgba(107,144,128,0.1)", border: "none", marginBottom: 24, color: "var(--sage)" }}>{message}</div>}

      <div className="two-col">
        <div className="card">
          <div className="section-title">Download my data</div>
          <p style={{ fontSize: "0.875rem", color: "var(--slate-soft)", marginBottom: 16 }}>
            Get a copy of everything Campus Pulse stores about you — your account details, and if you're a student,
            your academic profile, resume, and risk score history — as a JSON file.
          </p>
          <button className="btn btn-primary" onClick={downloadExport} disabled={exporting}>
            {exporting ? "Preparing..." : "Download my data"}
          </button>
        </div>

        <div className="card">
          <div className="section-title">Request account deletion</div>
          <p style={{ fontSize: "0.875rem", color: "var(--slate-soft)", marginBottom: 16 }}>
            Request that your account and associated data be removed. This is sent to your college admin for review —
            academic records may need a retention check before deletion, so it isn't instant.
          </p>
          <button className="btn btn-ghost" onClick={requestDeletion} disabled={requesting}>
            {requesting ? "Sending..." : "Request deletion"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="section-title">What we collect and why</div>
        <p style={{ fontSize: "0.875rem", color: "var(--slate-soft)", lineHeight: 1.6 }}>
          Campus Pulse collects academic signals (attendance, grades, assignment completion) to compute a risk score
          that helps your mentors support you before problems compound. Resume data is used only to match you against
          job postings your placement office adds. Every access to your risk score or resume by staff is logged for
          accountability. Data is scoped to your college only — no other institution using Campus Pulse can see it.
        </p>
      </div>
    </DashboardLayout>
  );
}
