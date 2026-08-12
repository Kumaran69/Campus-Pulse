import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allow }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) {
    const home = { student: "/student", faculty: "/faculty", tpo: "/tpo", admin: "/admin" }[user.role];
    return <Navigate to={home || "/login"} replace />;
  }
  return children;
}
