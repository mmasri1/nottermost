"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ChannelInvite, ChannelListItem, DirectThread } from "@nottermost/shared";
import { apiFetch } from "../../../../lib/api";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";

type Member = {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  statusText?: string | null;
  role: string;
};

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
  const [me, setMe] = useState<{
    id: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    statusText?: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meResp, memResp, chansResp, invResp] = await Promise.all([
          apiFetch<{
            id: string;
            email: string;
            displayName?: string | null;
            avatarUrl?: string | null;
            statusText?: string | null;
          }>("/workspaces/me"),
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
    <div style={{ padding: 16, overflow: "auto" }}>
      <div className="slackPage">
        <div className="slackPageHeader">
          <div>
            <div className="slackPageTitle">Workspace</div>
            <div className="slackPageSubtitle">{workspaceId}</div>
          </div>
          {error ? <div className="topbarError">Error: {error}</div> : null}
        </div>

        <div className="slackPageBody">
          <div className="slackSection">
            <div className="slackSectionTitle">Channels</div>

          <div className="row" style={{ alignItems: "center" }}>
            <Input placeholder="new-channel" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} />
            <label className="row muted" style={{ gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={newChannelPrivate}
                onChange={(e) => setNewChannelPrivate(e.target.checked)}
              />
              Private
            </label>
            <Button
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
            </Button>
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
                    <Button variant="secondary" onClick={() => router.push(`/app/workspaces/${workspaceId}/channels/${c.id}`)}>
                      Open
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
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
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
          </div>

          <div className="slackSection">
            <div className="slackSectionTitle">Channel invites</div>
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
                  <Button
                    variant="secondary"
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
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="slackSection">
            <div className="slackSectionTitle">Members</div>
            {members.length === 0 ? (
              <div className="muted">No members found.</div>
            ) : (
              members.map((m) => (
                <div key={m.id} className="row" style={{ justifyContent: "space-between" }}>
                  <div className="col" style={{ gap: 2 }}>
                    <div>{m.displayName?.trim() || m.email}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {m.email} · {m.id} · {m.role}
                      {m.statusText?.trim() ? ` · ${m.statusText.trim()}` : ""}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
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
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="slackSection">
            <div className="slackSectionTitle">Add member (owner-only)</div>
            <div className="row">
              <Input placeholder="email@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button
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
              </Button>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Tip: create another account in a separate browser, then add it here by email.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

