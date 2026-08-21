import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const HOME_BY_ROLE = { student: "/student", faculty: "/faculty", tpo: "/tpo", admin: "/admin" };

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // login | join | setup
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "student", rollNumber: "", department: "",
    collegeCode: "", consentGiven: false,
    collegeName: "", adminName: "", adminEmail: "", adminPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const { login, register, setupCollege } = useAuth();
  const navigate = useNavigate();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateCheckbox = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const user = await login(form.email, form.password);
        navigate(HOME_BY_ROLE[user.role] || "/student");
      } else if (mode === "join") {
        const user = await register(form);
        navigate(HOME_BY_ROLE[user.role] || "/student");
      } else if (mode === "setup") {
        const { college } = await setupCollege({
          collegeName: form.collegeName,
          adminName: form.adminName,
          adminEmail: form.adminEmail,
          adminPassword: form.adminPassword,
          consentGiven: form.consentGiven,
        });
        // Show the generated join code before continuing, so the admin
        // can copy it down — it's the only place this is surfaced.
        setCreatedCode(college.code);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details?.[0]?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (createdCode) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="name">Your college is set up 🎉</div>
            <div className="tag">Share this code with your students, faculty, and placement team.</div>
          </div>
          <div className="card" style={{ textAlign: "center", background: "var(--paper)", boxShadow: "none" }}>
            <div className="hint">College join code</div>
            <div className="mono" style={{ fontSize: "2rem", fontWeight: 700, color: "var(--ink)", letterSpacing: "0.05em" }}>
              {createdCode}
            </div>
          </div>
          <p className="hint" style={{ marginTop: 16 }}>
            Anyone registering for Campus Pulse at your college will need this code. You can find it again later on your Admin dashboard.
          </p>
          <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={() => navigate("/admin")}>
            Go to my dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="name">Campus Pulse</div>
          <div className="tag">One platform for academics, support, and careers.</div>
        </div>

        <div className="auth-toggle">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>Join a college</button>
          <button className={mode === "setup" ? "active" : ""} onClick={() => setMode("setup")}>New college</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {mode === "login" && (
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={update("email")} required placeholder="you@college.edu" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={form.password} onChange={update("password")} required placeholder="Your password" />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Please wait..." : "Sign in"}
            </button>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={submit}>
            <div className="field">
              <label>College join code</label>
              <input value={form.collegeCode} onChange={update("collegeCode")} required placeholder="e.g. KCET4821" style={{ textTransform: "uppercase" }} />
              <div className="hint">Ask your college admin for this — it's shown on their dashboard.</div>
            </div>
            <div className="field">
              <label>Full name</label>
              <input value={form.name} onChange={update("name")} required placeholder="e.g. Kumaran M" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={update("email")} required placeholder="you@college.edu" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={form.password} onChange={update("password")} required minLength={6} placeholder="At least 6 characters" />
            </div>
            <div className="field">
              <label>I am a...</label>
              <select value={form.role} onChange={update("role")}>
                <option value="student">Student</option>
                <option value="faculty">Faculty / Mentor</option>
                <option value="tpo">Placement Officer (TPO)</option>
                <option value="admin">College Admin</option>
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Roll number</label>
                <input value={form.rollNumber} onChange={update("rollNumber")} placeholder="Optional" />
              </div>
              <div className="field">
                <label>Department</label>
                <input value={form.department} onChange={update("department")} placeholder="e.g. CSE" />
              </div>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.8rem", color: "var(--slate-soft)", marginBottom: 16 }}>
              <input type="checkbox" checked={form.consentGiven} onChange={updateCheckbox("consentGiven")} required style={{ width: "auto", marginTop: 2 }} />
              I consent to Campus Pulse storing my academic data (attendance, grades, resume) to provide risk insights and placement matching to my college. I can request export or deletion of my data at any time.
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Please wait..." : "Create account"}
            </button>
          </form>
        )}

        {mode === "setup" && (
          <form onSubmit={submit}>
            <p className="hint" style={{ marginBottom: 16 }}>
              Setting up Campus Pulse for your college for the first time? This creates your college's private workspace and your admin account.
            </p>
            <div className="field">
              <label>College name</label>
              <input value={form.collegeName} onChange={update("collegeName")} required placeholder="e.g. Kamaraj College of Engineering and Technology" />
            </div>
            <div className="field">
              <label>Your name</label>
              <input value={form.adminName} onChange={update("adminName")} required placeholder="e.g. Dr. Meena Raghavan" />
            </div>
            <div className="field">
              <label>Your email</label>
              <input type="email" value={form.adminEmail} onChange={update("adminEmail")} required placeholder="admin@college.edu" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={form.adminPassword} onChange={update("adminPassword")} required minLength={6} placeholder="At least 6 characters" />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "0.8rem", color: "var(--slate-soft)", marginBottom: 16 }}>
              <input type="checkbox" checked={form.consentGiven} onChange={updateCheckbox("consentGiven")} required style={{ width: "auto", marginTop: 2 }} />
              I understand I'm creating a private workspace for my college and am authorized to manage student data on its behalf, in line with applicable data protection regulations.
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Setting up..." : "Create my college's workspace"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
