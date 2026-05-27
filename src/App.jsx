import { useState, useRef, useEffect } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [filename, setFilename]   = useState("");
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [dragOver, setDragOver]   = useState(false);
  const bottomRef                 = useRef(null);
  const fileInputRef              = useRef(null);

  // Scroll to latest message whenever messages or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function uploadFile(file) {
    if (!file) return;
    setError("");
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res  = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setSessionId(data.session_id);
      setFilename(data.filename);
      setMessages([]);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function sendMessage() {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg     = { role: "user", content: question };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res  = await fetch(`${API}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          question,
          history: messages, // prior turns only; backend appends the current question
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Chat failed");
      setMessages([...nextHistory, { role: "assistant", content: data.answer }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function clearSession() {
    if (sessionId) {
      await fetch(`${API}/session/${sessionId}`, { method: "DELETE" }).catch(() => {});
    }
    setSessionId(null);
    setFilename("");
    setMessages([]);
    setError("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  // ── Upload screen ──────────────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className="upload-screen">
        <div className="upload-card">
          <h1>Document Q&amp;A</h1>
          <p className="subtitle">Upload a document and chat with it</p>

          <div
            className={`drop-zone ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
            onClick={() => !uploading && fileInputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {uploading ? (
              <>
                <div className="spinner" />
                <p>Indexing document…</p>
              </>
            ) : (
              <>
                <div className="upload-icon">📄</div>
                <p><strong>Click to upload</strong> or drag &amp; drop</p>
                <p className="file-types">.txt &nbsp;·&nbsp; .csv &nbsp;·&nbsp; .pdf</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.pdf"
            style={{ display: "none" }}
            onChange={(e) => uploadFile(e.target.files[0])}
          />

          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Chat screen ────────────────────────────────────────────────────────────
  return (
    <div className="chat-screen">
      <header className="chat-header">
        <span className="doc-name">📄 {filename}</span>
        <button className="clear-btn" onClick={clearSession}>✕ Clear</button>
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <p className="empty-hint">Ask anything about <strong>{filename}</strong></p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`bubble-row ${msg.role}`}>
            <div className="bubble">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="bubble-row assistant">
            <div className="bubble typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className="chat-error">{error}</p>}

      <div className="input-bar">
        <textarea
          rows={1}
          placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
