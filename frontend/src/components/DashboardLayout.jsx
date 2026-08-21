import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_BY_ROLE = {
  student: [
    { to: "/student", label: "My Pulse" },
    { to: "/student/copilot", label: "Campus Copilot" },
    { to: "/student/resume", label: "Resume Builder" },
  ],
  faculty: [
    { to: "/faculty", label: "Risk Radar" },
  ],
  tpo: [
    { to: "/tpo", label: "Job Postings" },
    { to: "/tpo/screen", label: "Resume Screener" },
  ],
  admin: [
    { to: "/admin", label: "Institution Overview" },
  ],
};

export default function DashboardLayout({ children }) {
  const { user, college, logout } = useAuth();
  const links = [...(NAV_BY_ROLE[user?.role] || []), { to: "/privacy", label: "My Data & Privacy" }];
  const initials = (user?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg className="mark" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="15" cy="15" r="14" stroke="#F4A93A" strokeWidth="2" />
            <path d="M4,15 L10,15 L13,7 L17,23 L20,15 L26,15" stroke="#F4A93A" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="name">Campus Pulse</span>
        </div>
        {college?.name && (
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginBottom: 4, marginTop: -16, lineHeight: 1.3 }}>
            {college.name}
          </div>
        )}
        <div className="sidebar-role">{user?.role} view</div>

        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={["/student", "/faculty", "/tpo", "/admin"].includes(l.to)}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{initials}</div>
            <div>
              <div>{user?.name}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="main-area">{children}</main>
    </div>
  );
}
