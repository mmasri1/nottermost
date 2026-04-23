"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuthResponse } from "@nottermost/shared";
import { apiFetch, setToken } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="authBg">
      <div className="authCard">
        <div className="authBrand">
          <div className="authBrandMark">
            <div className="authLogo" aria-hidden="true" />
            <div>
              <div className="authTitle authTitleAccent">Nottermost</div>
              <div className="authSubtitle">Sign in to continue</div>
            </div>
          </div>
          <Link className="uiLink" href="/" title="Home">
            Home
          </Link>
        </div>

        <form
          className="col"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              const resp = await apiFetch<AuthResponse>("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
              });
              setToken(resp.token);
              router.push("/app");
            } catch (err) {
              setError(err instanceof Error ? err.message : "login_failed");
            } finally {
              setLoading(false);
            }
          }}
        >
          <label className="field">
            <span className="fieldLabel">Email</span>
            <Input
              autoComplete="email"
              inputMode="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="fieldLabel">Password</span>
            <Input
              autoComplete="current-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error ? <div className="error">Error: {error}</div> : null}

          <Button disabled={loading || !email.trim() || !password}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>

          <div className="authFooter">
            <span>
              New here? <Link href="/register">Create an account</Link>
            </span>
            <span className="muted">JWT local dev</span>
          </div>
        </form>
      </div>
    </main>
  );
}

