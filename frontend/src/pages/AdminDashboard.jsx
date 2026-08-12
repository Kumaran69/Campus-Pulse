import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import client from "../api/client";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/analytics/overview")
      .then(({ data }) => setData(data))
      .catch(() => setError("Could not load institution analytics."));
  }, []);

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1>Institution Overview</h1>
        <p className="subtitle">A single snapshot of student wellbeing and placement readiness.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {data && (
        <>
          <div className="card-grid">
            <Stat label="Students" value={data.counts.students} />
            <Stat label="Faculty" value={data.counts.faculty} />
            <Stat label="Placement officers" value={data.counts.tpo} />
            <Stat label="Active job postings" value={data.counts.activeJobs} />
          </div>

          <div className="two-col">
            <div className="card">
              <div className="section-title">Risk distribution (latest scores)</div>
              <RiskBar label="High risk" value={data.riskBuckets.high} color="var(--terracotta)" total={sumBuckets(data.riskBuckets)} />
              <RiskBar label="Medium risk" value={data.riskBuckets.medium} color="var(--amber-warn)" total={sumBuckets(data.riskBuckets)} />
              <RiskBar label="Low risk" value={data.riskBuckets.low} color="var(--sage)" total={sumBuckets(data.riskBuckets)} />
            </div>

            <div className="card">
              <div className="section-title">Placement readiness</div>
              <div className="stat-value" style={{ fontSize: "2.5rem" }}>{data.resumeCompletionRate}%</div>
              <p className="hint" style={{ marginTop: 8 }}>
                of students have completed a resume ({data.counts.resumes} of {data.counts.students})
              </p>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

function sumBuckets(b) { return (b.high || 0) + (b.medium || 0) + (b.low || 0) || 1; }

function Stat({ label, value }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function RiskBar({ label, value, color, total }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: 6 }}>
        <span>{label}</span>
        <span className="mono">{value} students</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}
