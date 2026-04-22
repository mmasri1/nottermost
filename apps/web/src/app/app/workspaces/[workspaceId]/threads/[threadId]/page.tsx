"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { CursorPage, Message, WsClientMessage, WsServerMessage } from "@nottermost/shared";
import { apiFetch, getToken } from "../../../../../../lib/api";
import { WorkspaceHeader } from "../../../../../../components/AppShell/WorkspaceHeader";
import { Button } from "../../../../../../components/ui/Button";
import { TextArea } from "../../../../../../components/ui/Input";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";

export default function ThreadPage() {
  const params = useParams<{ workspaceId: string; threadId: string }>();
  const workspaceId = useMemo(() => params.workspaceId, [params.workspaceId]);
  const threadId = useMemo(() => params.threadId, [params.threadId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  async function loadFirstPage() {
    const page = await apiFetch<CursorPage<Message>>(`/dm/threads/${threadId}/messages?limit=30`);
    // API returns newest-first; reverse for chat view.
    setMessages(page.items.slice().reverse());
    setNextCursor(page.nextCursor);
  }

  async function loadOlder() {
    if (!nextCursor) return;
    const page = await apiFetch<CursorPage<Message>>(
      `/dm/threads/${threadId}/messages?limit=30&cursor=${encodeURIComponent(nextCursor)}`,
    );
    const older = page.items.slice().reverse();
    setMessages((prev) => [...older, ...prev]);
    setNextCursor(page.nextCursor);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setError(null);
      try {
        await loadFirstPage();
        if (cancelled) return;

        const token = getToken();
        if (!token) {
          setError("missing_token");
          return;
        }

        const url = new URL(WS_URL);
        url.searchParams.set("token", token);
        const ws = new WebSocket(url.toString());
        wsRef.current = ws;

        ws.addEventListener("open", () => {
          const sub: WsClientMessage = { type: "subscribe.thread", threadId };
          ws.send(JSON.stringify(sub));
        });

        ws.addEventListener("message", (ev) => {
          let msg: WsServerMessage | null = null;
          try {
            msg = JSON.parse(ev.data as string) as WsServerMessage;
          } catch {
            return;
          }
          if (msg.type === "message.created" && msg.message.threadId === threadId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg!.message.id)) return prev;
              return [...prev, msg!.message];
            });
          }
          if (msg.type === "message.updated" && msg.message.threadId === threadId) {
            setMessages((prev) => prev.map((m) => (m.id === msg!.message.id ? { ...m, ...msg!.message } : m)));
          }
          if (msg.type === "typing.updated" && msg.scope === "dm" && msg.threadId === threadId) {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              if (msg.isTyping) next.add(msg.userId);
              else next.delete(msg.userId);
              return next;
            });
          }
        });

        ws.addEventListener("close", () => {
          // noop (minimal local UX)
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "boot_failed");
      }
    }

    void boot();
    return () => {
      cancelled = true;
      const ws = wsRef.current;
      wsRef.current = null;
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [threadId]);

  return (
    <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <WorkspaceHeader title="Direct message" subtitle={`workspace ${workspaceId} · thread ${threadId}`} />

      <div className="card col" style={{ gap: 12, marginTop: 12, flex: 1, minHeight: 0, overflow: "hidden" }}>
        {error ? <div className="error">Error: {error}</div> : null}

        <div className="row" style={{ justifyContent: "space-between" }}>
          <Button variant="secondary" disabled={!nextCursor} onClick={() => void loadOlder()}>
            Load older
          </Button>
          <div className="muted" style={{ fontSize: 12 }}>
            {messages.length} messages
          </div>
        </div>

        <div
          className="col"
          style={{
            gap: 10,
            minHeight: 0,
            overflow: "auto",
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(17,24,39,0.12)",
            background: "rgba(255,255,255,0.65)",
          }}
        >
          {messages.length === 0 ? (
            <div className="muted">No messages yet.</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="col" style={{ gap: 2 }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  {m.senderId} · {new Date(m.createdAt).toLocaleString()}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))
          )}
        </div>

        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const trimmed = body.trim();
            if (!trimmed) return;
            setBody("");
            try {
              await apiFetch<Message>(`/dm/threads/${threadId}/messages`, {
                method: "POST",
                body: JSON.stringify({ body: trimmed }),
              });
              // message will also arrive via WS; keep optimistic UI minimal.
            } catch (err) {
              setError(err instanceof Error ? err.message : "send_failed");
            }
          }}
        >
          <TextArea
            placeholder="Write a message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (e.shiftKey) return;
              e.preventDefault();
              const form = e.currentTarget.form;
              if (!form) return;
              form.requestSubmit();
            }}
            onFocus={() => {
              try {
                wsRef.current?.send(JSON.stringify({ type: "typing.start", scope: "dm", threadId } satisfies WsClientMessage));
              } catch {
                // ignore
              }
            }}
            onBlur={() => {
              try {
                wsRef.current?.send(JSON.stringify({ type: "typing.stop", scope: "dm", threadId } satisfies WsClientMessage));
              } catch {
                // ignore
              }
            }}
          />
          <Button type="submit" disabled={!body.trim()}>
            Send
          </Button>
        </form>

        {typingUsers.size ? (
          <div className="muted" style={{ fontSize: 12 }}>
            Typing: {Array.from(typingUsers).join(", ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

