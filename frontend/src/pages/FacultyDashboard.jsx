import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import client from "../api/client";

export default function FacultyDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/students/radar");
      setRows(data.rows);
    } catch (err) {
      setError("Could not load the risk radar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const computeFor = async (userId) => {
    await client.post(`/students/${userId}/risk/compute`);
    load();
  };

  const filtered = rows.filter((r) => filter === "all" || r.latestRisk?.riskLevel === filter);
  const counts = { high: 0, medium: 0, low: 0, unscored: 0 };
  rows.forEach((r) => {
    if (!r.latestRisk) counts.unscored += 1;
    else counts[r.latestRisk.riskLevel] += 1;
  });

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1>Risk Radar</h1>
        <p className="subtitle">Students ranked by predicted academic risk — highest first.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card-grid">
        <Stat label="High risk" value={counts.high} color="var(--terracotta)" />
        <Stat label="Medium risk" value={counts.medium} color="var(--amber-warn)" />
        <Stat label="Low risk" value={counts.low} color="var(--sage)" />
        <Stat label="Not yet scored" value={counts.unscored} color="var(--slate-soft)" />
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["all", "high", "medium", "low"].map((f) => (
            <button
              key={f}
              className="btn btn-ghost"
              style={{ background: filter === f ? "var(--paper)" : "transparent", fontWeight: filter === f ? 700 : 500 }}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All students" : `${f} risk`}
            </button>
          ))}
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No students match this filter yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Dept / Year</th>
                <th>Attendance</th>
                <th>Backlogs</th>
                <th>Risk</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.student.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.student.name}</div>
                    <div className="hint">{r.student.rollNumber || "—"}</div>
                  </td>
                  <td>{r.student.department || "—"} · Y{r.student.year || "—"}</td>
                  <td className="mono">{r.profile?.attendancePercent ?? "—"}%</td>
                  <td className="mono">{r.profile?.backlogs ?? "—"}</td>
                  <td>
                    {r.latestRisk ? (
                      <span className={`risk-badge ${r.latestRisk.riskLevel}`}>
                        <span className="dot" /> {r.latestRisk.riskLevel}
                      </span>
                    ) : (
                      <span className="hint">Not scored</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-ghost" onClick={() => computeFor(r.student.id)}>
                      Recompute
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
    </div>
  );
}
