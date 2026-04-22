"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { ChannelMessage, CursorPage, WsClientMessage, WsServerMessage } from "@nottermost/shared";
import { apiFetch, apiUploadFile, getToken } from "../../../../../../lib/api";
import { WorkspaceHeader } from "../../../../../../components/AppShell/WorkspaceHeader";
import { Button } from "../../../../../../components/ui/Button";
import { Input, TextArea } from "../../../../../../components/ui/Input";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";

export default function ChannelPage() {
  const params = useParams<{ workspaceId: string; channelId: string }>();
  const workspaceId = useMemo(() => params.workspaceId, [params.workspaceId]);
  const channelId = useMemo(() => params.channelId, [params.channelId]);

  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [openThreadRootId, setOpenThreadRootId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChannelMessage[]>([]);
  const [threadCursor, setThreadCursor] = useState<string | null>(null);
  const [threadBody, setThreadBody] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [pendingUploads, setPendingUploads] = useState<
    Array<{ id: string; filename: string; url: string; sizeBytes: number; contentType: string }>
  >([]);
  const [uploading, setUploading] = useState(false);

  async function loadFirstPage() {
    const page = await apiFetch<CursorPage<ChannelMessage>>(`/channels/${channelId}/messages?limit=30`);
    setMessages(page.items.slice().reverse());
    setNextCursor(page.nextCursor);
  }

  async function loadOlder() {
    if (!nextCursor) return;
    const page = await apiFetch<CursorPage<ChannelMessage>>(
      `/channels/${channelId}/messages?limit=30&cursor=${encodeURIComponent(nextCursor)}`,
    );
    const older = page.items.slice().reverse();
    setMessages((prev) => [...older, ...prev]);
    setNextCursor(page.nextCursor);
  }

  async function loadThreadFirstPage(rootMessageId: string) {
    const page = await apiFetch<CursorPage<ChannelMessage>>(
      `/channels/${channelId}/threads/${rootMessageId}/messages?limit=50`,
    );
    setThreadMessages(page.items.slice().reverse());
    setThreadCursor(page.nextCursor);
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
          const sub: WsClientMessage = { type: "subscribe.channel", channelId };
          ws.send(JSON.stringify(sub));
        });

        ws.addEventListener("message", (ev) => {
          let msg: WsServerMessage | null = null;
          try {
            msg = JSON.parse(ev.data as string) as WsServerMessage;
          } catch {
            return;
          }
          if (msg.type === "typing.updated" && msg.scope === "channel" && msg.channelId === channelId) {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              if (msg.isTyping) next.add(msg.userId);
              else next.delete(msg.userId);
              return next;
            });
            return;
          }

          if (msg.type === "channelMessage.updated" && msg.message.channelId === channelId) {
            setMessages((prev) => prev.map((m) => (m.id === msg!.message.id ? { ...m, ...msg!.message } : m)));
            setThreadMessages((prev) => prev.map((m) => (m.id === msg!.message.id ? { ...m, ...msg!.message } : m)));
            return;
          }

          if (msg.type !== "channelMessage.created") return;
          if (msg.message.channelId !== channelId) return;

          // Top-level message
          if (!msg.message.threadRootId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg!.message.id)) return prev;
              return [...prev, msg!.message];
            });
            return;
          }

          // Reply message: update reply metadata on root + append if pane open.
          const rootId = msg.message.threadRootId;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === rootId
                ? {
                    ...m,
                    replyCount: (m.replyCount ?? 0) + 1,
                    lastReplyAt: msg!.message.createdAt,
                  }
                : m,
            ),
          );
          if (openThreadRootId === rootId) {
            setThreadMessages((prev) => {
              if (prev.some((m) => m.id === msg!.message.id)) return prev;
              return [...prev, msg!.message];
            });
          }
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
  }, [channelId]);

  const rootMessage = openThreadRootId ? messages.find((m) => m.id === openThreadRootId) ?? null : null;

  return (
    <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <WorkspaceHeader title="# Channel" subtitle={`workspace ${workspaceId} · channel ${channelId}`} />

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

        <div style={{ display: "grid", gridTemplateColumns: openThreadRootId ? "1fr 340px" : "1fr", gap: 12, minHeight: 0 }}>
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
                {m.attachments?.length ? (
                  <div className="col" style={{ gap: 6, marginTop: 6 }}>
                    {m.attachments.map((a) => (
                      <a key={a.id} className="uiLink" href={a.url} target="_blank" rel="noreferrer">
                        {a.filename}
                      </a>
                    ))}
                  </div>
                ) : null}
                <div className="row" style={{ gap: 10, marginTop: 4 }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={async () => {
                      setOpenThreadRootId(m.id);
                      setThreadBody("");
                      try {
                        await loadThreadFirstPage(m.id);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "load_thread_failed");
                      }
                    }}
                  >
                    Reply{m.replyCount ? ` · ${m.replyCount}` : ""}
                  </Button>
                  {m.lastReplyAt ? (
                    <span className="muted" style={{ fontSize: 12 }}>
                      last reply {new Date(m.lastReplyAt).toLocaleString()}
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}
          </div>

          {openThreadRootId ? (
            <div
              className="col"
              style={{
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden",
                borderRadius: 12,
                border: "1px solid rgba(17,24,39,0.12)",
                background: "rgba(255,255,255,0.85)",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", padding: 10, borderBottom: "1px solid rgba(17,24,39,0.08)" }}>
                <div className="col" style={{ gap: 2 }}>
                  <div style={{ fontWeight: 650 }}>Thread</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {rootMessage ? rootMessage.body.slice(0, 60) : openThreadRootId}
                  </div>
                </div>
                <Button size="sm" variant="secondary" type="button" onClick={() => setOpenThreadRootId(null)}>
                  Close
                </Button>
              </div>

              <div style={{ padding: 10, overflow: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {threadMessages.length === 0 ? (
                  <div className="muted">No replies yet.</div>
                ) : (
                  threadMessages.map((m) => (
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
                style={{ padding: 10, borderTop: "1px solid rgba(17,24,39,0.08)" }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmed = threadBody.trim();
                  if (!trimmed || !openThreadRootId) return;
                  setThreadBody("");
                  try {
                    await apiFetch<ChannelMessage>(`/channels/${channelId}/messages`, {
                      method: "POST",
                      body: JSON.stringify({ body: trimmed, threadRootId: openThreadRootId }),
                    });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "reply_failed");
                  }
                }}
              >
                <TextArea
                  placeholder="Reply…"
                  value={threadBody}
                  onChange={(e) => setThreadBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    if (e.shiftKey) return;
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }}
                />
                <Button type="submit" disabled={!threadBody.trim()}>
                  Reply
                </Button>
              </form>
            </div>
          ) : null}
        </div>

        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const trimmed = body.trim();
            if (!trimmed && pendingUploads.length === 0) return;
            setBody("");
            try {
              await apiFetch<ChannelMessage>(`/channels/${channelId}/messages`, {
                method: "POST",
                body: JSON.stringify({ body: trimmed || " ", fileIds: pendingUploads.map((f) => f.id) }),
              });
              setPendingUploads([]);
            } catch (err) {
              setError(err instanceof Error ? err.message : "send_failed");
            }
          }}
        >
          <input
            type="file"
            multiple
            disabled={uploading}
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              if (!files.length) return;
              e.target.value = "";
              setUploading(true);
              try {
                for (const f of files) {
                  const uploaded = await apiUploadFile({ workspaceId, channelId, file: f });
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
                wsRef.current?.send(
                  JSON.stringify({ type: "typing.start", scope: "channel", channelId } satisfies WsClientMessage),
                );
              } catch {
                // ignore
              }
            }}
            onBlur={() => {
              try {
                wsRef.current?.send(
                  JSON.stringify({ type: "typing.stop", scope: "channel", channelId } satisfies WsClientMessage),
                );
              } catch {
                // ignore
              }
            }}
          />
          <Button type="submit" disabled={uploading || (!body.trim() && pendingUploads.length === 0)}>
            {uploading ? "Uploading…" : "Send"}
          </Button>
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

        <div style={{ height: 1, background: "rgba(17,24,39,0.08)" }} />

        <div className="col" style={{ gap: 8 }}>
          <div className="muted">Invite workspace member by email</div>
          <div className="row">
            <Input
              placeholder="email@domain.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Button
              variant="secondary"
              type="button"
              disabled={!inviteEmail.trim()}
              onClick={async () => {
                setError(null);
                const trimmed = inviteEmail.trim();
                if (!trimmed) return;
                try {
                  await apiFetch<{ id: string }>(`/channels/${channelId}/invites`, {
                    method: "POST",
                    body: JSON.stringify({ email: trimmed }),
                  });
                  setInviteEmail("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "invite_failed");
                }
              }}
            >
              Invite
            </Button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            For private channels, invited users must accept (or can use “Join” after being invited).
          </div>
        </div>
      </div>
    </div>
  );
}

