import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const HOME_BY_ROLE = { student: "/student", faculty: "/faculty", tpo: "/tpo", admin: "/admin" };

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student", rollNumber: "", department: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = mode === "login" ? await login(form.email, form.password) : await register(form);
      navigate(HOME_BY_ROLE[user.role] || "/student");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="name">Campus Pulse</div>
          <div className="tag">One platform for academics, support, and careers.</div>
        </div>

        <div className="auth-toggle">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={submit}>
          {mode === "register" && (
            <div className="field">
              <label>Full name</label>
              <input value={form.name} onChange={update("name")} required placeholder="e.g. Kumaran M" />
            </div>
          )}

          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={update("email")} required placeholder="you@college.edu" />
          </div>

          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={update("password")} required minLength={6} placeholder="At least 6 characters" />
          </div>

          {mode === "register" && (
            <>
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
            </>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
