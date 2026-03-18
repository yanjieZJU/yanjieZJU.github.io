import { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import './ChatPage.css';

const API_BASE = 'http://localhost:8000';

// ── Detect if the user wants an image ──────────────────────────────────────
const IMAGE_KEYWORDS = [
  /^(draw|generate|create|make|show|paint|render|design|illustrate)\b/i,
  /\b(image|picture|photo|illustration|diagram|chart|figure|poster|logo|icon)\b/i,
  /生成.*(图|图片|图像|插图|海报)/,
  /画.*(图|图片|图像)/,
];
function isImageRequest(text) {
  return IMAGE_KEYWORDS.some((re) => re.test(text));
}

// ── Session storage (localStorage) ─────────────────────────────────────────
function createSession() {
  return {
    id: `chat_${Date.now()}`,
    startedAt: new Date().toISOString(),
    title: '',  // will be set to first user message
    turns: [],  // { role, type, content, timestamp, durationMs? }
  };
}

function saveSession(session) {
  try {
    const key = `chatlog_${session.id}`;
    localStorage.setItem(key, JSON.stringify(session));
    const index = JSON.parse(localStorage.getItem('chatlog_index') || '[]');
    if (!index.includes(session.id)) {
      index.push(session.id);
      localStorage.setItem('chatlog_index', JSON.stringify(index));
    }
  } catch (_) {}
}

function deleteSession(sessionId) {
  try {
    localStorage.removeItem(`chatlog_${sessionId}`);
    const index = JSON.parse(localStorage.getItem('chatlog_index') || '[]');
    localStorage.setItem('chatlog_index', JSON.stringify(index.filter((id) => id !== sessionId)));
  } catch (_) {}
}

function renameSession(sessionId, newTitle) {
  try {
    const key = `chatlog_${sessionId}`;
    const session = JSON.parse(localStorage.getItem(key) || 'null');
    if (!session) return;
    session.title = newTitle;
    localStorage.setItem(key, JSON.stringify(session));
  } catch (_) {}
}

function loadSession(sessionId) {
  try {
    const key = `chatlog_${sessionId}`;
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (_) {
    return null;
  }
}

function getAllSessions() {
  const index = JSON.parse(localStorage.getItem('chatlog_index') || '[]');
  return index.map(loadSession).filter(Boolean).sort((a, b) =>
    new Date(b.startedAt) - new Date(a.startedAt)
  );
}

async function exportLogs() {
  const sessions = getAllSessions();
  const zip = new JSZip();

  for (const session of sessions) {
    const folder = zip.folder(session.id);
    let imageIndex = 1;
    const turnsForExport = session.turns.map((turn) => {
      if (turn.type === 'image' && turn.content) {
        const filename = `image_${String(imageIndex).padStart(3, '0')}.png`;
        folder.file(filename, turn.content, { base64: true });
        imageIndex++;
        return { ...turn, content: `[See ${filename}]` };
      }
      return turn;
    });
    folder.file('session.json', JSON.stringify({
      id: session.id,
      title: session.title,
      startedAt: session.startedAt,
      turns: turnsForExport,
    }, null, 2));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat_logs_${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Message bubble ──────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';

  function downloadImage() {
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${msg.content}`;
    a.download = `image_${Date.now()}.png`;
    a.click();
  }

  return (
    <div className={`chat-message ${isUser ? 'chat-message--user' : 'chat-message--assistant'}`}>
      <div className="chat-avatar">{isUser ? '🧑' : '🤖'}</div>
      <div className="chat-bubble">
        {msg.type === 'image' ? (
          <div className="chat-image-wrap">
            <img
              src={`data:image/png;base64,${msg.content}`}
              alt="generated"
              className="chat-image"
            />
            <button className="chat-img-dl" onClick={downloadImage} title="Download image">↓ Download</button>
          </div>
        ) : msg.type === 'error' ? (
          <span className="chat-error">{msg.content}</span>
        ) : (
          <span className="chat-text">{msg.content}</span>
        )}
        <span className="chat-ts">{new Date(msg.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

// ── Typing indicator ────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="chat-message chat-message--assistant">
      <div className="chat-avatar">🤖</div>
      <div className="chat-bubble chat-bubble--typing">
        <span /><span /><span />
      </div>
    </div>
  );
}

// ── Main ChatPage ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ragQuery, setRagQuery] = useState(null); // non-null while RAG retrieval is in progress
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionList, setSessionList] = useState(() => getAllSessions());
  // rename state: { id, value } | null
  const [renaming, setRenaming] = useState(null);
  // context menu state: { id, x, y } | null
  const [ctxMenu, setCtxMenu] = useState(null);
  const sessionRef = useRef(createSession());
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // auto-scroll to bottom
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastAssistant = useCallback((patch) => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') {
        copy[copy.length - 1] = { ...last, ...patch };
      }
      return copy;
    });
  }, []);

  function persistSession(extraTurns) {
    const session = sessionRef.current;
    session.turns.push(...extraTurns);
    if (!session.title) {
      const firstUser = session.turns.find((t) => t.role === 'user');
      session.title = firstUser ? firstUser.content.slice(0, 40) : 'Untitled';
    }
    saveSession(session);
    setSessionList(getAllSessions());
  }

  async function sendText(userText, historyForApi) {
    const t0 = Date.now();
    const placeholder = { role: 'assistant', type: 'text', content: '', timestamp: new Date().toISOString() };
    appendMessage(placeholder);

    let fullContent = '';
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'tool_call') {
              setRagQuery(evt.query || '...');
            } else if (evt.type === 'delta') {
              setRagQuery(null);
              fullContent += evt.content;
              updateLastAssistant({ content: fullContent });
            } else if (evt.type === 'done') {
              setRagQuery(null);
            } else if (evt.type === 'error') {
              setRagQuery(null);
              updateLastAssistant({ type: 'error', content: evt.message });
              fullContent = evt.message;
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      setRagQuery(null);
      updateLastAssistant({ type: 'error', content: err.message });
      fullContent = err.message;
    }

    setRagQuery(null);
    const durationMs = Date.now() - t0;
    const assistantMsg = { role: 'assistant', type: 'text', content: fullContent, timestamp: new Date().toISOString(), durationMs };
    persistSession([
      { role: 'user', type: 'text', content: userText, timestamp: new Date().toISOString() },
      assistantMsg,
    ]);
  }

  async function sendImage(userText) {
    const t0 = Date.now();
    const placeholder = { role: 'assistant', type: 'text', content: '🎨 Generating image…', timestamp: new Date().toISOString() };
    appendMessage(placeholder);

    // Build text-only history for context (skip previous images to save tokens)
    const history = [...messages].flatMap((m) => {
      if (m.role === 'user' && m.type === 'text' && m.content) return [{ role: 'user', content: m.content }];
      if (m.role === 'assistant' && m.type === 'text' && m.content) return [{ role: 'assistant', content: m.content }];
      return [];
    });

    let assistantMsg;
    try {
      const res = await fetch(`${API_BASE}/chat/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText, history }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      assistantMsg = { role: 'assistant', type: 'image', content: data.b64, timestamp: new Date().toISOString(), durationMs: Date.now() - t0 };
      updateLastAssistant(assistantMsg);
    } catch (err) {
      assistantMsg = { role: 'assistant', type: 'error', content: err.message, timestamp: new Date().toISOString(), durationMs: Date.now() - t0 };
      updateLastAssistant(assistantMsg);
    }

    persistSession([
      { role: 'user', type: 'text', content: userText, timestamp: new Date().toISOString() },
      assistantMsg,
    ]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    const userMsg = { role: 'user', type: 'text', content: text, timestamp: new Date().toISOString() };
    appendMessage(userMsg);

    if (isImageRequest(text)) {
      await sendImage(text);
    } else {
      const history = [...messages, userMsg].flatMap((m) => {
        if (m.role === 'user') return [{ role: 'user', content: m.content }];
        if (m.type === 'text' && m.content) return [{ role: 'assistant', content: m.content }];
        if (m.type === 'image' && m.content) {
          return [{
            role: 'assistant',
            content: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${m.content}` } }],
          }];
        }
        return [];
      });
      await sendText(text, history);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleNewChat() {
    setMessages([]);
    sessionRef.current = createSession();
    inputRef.current?.focus();
  }

  function handleLoadSession(session) {
    // Reconstruct messages from stored turns (pair user+assistant)
    setMessages(session.turns.map((t) => ({
      role: t.role,
      type: t.type,
      content: t.content,
      timestamp: t.timestamp,
    })));
    // Point sessionRef to the loaded session so new messages append to it
    sessionRef.current = { ...session };
    inputRef.current?.focus();
  }

  function formatSessionDate(iso) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function handleContextMenu(e, sessionId) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ id: sessionId, x: e.clientX, y: e.clientY });
  }

  function handleCtxDelete() {
    if (!ctxMenu) return;
    const id = ctxMenu.id;
    setCtxMenu(null);
    deleteSession(id);
    setSessionList(getAllSessions());
    // if we deleted the active session, start fresh
    if (sessionRef.current.id === id) {
      setMessages([]);
      sessionRef.current = createSession();
    }
  }

  function handleCtxRename() {
    if (!ctxMenu) return;
    const session = sessionList.find((s) => s.id === ctxMenu.id);
    setRenaming({ id: ctxMenu.id, value: session?.title || '' });
    setCtxMenu(null);
  }

  function commitRename(id) {
    const value = renaming?.value?.trim();
    if (value) {
      renameSession(id, value);
      // also update in-memory sessionRef if it's the active session
      if (sessionRef.current.id === id) sessionRef.current.title = value;
      setSessionList(getAllSessions());
    }
    setRenaming(null);
  }

  // close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [ctxMenu]);

  return (
    <div className="chat-page">
      {/* ── Context menu ── */}
      {ctxMenu && (
        <ul
          className="chat-ctx-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <li onClick={handleCtxRename}>✏️ Rename</li>
          <li className="chat-ctx-menu__danger" onClick={handleCtxDelete}>🗑️ Delete</li>
        </ul>
      )}

      {/* ── Sidebar ── */}
      <aside className={`chat-sidebar ${sidebarOpen ? 'chat-sidebar--open' : ''}`}>
        <div className="chat-sidebar__header">
          <span className="chat-sidebar__title">History</span>
          <button className="chat-sidebar__new" onClick={handleNewChat} title="New chat">＋</button>
        </div>
        <div className="chat-sidebar__list">
          {sessionList.length === 0 && (
            <p className="chat-sidebar__empty">No conversations yet.</p>
          )}
          {sessionList.map((s) => {
            const isActive = s.id === sessionRef.current.id;
            const isRenaming = renaming?.id === s.id;
            const preview = s.turns.find((t) => t.role === 'user')?.content || 'Empty';
            return (
              <div
                key={s.id}
                className={`chat-sidebar__item ${isActive ? 'chat-sidebar__item--active' : ''}`}
                onClick={() => !isRenaming && handleLoadSession(s)}
                onContextMenu={(e) => handleContextMenu(e, s.id)}
              >
                {isRenaming ? (
                  <input
                    className="chat-sidebar__rename-input"
                    autoFocus
                    value={renaming.value}
                    onChange={(e) => setRenaming((r) => ({ ...r, value: e.target.value }))}
                    onBlur={() => commitRename(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(s.id);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="chat-sidebar__item-title">{s.title || preview.slice(0, 36)}</span>
                )}
                <span className="chat-sidebar__item-date">{formatSessionDate(s.startedAt)}</span>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="chat-main">
        {/* ── Header ── */}
        <header className="chat-header">
          <button className="chat-header__toggle" onClick={() => setSidebarOpen((v) => !v)} title="Toggle history">
            ☰
          </button>
          <button className="chat-header__back" onClick={() => (window.location.hash = '')}>
            ← DiaMaid
          </button>
          <span className="chat-header__title">LLM Chat</span>
          <div className="chat-header__actions">
            <button className="chat-btn chat-btn--ghost" onClick={handleNewChat}>New Chat</button>
            <button className="chat-btn chat-btn--ghost" onClick={exportLogs} title="Export all sessions as zip (images as PNG files)">
              Export Logs
            </button>
          </div>
        </header>

        {/* ── Message list ── */}
        <div className="chat-list" ref={listRef}>
          {messages.length === 0 && (
            <div className="chat-empty">
              <p>Start a conversation.</p>
              <p className="chat-empty__hint">
                Type a message to chat · Include "draw" or "image" to generate a picture.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          {ragQuery && (
            <div className="chat-rag-status">
              <span className="chat-rag-status__icon" />
              <span className="chat-rag-status__text">查阅文献中：{ragQuery}</span>
            </div>
          )}
          {loading && <TypingIndicator />}
        </div>

        {/* ── Input bar ── */}
        <div className="chat-inputbar">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Message… (Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={loading}
          />
          <button
            className="chat-btn chat-btn--send"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            {loading ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
