"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { apiFetch } from "../../../../../lib/api";
import { WorkspaceHeader } from "../../../../../components/AppShell/WorkspaceHeader";
import { Button } from "../../../../../components/ui/Button";
import { Input } from "../../../../../components/ui/Input";

type Me = {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  statusText?: string | null;
};

export default function ProfilePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = useMemo(() => params.workspaceId, [params.workspaceId]);

  const [me, setMe] = useState<Me | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const resp = await apiFetch<Me>("/workspaces/me");
        if (cancelled) return;
        setMe(resp);
        setDisplayName(resp.displayName ?? "");
        setAvatarUrl(resp.avatarUrl ?? "");
        setStatusText(resp.statusText ?? "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "load_failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 16, overflow: "auto" }}>
      <WorkspaceHeader title="Profile" subtitle="How you appear in this workspace" />

      <div className="card col" style={{ marginTop: 12, gap: 12 }}>
        {loading ? <div className="muted">Loading…</div> : null}
        {error ? <div className="error">Error: {error}</div> : null}

        {!loading && me ? (
          <div className="col" style={{ gap: 10 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Signed in as <span style={{ color: "var(--text)" }}>{me.email}</span>
            </div>

            <div className="col" style={{ gap: 6 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Display name
              </div>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ada Lovelace" />
            </div>

            <div className="col" style={{ gap: 6 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Avatar URL (https only)
              </div>
              <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
            </div>

            <div className="col" style={{ gap: 6 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Status
              </div>
              <Input value={statusText} onChange={(e) => setStatusText(e.target.value)} placeholder="In a meeting" />
            </div>

            <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <Button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setError(null);
                  setSavedAt(null);
                  try {
                    const resp = await apiFetch<Me>("/workspaces/me/profile", {
                      method: "PATCH",
                      body: JSON.stringify({
                        displayName: displayName.trim().length ? displayName.trim() : null,
                        avatarUrl: avatarUrl.trim().length ? avatarUrl.trim() : null,
                        statusText: statusText.trim().length ? statusText.trim() : null,
                      }),
                    });
                    setMe(resp);
                    setDisplayName(resp.displayName ?? "");
                    setAvatarUrl(resp.avatarUrl ?? "");
                    setStatusText(resp.statusText ?? "");
                    setSavedAt(new Date().toLocaleString());

                    // Best-effort: refresh workspace shell header without a full reload.
                    try {
                      window.dispatchEvent(new Event("nottermost.profile.updated"));
                    } catch {
                      // ignore
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "save_failed");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving…" : "Save"}
              </Button>

              {savedAt ? <div className="muted">Saved {savedAt}</div> : null}
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Workspace ID: {workspaceId}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
