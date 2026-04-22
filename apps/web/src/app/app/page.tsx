"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Workspace } from "@nottermost/shared";
import { apiFetch, getToken } from "../../lib/api";

export default function AppPage() {
  const router = useRouter();
  const token = useMemo(() => getToken(), []);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const ws = await apiFetch<Workspace[]>("/workspaces");
        if (cancelled) return;
        setWorkspaces(ws);

        const stored =
          typeof window !== "undefined" ? window.localStorage.getItem("nottermost.lastWorkspaceId") : null;
        const target = (stored && ws.find((w) => w.id === stored)?.id) || ws[0]?.id || null;
        if (target) {
          router.replace(`/app/workspaces/${target}`);
        } else {
          // No workspace yet — send to a creation-friendly screen.
          router.replace("/app/workspaces/new");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "load_failed");
      }
    }
    if (token) void load();
    else setError("missing_token");
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="authBg">
      <div className="authCard">
        <div className="authTitle">Opening Nottermost…</div>
        <div className="authSubtitle">
          {error
            ? `Error: ${error}`
            : workspaces.length === 0
              ? "Setting up your first workspace…"
              : "Redirecting you to your workspace."}
        </div>
      </div>
    </main>
  );
}

