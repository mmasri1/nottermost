"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Workspace } from "@nottermost/shared";

import { apiFetch, getToken } from "../../../../lib/api";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";

export default function NewWorkspacePage() {
  const router = useRouter();
  const token = useMemo(() => getToken(), []);
  const [name, setName] = useState("My workspace");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  return (
    <main className="authBg">
      <div className="authCard">
        <div className="authTitle">Create a workspace</div>
        <div className="authSubtitle">You’ll land straight into it after creation.</div>

        <div className="col" style={{ marginTop: 14 }}>
          <label className="field">
            <span className="fieldLabel">Workspace name</span>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="e.g. Engineering" />
          </label>

          {error ? <div className="error">Error: {error}</div> : null}

          <Button
            disabled={loading || !name.trim()}
            onClick={async () => {
              setError(null);
              setLoading(true);
              try {
                const ws = await apiFetch<Workspace>("/workspaces", {
                  method: "POST",
                  body: JSON.stringify({ name: name.trim() }),
                });
                window.localStorage.setItem("nottermost.lastWorkspaceId", ws.id);
                router.replace(`/app/workspaces/${ws.id}`);
              } catch (err) {
                setError(err instanceof Error ? err.message : "create_failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Creating…" : "Create workspace"}
          </Button>
        </div>
      </div>
    </main>
  );
}

