import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import PulseLine from "../components/PulseLine";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: profileData }, { data: historyData }] = await Promise.all([
          client.get("/students/me/profile"),
          client.get(`/students/${user.id}/risk/history`),
        ]);
        setProfile(profileData.profile);
        setRisk(historyData.history[0] || null);
      } catch (err) {
        setError("Could not load your academic snapshot yet.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user.id]);

  const refreshRisk = async () => {
    setLoading(true);
    try {
      const { data } = await client.post(`/students/${user.id}/risk/compute`);
      setRisk(data.record);
    } catch (err) {
      setError("Risk service is unavailable right now — try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <PulseLine />
        <h1>Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="subtitle">Here's where things stand academically this week.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="two-col">
        <div className="card">
          <div className="section-title">Your risk snapshot</div>

          {risk ? (
            <>
              <span className={`risk-badge ${risk.riskLevel}`}>
                <span className="dot" /> {risk.riskLevel} risk
              </span>
              <p style={{ marginTop: 12, color: "var(--slate-soft)", fontSize: "0.875rem" }}>
                Score: <span className="mono">{(risk.riskScore * 100).toFixed(1)}%</span> · computed{" "}
                {new Date(risk.computedAt).toLocaleDateString()}
              </p>
              {risk.topFactors?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="hint" style={{ marginBottom: 8 }}>Biggest contributing factors</div>
                  {risk.topFactors.map((f) => (
                    <span key={f.factor} className="tag-pill">{f.factor.replaceAll("_", " ")}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "var(--slate-soft)", fontSize: "0.875rem" }}>
              No risk score computed yet. Run your first check-in below.
            </p>
          )}

          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={refreshRisk} disabled={loading}>
            {loading ? "Calculating..." : "Refresh my risk score"}
          </button>
        </div>

        <div className="card">
          <div className="section-title">Your current signals</div>
          {profile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.875rem" }}>
              <Row label="Attendance" value={`${profile.attendancePercent}%`} />
              <Row label="Average grade" value={`${profile.averageGrade}/100`} />
              <Row label="Assignments completed" value={`${profile.assignmentsCompletedPercent}%`} />
              <Row label="Backlogs" value={profile.backlogs} />
              <Row label="LMS logins / week" value={profile.lmsLoginsPerWeek} />
            </div>
          ) : (
            <p style={{ color: "var(--slate-soft)", fontSize: "0.875rem" }}>Loading...</p>
          )}
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: 24 }}>
        <Link to="/student/copilot" className="card" style={{ textDecoration: "none" }}>
          <div className="stat-label">Have a question?</div>
          <div style={{ marginTop: 8, fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "var(--ink)" }}>
            Ask Campus Copilot →
          </div>
        </Link>
        <Link to="/student/resume" className="card" style={{ textDecoration: "none" }}>
          <div className="stat-label">Getting placement-ready?</div>
          <div style={{ marginTop: 8, fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "var(--ink)" }}>
            Update your resume →
          </div>
        </Link>
      </div>
    </DashboardLayout>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
      <span style={{ color: "var(--slate-soft)" }}>{label}</span>
      <span className="mono" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
