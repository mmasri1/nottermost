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

type NotificationPrefs = {
  notifyChannelMentions: boolean;
  notifyDmMentions: boolean;
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
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [notifPrefsLoading, setNotifPrefsLoading] = useState(true);
  const [notifError, setNotifError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    async function loadPrefs() {
      setNotifPrefsLoading(true);
      setNotifError(null);
      try {
        const p = await apiFetch<NotificationPrefs>(`/workspaces/${workspaceId}/me/notification-prefs`);
        if (!cancelled) setNotifPrefs(p);
      } catch (err) {
        if (!cancelled) {
          setNotifPrefs(null);
          setNotifError(err instanceof Error ? err.message : "prefs_load_failed");
        }
      } finally {
        if (!cancelled) setNotifPrefsLoading(false);
      }
    }
    void loadPrefs();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function patchNotificationPrefs(patch: Partial<NotificationPrefs>) {
    setNotifError(null);
    const p = await apiFetch<NotificationPrefs>(`/workspaces/${workspaceId}/me/notification-prefs`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setNotifPrefs(p);
  }

  return (
    <div style={{ padding: 16, overflow: "auto" }}>
      <WorkspaceHeader title="Profile" subtitle="Profile and notification preferences for this workspace" />

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

      <div className="card col" style={{ marginTop: 12, gap: 12 }}>
        <div style={{ fontWeight: 650 }}>Mentions and notifications</div>
        {notifPrefsLoading ? <div className="muted">Loading preferences…</div> : null}
        {notifError ? <div className="error">Error: {notifError}</div> : null}
        {!notifPrefsLoading && notifPrefs ? (
          <div className="col" style={{ gap: 12 }}>
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
              In channels you can mention a workspace member with <code>@local@domain.com</code>, ping everyone in the current channel with{" "}
              <code>@channel</code> or <code>@here</code>, or reference another channel with <code>#channel-name</code>.
            </div>

            <label className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={notifPrefs.notifyChannelMentions}
                onChange={(e) => {
                  void patchNotificationPrefs({ notifyChannelMentions: e.target.checked }).catch((err) =>
                    setNotifError(err instanceof Error ? err.message : "prefs_save_failed"),
                  );
                }}
              />
              <span>
                <span style={{ fontWeight: 600 }}>Channel mention notifications</span>
                <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 4 }}>
                  When off, you will not receive notifications for channel mentions in this workspace.
                </span>
              </span>
            </label>

            <label className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={notifPrefs.notifyDmMentions}
                onChange={(e) => {
                  void patchNotificationPrefs({ notifyDmMentions: e.target.checked }).catch((err) =>
                    setNotifError(err instanceof Error ? err.message : "prefs_save_failed"),
                  );
                }}
              />
              <span>
                <span style={{ fontWeight: 600 }}>Direct message mention notifications</span>
                <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 4 }}>
                  When off, you will not receive notifications for <code>@local@domain.com</code> mentions inside DMs in this workspace.
                </span>
              </span>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
