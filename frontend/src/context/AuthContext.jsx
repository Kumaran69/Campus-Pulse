import { createContext, useContext, useState, useCallback } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("campus_pulse_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [college, setCollege] = useState(() => {
    const raw = localStorage.getItem("campus_pulse_college");
    return raw ? JSON.parse(raw) : null;
  });

  const persistSession = (token, user, college) => {
    localStorage.setItem("campus_pulse_token", token);
    localStorage.setItem("campus_pulse_user", JSON.stringify(user));
    if (college) localStorage.setItem("campus_pulse_college", JSON.stringify(college));
    setUser(user);
    setCollege(college || null);
  };

  const login = useCallback(async (email, password) => {
    const { data } = await client.post("/auth/login", { email, password });
    persistSession(data.token, data.user, data.college);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await client.post("/auth/register", payload);
    persistSession(data.token, data.user, data.college);
    return data.user;
  }, []);

  // Creates a brand new college tenant plus its first admin account in one step.
  const setupCollege = useCallback(async (payload) => {
    const { data } = await client.post("/colleges/setup", payload);
    persistSession(data.token, data.user, data.college);
    return { user: data.user, college: data.college };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("campus_pulse_token");
    localStorage.removeItem("campus_pulse_user");
    localStorage.removeItem("campus_pulse_college");
    setUser(null);
    setCollege(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, college, login, register, setupCollege, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
