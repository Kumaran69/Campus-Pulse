import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import client from "../api/client";

export default function TpoJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({ title: "", company: "", description: "", requiredSkills: "" });
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await client.get("/jobs");
    setJobs(data.jobs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const requiredSkills = form.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean);
      await client.post("/jobs", { ...form, requiredSkills });
      setForm({ title: "", company: "", description: "", requiredSkills: "" });
      load();
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1>Job Postings</h1>
        <p className="subtitle">Post a drive, then screen every student resume against it in one click.</p>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="section-title">Active postings</div>
          {loading ? (
            <p>Loading...</p>
          ) : jobs.length === 0 ? (
            <div className="empty-state">No job postings yet. Create your first one.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {jobs.map((j) => (
                <div key={j._id} className="card" style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{j.title}</div>
                      <div className="hint">{j.company}</div>
                    </div>
                    <Link to={`/tpo/screen?jobId=${j._id}`} className="btn btn-primary">Screen candidates</Link>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {(j.requiredSkills || []).map((s) => <span key={s} className="tag-pill">{s}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">New posting</div>
          <form onSubmit={submit}>
            <div className="field">
              <label>Job title</label>
              <input value={form.title} onChange={update("title")} required />
            </div>
            <div className="field">
              <label>Company</label>
              <input value={form.company} onChange={update("company")} required />
            </div>
            <div className="field">
              <label>Job description</label>
              <textarea rows={5} value={form.description} onChange={update("description")} required />
            </div>
            <div className="field">
              <label>Required skills (comma-separated)</label>
              <input value={form.requiredSkills} onChange={update("requiredSkills")} placeholder="Node.js, MongoDB, React" />
            </div>
            <button className="btn btn-primary btn-block" disabled={creating}>
              {creating ? "Posting..." : "Post job"}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
