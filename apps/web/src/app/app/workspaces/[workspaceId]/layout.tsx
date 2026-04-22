"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { ChannelListItem } from "@nottermost/shared";

import { apiFetch } from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell/AppShell";

type Member = { id: string; email: string; role: string };

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = useMemo(() => params.workspaceId, [params.workspaceId]);

  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const [meResp, chansResp, memResp] = await Promise.all([
          apiFetch<{ id: string; email: string }>("/workspaces/me"),
          apiFetch<ChannelListItem[]>(`/channels?workspaceId=${encodeURIComponent(workspaceId)}`),
          apiFetch<Member[]>(`/workspaces/${workspaceId}/members`),
        ]);
        if (cancelled) return;
        setMe(meResp);
        setChannels(chansResp);
        setMembers(memResp);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "load_failed");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const channelItems = channels
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      key: c.id,
      href: c.isMember ? `/app/workspaces/${workspaceId}/channels/${c.id}` : `/app/workspaces/${workspaceId}`,
      label: c.name,
      suffix: !c.isMember ? <span className="pill">Join</span> : c.isPrivate ? <span className="pill">Private</span> : null,
    }));

  const dmItems = members
    .filter((m) => (me ? m.id !== me.id : true))
    .slice()
    .sort((a, b) => a.email.localeCompare(b.email))
    .slice(0, 12)
    .map((m) => ({
      key: m.id,
      href: `/app/workspaces/${workspaceId}?dm=${encodeURIComponent(m.id)}`,
      label: m.email,
    }));

  return (
    <AppShell
      workspaceName={me ? me.email : null}
      workspaceId={workspaceId}
      header={
        <div className="topbar">
          <div className="topbarLeft">{error ? <span className="topbarError">Error: {error}</span> : null}</div>
          <div className="topbarRight">
            <span className="topbarHint">Light mode · Slack-like layout</span>
          </div>
        </div>
      }
      sections={[
        { title: "Channels", items: channelItems },
        { title: "Direct messages", items: dmItems },
      ]}
    >
      {children}
    </AppShell>
  );
}

