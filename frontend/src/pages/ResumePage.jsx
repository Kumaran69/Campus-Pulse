import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import client from "../api/client";

const EMPTY = {
  fullName: "",
  headline: "",
  summary: "",
  skills: [],
  education: [{ institution: "", degree: "", startYear: "", endYear: "", score: "" }],
  experience: [],
  projects: [{ title: "", description: "", techStack: [], link: "" }],
};

export default function ResumePage() {
  const [form, setForm] = useState(EMPTY);
  const [skillsInput, setSkillsInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await client.get("/resumes/me");
        if (data.resume) {
          setForm({ ...EMPTY, ...data.resume });
          setSkillsInput((data.resume.skills || []).join(", "));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const updateListItem = (listKey, idx, field) => (e) => {
    setForm((f) => {
      const list = [...f[listKey]];
      list[idx] = { ...list[idx], [field]: e.target.value };
      return { ...f, [listKey]: list };
    });
  };

  const addListItem = (listKey, template) => setForm((f) => ({ ...f, [listKey]: [...f[listKey], template] }));
  const removeListItem = (listKey, idx) => setForm((f) => ({ ...f, [listKey]: f[listKey].filter((_, i) => i !== idx) }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const skills = skillsInput.split(",").map((s) => s.trim()).filter(Boolean);
      const payload = { ...form, skills };
      const { data } = await client.put("/resumes/me", payload);
      setForm({ ...EMPTY, ...data.resume });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="page-header"><h1>Resume Builder</h1></div>
        <p>Loading...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1>Resume Builder</h1>
        <p className="subtitle">This data feeds the AI screener TPOs use to shortlist candidates — keep it current.</p>
      </div>

      <div className="two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <div className="section-title">Basics</div>
            <div className="field">
              <label>Full name</label>
              <input value={form.fullName || ""} onChange={updateField("fullName")} />
            </div>
            <div className="field">
              <label>Headline</label>
              <input value={form.headline || ""} onChange={updateField("headline")} placeholder="e.g. Final-year CSE student, MERN stack developer" />
            </div>
            <div className="field">
              <label>Summary</label>
              <textarea rows={3} value={form.summary || ""} onChange={updateField("summary")} />
            </div>
            <div className="field">
              <label>Skills (comma-separated)</label>
              <input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="Node.js, React, MongoDB, Python" />
            </div>
          </div>

          <div className="card">
            <div className="section-title">Projects</div>
            {form.projects.map((p, i) => (
              <div key={i} style={{ borderBottom: i < form.projects.length - 1 ? "1px solid var(--line)" : "none", paddingBottom: 16, marginBottom: 16 }}>
                <div className="field">
                  <label>Title</label>
                  <input value={p.title} onChange={updateListItem("projects", i, "title")} />
                </div>
                <div className="field">
                  <label>Description</label>
                  <textarea rows={2} value={p.description} onChange={updateListItem("projects", i, "description")} />
                </div>
                <button className="btn btn-ghost" onClick={() => removeListItem("projects", i)}>Remove project</button>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={() => addListItem("projects", { title: "", description: "", techStack: [], link: "" })}>
              + Add project
            </button>
          </div>

          <div className="card">
            <div className="section-title">Education</div>
            {form.education.map((ed, i) => (
              <div key={i} className="field-row" style={{ marginBottom: 12 }}>
                <div className="field">
                  <label>Institution</label>
                  <input value={ed.institution} onChange={updateListItem("education", i, "institution")} />
                </div>
                <div className="field">
                  <label>Degree</label>
                  <input value={ed.degree} onChange={updateListItem("education", i, "degree")} />
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save resume"}
          </button>
          {saved && <p className="hint" style={{ color: "var(--sage)" }}>Saved — your resume is up to date.</p>}
        </div>

        <div className="card">
          <div className="section-title">Live preview</div>
          <h3 style={{ fontSize: "1.1rem" }}>{form.fullName || "Your name"}</h3>
          <p style={{ color: "var(--slate-soft)", fontSize: "0.875rem", marginTop: 4 }}>{form.headline || "Your headline"}</p>
          <p style={{ fontSize: "0.875rem", marginTop: 12 }}>{form.summary}</p>
          <div style={{ marginTop: 12 }}>
            {skillsInput.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
              <span key={s} className="tag-pill">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
