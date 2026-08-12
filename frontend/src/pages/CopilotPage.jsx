import { useState, useRef, useEffect } from "react";
import DashboardLayout from "../components/DashboardLayout";
import client from "../api/client";

const SUGGESTED = [
  "What is the minimum attendance required?",
  "How do I apply for hostel accommodation?",
  "How do I become eligible for campus placements?",
  "When will the exam timetable be released?",
];

export default function CopilotPage() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! I'm Campus Copilot. Ask me about fees, attendance, exams, hostel, library, or placements.", sources: [] },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;

    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setSending(true);

    try {
      const { data } = await client.post("/chat", { message });
      setMessages((m) => [...m, { role: "bot", text: data.answer, sources: data.sources }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "bot", text: "Sorry, Campus Copilot is unavailable right now. Please try again shortly.", sources: [] }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1>Campus Copilot</h1>
        <p className="subtitle">Instant answers pulled from your college's knowledge base.</p>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="chat-widget">
          <div className="chat-log" ref={logRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role}`}>
                {m.text}
                {m.sources?.length > 0 && (
                  <div className="chat-sources">
                    Related: {m.sources.map((s) => s.question).join(" · ")}
                  </div>
                )}
              </div>
            ))}
            {sending && <div className="chat-bubble bot">Thinking...</div>}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
            {SUGGESTED.map((q) => (
              <button key={q} className="tag-pill" style={{ cursor: "pointer", border: "1px solid var(--line)" }} onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>

          <div className="chat-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about fees, attendance, exams..."
            />
            <button className="btn btn-primary" onClick={() => send()} disabled={sending}>Send</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
