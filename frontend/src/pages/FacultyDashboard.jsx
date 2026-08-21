import { useEffect, useState, useRef } from "react";
import DashboardLayout from "../components/DashboardLayout";
import client from "../api/client";

export default function FacultyDashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await client.post("/students/bulk-import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(data);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not import that CSV. Check the format and try again.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">Bulk update attendance & grades</div>
        <p style={{ fontSize: "0.875rem", color: "var(--slate-soft)", marginBottom: 12 }}>
          Upload a CSV with columns: <code className="mono">rollNumber, attendancePercent, averageGrade, assignmentsCompletedPercent, backlogs, lmsLoginsPerWeek</code>.
          Only students already registered at your college will be updated — unmatched roll numbers are reported back.
        </p>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvUpload} disabled={importing} />
        {importing && <p className="hint" style={{ marginTop: 8 }}>Importing...</p>}
        {importResult && (
          <div style={{ marginTop: 12, fontSize: "0.875rem" }}>
            <p style={{ color: "var(--sage)", fontWeight: 600 }}>Updated {importResult.updated} student{importResult.updated === 1 ? "" : "s"}.</p>
            {importResult.skipped.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", color: "var(--terracotta)" }}>
                  {importResult.skipped.length} row{importResult.skipped.length === 1 ? "" : "s"} skipped
                </summary>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  {importResult.skipped.slice(0, 20).map((s, i) => (
                    <li key={i} className="hint">{s.reason}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
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
