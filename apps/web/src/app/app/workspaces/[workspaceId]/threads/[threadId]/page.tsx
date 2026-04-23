"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { CursorPage, Message, WsClientMessage, WsServerMessage } from "@nottermost/shared";
import { apiFetch, apiUploadFile, getToken } from "../../../../../../lib/api";
import { mergeReactionWs } from "../../../../../../lib/reactions";
import { ChatMessageRow } from "../../../../../../components/chat/ChatMessageRow";
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
  const [pendingUploads, setPendingUploads] = useState<
    Array<{ id: string; filename: string; url: string; sizeBytes: number; contentType: string }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const myUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);

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
        const me = await apiFetch<{ id: string }>("/workspaces/me");
        if (cancelled) return;
        myUserIdRef.current = me.id;
        setMyUserId(me.id);

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
              const m = msg!.message;
              return [...prev, { ...m, reactions: m.reactions ?? [] }];
            });
          }
          if (msg.type === "message.updated" && msg.message.threadId === threadId) {
            setMessages((prev) => prev.map((m) => (m.id === msg!.message.id ? { ...m, ...msg!.message } : m)));
          }
          if (msg.type === "reaction.updated" && msg.scope === "dm" && msg.threadId === threadId) {
            const uid = myUserIdRef.current;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msg.messageId ? { ...m, reactions: mergeReactionWs(uid, m.reactions, msg) } : m,
              ),
            );
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

        <div className="chatMetaRow">
          <Button variant="secondary" disabled={!nextCursor} onClick={() => void loadOlder()}>
            Load older
          </Button>
          <div className="muted" style={{ fontSize: 12 }}>
            {messages.length} messages
          </div>
        </div>

        <div className="chatSurface">
          <div className="chatScroll">
            {messages.length === 0 ? <div className="muted">No messages yet.</div> : null}
            {messages.map((m) => (
              <ChatMessageRow
                key={m.id}
                variant="dm"
                threadId={threadId}
                message={m}
                myUserId={myUserId}
                onError={(err) => setError(err)}
              />
            ))}
          </div>
        </div>

        <form
          className="chatComposer"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const trimmed = body.trim();
            if (!trimmed && pendingUploads.length === 0) return;
            setBody("");
            try {
              await apiFetch<Message>(`/dm/threads/${threadId}/messages`, {
                method: "POST",
                body: JSON.stringify({ body: trimmed || " ", fileIds: pendingUploads.map((f) => f.id) }),
              });
              setPendingUploads([]);
              // message will also arrive via WS; keep optimistic UI minimal.
            } catch (err) {
              setError(err instanceof Error ? err.message : "send_failed");
            }
          }}
        >
          <div className="chatComposerRow">
            <div className="col" style={{ gap: 8 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <label className="uiLink" style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
                  Attach
                  <input
                    type="file"
                    multiple
                    disabled={uploading}
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (!files.length) return;
                      e.target.value = "";
                      setUploading(true);
                      try {
                        for (const f of files) {
                          const uploaded = await apiUploadFile({ workspaceId, threadId, file: f });
                          setPendingUploads((prev) => [
                            ...prev,
                            {
                              id: uploaded.id,
                              filename: uploaded.filename,
                              url: uploaded.url,
                              sizeBytes: uploaded.sizeBytes,
                              contentType: uploaded.contentType,
                            },
                          ]);
                        }
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "upload_failed");
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </label>
                <span className="muted" style={{ fontSize: 12 }}>
                  Enter to send · Shift+Enter for newline
                </span>
              </div>

              <TextArea
                placeholder="Write a message…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (e.shiftKey) return;
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }}
                onFocus={() => {
                  try {
                    wsRef.current?.send(
                      JSON.stringify({ type: "typing.start", scope: "dm", threadId } satisfies WsClientMessage),
                    );
                  } catch {
                    // ignore
                  }
                }}
                onBlur={() => {
                  try {
                    wsRef.current?.send(
                      JSON.stringify({ type: "typing.stop", scope: "dm", threadId } satisfies WsClientMessage),
                    );
                  } catch {
                    // ignore
                  }
                }}
              />
            </div>

            <Button type="submit" disabled={uploading || (!body.trim() && pendingUploads.length === 0)}>
              {uploading ? "Uploading…" : "Send"}
            </Button>
          </div>
        </form>

        {pendingUploads.length ? (
          <div className="col" style={{ gap: 6 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Attachments to send
            </div>
            {pendingUploads.map((f) => (
              <div key={f.id} className="row" style={{ justifyContent: "space-between" }}>
                <a className="uiLink" href={f.url} target="_blank" rel="noreferrer">
                  {f.filename}
                </a>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => setPendingUploads((p) => p.filter((x) => x.id !== f.id))}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {typingUsers.size ? (
          <div className="muted" style={{ fontSize: 12 }}>
            Typing: {Array.from(typingUsers).join(", ")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

