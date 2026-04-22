"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ChannelMessage, CursorPage, WsClientMessage, WsServerMessage } from "@nottermost/shared";
import { apiFetch, getToken } from "../../../../../../lib/api";

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
          if (msg.type === "channelMessage.created" && msg.message.channelId === channelId) {
            setMessages((prev) => {
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

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Channel</h1>
          <div className="muted" style={{ fontSize: 12 }}>
            workspace {workspaceId} · channel {channelId}
          </div>
        </div>
        <Link className="button secondary" href={`/app/workspaces/${workspaceId}`}>
          Back
        </Link>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        {error ? <div className="error">Error: {error}</div> : null}

        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="button secondary" disabled={!nextCursor} onClick={() => void loadOlder()}>
            Load older
          </button>
          <div className="muted" style={{ fontSize: 12 }}>
            {messages.length} messages
          </div>
        </div>

        <div
          className="col"
          style={{
            gap: 10,
            maxHeight: 420,
            overflow: "auto",
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.18)",
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
              await apiFetch<ChannelMessage>(`/channels/${channelId}/messages`, {
                method: "POST",
                body: JSON.stringify({ body: trimmed }),
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : "send_failed");
            }
          }}
        >
          <input
            className="input"
            placeholder="Write a message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button className="button" type="submit">
            Send
          </button>
        </form>

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

        <div className="col" style={{ gap: 8 }}>
          <div className="muted">Invite workspace member by email</div>
          <div className="row">
            <input
              className="input"
              placeholder="email@domain.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <button
              className="button secondary"
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
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            For private channels, invited users must accept (or can use “Join” after being invited).
          </div>
        </div>
      </div>
    </main>
  );
}

