import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard() {
  const { college } = useAuth();
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("/analytics/overview").then(({ data }) => setData(data)).catch(() => setError("Could not load institution analytics."));
    client.get("/analytics/audit-logs?limit=15").then(({ data }) => setLogs(data.logs)).catch(() => {});
    client.get("/privacy/deletion-requests").then(({ data }) => setDeletionRequests(data.requests)).catch(() => {});
  }, []);

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1>Institution Overview</h1>
        <p className="subtitle">A single snapshot of student wellbeing and placement readiness.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {college?.code && (
        <div className="card" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="stat-label">Your college join code</div>
            <div className="mono" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)" }}>{college.code}</div>
          </div>
          <p className="hint" style={{ maxWidth: 320, textAlign: "right" }}>
            Share this with students, faculty, and TPOs so they can register under {college.name}.
          </p>
        </div>
      )}

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

      <div className="two-col" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="section-title">Recent data access (audit log)</div>
          {logs.length === 0 ? (
            <div className="empty-state">No activity logged yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {logs.map((l) => (
                <div key={l._id} style={{ fontSize: "0.8rem", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{l.actor?.name || "Unknown"}</span>{" "}
                  <span className="hint">({l.actorRole})</span> — {l.action}
                  {l.targetUser && <> on <span style={{ fontWeight: 600 }}>{l.targetUser.name}</span></>}
                  <div className="hint">{new Date(l.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Pending deletion requests</div>
          {deletionRequests.length === 0 ? (
            <div className="empty-state">No pending requests.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {deletionRequests.map((r) => (
                <div key={r._id} style={{ fontSize: "0.875rem", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{r.user?.name}</span> ({r.user?.role})
                  <div className="hint">Requested {new Date(r.requestedAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
