"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ChannelInvite, ChannelListItem, DirectThread } from "@nottermost/shared";
import { apiFetch } from "../../../../lib/api";

type Member = { id: string; email: string; role: string };

export default function WorkspacePage() {
  const router = useRouter();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = useMemo(() => params.workspaceId, [params.workspaceId]);

  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [invites, setInvites] = useState<ChannelInvite[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meResp, memResp, chansResp, invResp] = await Promise.all([
          apiFetch<{ id: string; email: string }>("/workspaces/me"),
          apiFetch<Member[]>(`/workspaces/${workspaceId}/members`),
          apiFetch<ChannelListItem[]>(`/channels?workspaceId=${encodeURIComponent(workspaceId)}`),
          apiFetch<ChannelInvite[]>(`/channels/invites?workspaceId=${encodeURIComponent(workspaceId)}`),
        ]);
        if (!cancelled) {
          setMe(meResp);
          setMembers(memResp);
          setChannels(chansResp);
          setInvites(invResp);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "load_failed");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Workspace</h1>
          <div className="muted">{workspaceId}</div>
        </div>
        <div className="row">
          <Link className="button secondary" href="/app">
            Back
          </Link>
        </div>
      </div>

      <div className="card col">
        {error ? <div className="error">Error: {error}</div> : null}

        <div className="col" style={{ gap: 10 }}>
          <div className="muted">Channels</div>

          <div className="row" style={{ alignItems: "center" }}>
            <input
              className="input"
              placeholder="new-channel"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
            />
            <label className="row muted" style={{ gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={newChannelPrivate}
                onChange={(e) => setNewChannelPrivate(e.target.checked)}
              />
              Private
            </label>
            <button
              className="button"
              onClick={async () => {
                setError(null);
                const trimmed = newChannelName.trim();
                if (!trimmed) return;
                try {
                  const created = await apiFetch<{ id: string; name: string; isPrivate: boolean; createdAt: string }>(
                    "/channels",
                    {
                      method: "POST",
                      body: JSON.stringify({ workspaceId, name: trimmed, isPrivate: newChannelPrivate }),
                    },
                  );
                  setChannels((prev) => [
                    {
                      id: created.id,
                      workspaceId,
                      name: created.name,
                      isPrivate: created.isPrivate,
                      createdAt: created.createdAt,
                      isMember: true,
                    },
                    ...prev,
                  ]);
                  setNewChannelName("");
                  setNewChannelPrivate(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "create_channel_failed");
                }
              }}
            >
              Create
            </button>
          </div>

          {channels.length === 0 ? (
            <div className="muted">No channels yet.</div>
          ) : (
            channels.map((c) => (
              <div key={c.id} className="row" style={{ justifyContent: "space-between" }}>
                <div className="col" style={{ gap: 2 }}>
                  <div>
                    {c.name}{" "}
                    {c.isPrivate ? (
                      <span className="muted" style={{ fontSize: 12 }}>
                        (private)
                      </span>
                    ) : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {c.id}
                  </div>
                </div>
                <div className="row">
                  {c.isMember ? (
                    <Link className="button secondary" href={`/app/workspaces/${workspaceId}/channels/${c.id}`}>
                      Open
                    </Link>
                  ) : (
                    <button
                      className="button secondary"
                      onClick={async () => {
                        setError(null);
                        try {
                          await apiFetch<void>(`/channels/${c.id}/join`, { method: "POST" });
                          setChannels((prev) => prev.map((x) => (x.id === c.id ? { ...x, isMember: true } : x)));
                          router.push(`/app/workspaces/${workspaceId}/channels/${c.id}`);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "join_failed");
                        }
                      }}
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

        <div className="col" style={{ gap: 8 }}>
          <div className="muted">Channel invites</div>
          {invites.length === 0 ? (
            <div className="muted">No pending invites.</div>
          ) : (
            invites.map((i) => (
              <div key={i.id} className="row" style={{ justifyContent: "space-between" }}>
                <div className="col" style={{ gap: 2 }}>
                  <div>
                    Invite to <b>{i.channelName}</b>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    from {i.inviterEmail} · {new Date(i.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  className="button secondary"
                  onClick={async () => {
                    setError(null);
                    try {
                      await apiFetch<void>(`/channels/invites/${i.id}/accept`, { method: "POST" });
                      setInvites((prev) => prev.filter((x) => x.id !== i.id));
                      const ch = channels.find((c) => c.id === i.channelId);
                      if (ch) setChannels((prev) => prev.map((x) => (x.id === ch.id ? { ...x, isMember: true } : x)));
                      router.push(`/app/workspaces/${workspaceId}/channels/${i.channelId}`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "accept_failed");
                    }
                  }}
                >
                  Accept
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

        <div className="col" style={{ gap: 6 }}>
          <div className="muted">Members</div>
          {members.length === 0 ? (
            <div className="muted">No members found.</div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="row" style={{ justifyContent: "space-between" }}>
                <div className="col" style={{ gap: 2 }}>
                  <div>{m.email}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {m.id} · {m.role}
                  </div>
                </div>
                <button
                  className="button secondary"
                  disabled={!me || me.id === m.id}
                  onClick={async () => {
                    setError(null);
                    try {
                      const thread = await apiFetch<DirectThread>("/dm/threads", {
                        method: "POST",
                        body: JSON.stringify({ workspaceId, otherUserId: m.id }),
                      });
                      router.push(`/app/workspaces/${workspaceId}/threads/${thread.id}`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "thread_failed");
                    }
                  }}
                >
                  DM
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

        <div className="col" style={{ gap: 8 }}>
          <div className="muted">Add member (owner-only)</div>
          <div className="row">
            <input
              className="input"
              placeholder="email@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="button"
              onClick={async () => {
                setError(null);
                try {
                  const member = await apiFetch<Member>(`/workspaces/${workspaceId}/members`, {
                    method: "POST",
                    body: JSON.stringify({ email }),
                  });
                  setMembers((prev) => [...prev, member]);
                  setEmail("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "add_failed");
                }
              }}
            >
              Add
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Tip: create another account in a separate browser, then add it here by email.
          </div>
        </div>
      </div>
    </main>
  );
}

