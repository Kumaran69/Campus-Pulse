import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import client from "../api/client";

export default function TpoScreenerPage() {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("jobId");
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(jobId || "");
  const [rankings, setRankings] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    client.get("/jobs").then(({ data }) => setJobs(data.jobs));
  }, []);

  useEffect(() => {
    if (selectedJobId) runScreen(selectedJobId);
  }, [selectedJobId]);

  const runScreen = async (id) => {
    setLoading(true);
    setRankings(null);
    try {
      const { data } = await client.get(`/jobs/${id}/screen`);
      setJob(data.job);
      setRankings(data.rankings);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1>Resume Screener</h1>
        <p className="subtitle">AI-ranked candidates, matched against the job description and required skills.</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="field" style={{ maxWidth: 420, marginBottom: 0 }}>
          <label>Choose a job posting</label>
          <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
            <option value="">Select a posting...</option>
            {jobs.map((j) => (
              <option key={j._id} value={j._id}>{j.title} — {j.company}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p>Screening candidates...</p>}

      {rankings && (
        <div className="card">
          <div className="section-title">
            Ranked candidates for {job?.title} ({job?.company})
          </div>
          {rankings.length === 0 ? (
            <div className="empty-state">No student resumes available to screen yet.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Candidate</th>
                  <th>Match score</th>
                  <th>Matched skills</th>
                  <th>Missing skills</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, i) => (
                  <tr key={r.candidateId}>
                    <td className="mono">#{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 60, height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                          <div style={{ width: `${r.matchScore * 100}%`, height: "100%", background: "var(--marigold)" }} />
                        </div>
                        <span className="mono">{(r.matchScore * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td>{r.matchedSkills.map((s) => <span key={s} className="tag-pill matched">{s}</span>)}</td>
                    <td>{r.missingSkills.map((s) => <span key={s} className="tag-pill missing">{s}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
