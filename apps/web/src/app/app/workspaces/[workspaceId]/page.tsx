"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { DirectThread } from "@nottermost/shared";
import { apiFetch } from "../../../lib/api";

type Member = { id: string; email: string; role: string };

export default function WorkspacePage() {
  const router = useRouter();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = useMemo(() => params.workspaceId, [params.workspaceId]);

  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meResp, memResp] = await Promise.all([
          apiFetch<{ id: string; email: string }>("/workspaces/me"),
          apiFetch<Member[]>(`/workspaces/${workspaceId}/members`),
        ]);
        if (!cancelled) {
          setMe(meResp);
          setMembers(memResp);
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

