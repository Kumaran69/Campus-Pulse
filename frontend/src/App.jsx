import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import AuthPage from "./pages/AuthPage";
import StudentDashboard from "./pages/StudentDashboard";
import CopilotPage from "./pages/CopilotPage";
import ResumePage from "./pages/ResumePage";
import FacultyDashboard from "./pages/FacultyDashboard";
import TpoJobsPage from "./pages/TpoJobsPage";
import TpoScreenerPage from "./pages/TpoScreenerPage";
import AdminDashboard from "./pages/AdminDashboard";
import PrivacyPage from "./pages/PrivacyPage";

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const home = { student: "/student", faculty: "/faculty", tpo: "/tpo", admin: "/admin" }[user.role];
  return <Navigate to={home || "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<AuthPage />} />

          <Route path="/student" element={<ProtectedRoute allow={["student"]}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/copilot" element={<ProtectedRoute allow={["student"]}><CopilotPage /></ProtectedRoute>} />
          <Route path="/student/resume" element={<ProtectedRoute allow={["student"]}><ResumePage /></ProtectedRoute>} />

          <Route path="/faculty" element={<ProtectedRoute allow={["faculty", "admin"]}><FacultyDashboard /></ProtectedRoute>} />

          <Route path="/tpo" element={<ProtectedRoute allow={["tpo", "admin"]}><TpoJobsPage /></ProtectedRoute>} />
          <Route path="/tpo/screen" element={<ProtectedRoute allow={["tpo", "admin"]}><TpoScreenerPage /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute allow={["admin"]}><AdminDashboard /></ProtectedRoute>} />

          <Route path="/privacy" element={<ProtectedRoute allow={["student", "faculty", "tpo", "admin"]}><PrivacyPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
