"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { ChannelListItem } from "@nottermost/shared";

import { apiFetch } from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell/AppShell";

type DmThreadListItem = {
  id: string;
  workspaceId: string;
  kind: "direct" | "group";
  name?: string | null;
  participantEmails: string[];
  lastMessageAt: string | null;
};

type NotifList = { items: Array<{ id: string; readAt: string | null }>; nextCursor: string | null };

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = useMemo(() => params.workspaceId, [params.workspaceId]);

  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [dmThreads, setDmThreads] = useState<DmThreadListItem[]>([]);
  const [me, setMe] = useState<{
    id: string;
    email: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    statusText?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const [meResp, chansResp] = await Promise.all([
          apiFetch<{
            id: string;
            email: string;
            displayName?: string | null;
            avatarUrl?: string | null;
            statusText?: string | null;
          }>("/workspaces/me"),
          apiFetch<ChannelListItem[]>(`/channels?workspaceId=${encodeURIComponent(workspaceId)}`),
        ]);
        const dmResp = await apiFetch<DmThreadListItem[]>(`/dm/threads?workspaceId=${encodeURIComponent(workspaceId)}`);
        const notifResp = await apiFetch<NotifList>(`/notifications?workspaceId=${encodeURIComponent(workspaceId)}&limit=50`);
        if (cancelled) return;
        setMe(meResp);
        setChannels(chansResp);
        setDmThreads(dmResp);
        setUnreadNotifs(notifResp.items.filter((n) => !n.readAt).length);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "load_failed");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    function onProfileUpdated() {
      void (async () => {
        try {
          const meResp = await apiFetch<{
            id: string;
            email: string;
            displayName?: string | null;
            avatarUrl?: string | null;
            statusText?: string | null;
          }>("/workspaces/me");
          setMe(meResp);
        } catch {
          // ignore: workspace shell already surfaces load errors on navigation/refresh
        }
      })();
    }

    window.addEventListener("nottermost.profile.updated", onProfileUpdated);
    return () => window.removeEventListener("nottermost.profile.updated", onProfileUpdated);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("nottermost.lastWorkspaceId", workspaceId);
    } catch {
      // ignore
    }
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

  const dmItems = dmThreads
    .slice()
    .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""))
    .slice(0, 20)
    .map((t) => ({
      key: t.id,
      href: `/app/workspaces/${workspaceId}/threads/${t.id}`,
      label: t.kind === "group" ? t.name ?? t.participantEmails.join(", ") : t.participantEmails.filter((e) => e !== me?.email).join(", "),
    }));

  return (
    <AppShell
      workspaceTitle={me ? me.displayName?.trim() || me.email : null}
      workspaceSubtitle={me?.statusText?.trim() ? me.statusText.trim() : workspaceId}
      workspaceAvatarUrl={me?.avatarUrl?.trim() ? me.avatarUrl.trim() : null}
      workspaceId={workspaceId}
      header={
        <div className="topbar">
          <div className="topbarLeft">{error ? <span className="topbarError">Error: {error}</span> : null}</div>
          <div className="topbarRight">
            <span className="topbarHint">Notifications: {unreadNotifs} unread</span>
          </div>
        </div>
      }
      sections={[
        {
          title: "Search",
          items: [{ key: "search", href: `/app/workspaces/${workspaceId}/search`, label: "Search messages" }],
        },
        {
          title: "You",
          items: [{ key: "profile", href: `/app/workspaces/${workspaceId}/profile`, label: "Profile" }],
        },
        { title: "Channels", items: channelItems },
        { title: "Direct messages", items: dmItems },
      ]}
    >
      {children}
    </AppShell>
  );
}

