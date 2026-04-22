"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { apiFetch } from "../../../../../lib/api";
import { Button } from "../../../../../components/ui/Button";
import { Input } from "../../../../../components/ui/Input";
import { WorkspaceHeader } from "../../../../../components/AppShell/WorkspaceHeader";

type SearchItem = {
  kind: "channel" | "dm";
  id: string;
  channelId: string | null;
  threadId: string | null;
  senderId: string;
  createdAt: string;
  snippet: string;
};

export default function SearchPage() {
  const params = useParams<{ workspaceId: string }>();
  const sp = useSearchParams();
  const workspaceId = useMemo(() => params.workspaceId, [params.workspaceId]);
  const initialQ = sp.get("q") ?? "";

  const [q, setQ] = useState(initialQ);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = initialQ.trim();
    if (!trimmed) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const resp = await apiFetch<{ items: SearchItem[]; nextCursor: string | null }>(
          `/search/messages?workspaceId=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(trimmed)}&kind=all&limit=30`,
        );
        if (!cancelled) setItems(resp.items);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "search_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, initialQ]);

  return (
    <div style={{ padding: 16, overflow: "auto" }}>
      <WorkspaceHeader title="Search" subtitle="Search across channels and DMs" />

      <div className="card col" style={{ marginTop: 12, gap: 12 }}>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = q.trim();
            if (!trimmed) return;
            const url = new URL(window.location.href);
            url.searchParams.set("q", trimmed);
            window.location.href = url.toString();
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages…" />
          <Button type="submit" disabled={!q.trim() || loading}>
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>

        {error ? <div className="error">Error: {error}</div> : null}

        {!initialQ.trim() ? <div className="muted">Type a query and press Enter.</div> : null}

        {initialQ.trim() && !loading && items.length === 0 ? <div className="muted">No results.</div> : null}

        <div className="col" style={{ gap: 10 }}>
          {items.map((it) => {
            const href =
              it.kind === "channel" && it.channelId
                ? `/app/workspaces/${workspaceId}/channels/${it.channelId}`
                : it.threadId
                  ? `/app/workspaces/${workspaceId}/threads/${it.threadId}`
                  : `/app/workspaces/${workspaceId}`;
            return (
              <Link key={`${it.kind}:${it.id}`} className="card" href={href}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  {it.kind.toUpperCase()} · {new Date(it.createdAt).toLocaleString()} · sender {it.senderId}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{it.snippet}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

