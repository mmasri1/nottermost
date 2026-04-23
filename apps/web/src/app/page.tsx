import Link from "next/link";
import { Button } from "../components/ui/Button";

export default function HomePage() {
  return (
    <main className="authBg">
      <div className="authCard">
        <div className="authBrand" style={{ marginBottom: 12 }}>
          <div className="authBrandMark">
            <div className="authLogo" aria-hidden="true" />
            <div>
              <div className="authTitle authTitleAccent">Nottermost</div>
              <div className="authSubtitle">Local dev chat app, Slack-like UI</div>
            </div>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            localhost
          </span>
        </div>

        <div className="col" style={{ gap: 10 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            Use this UI to test auth, workspaces, channels, DMs, and realtime messaging.
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <Link href="/login">
              <Button>Sign in</Button>
            </Link>
            <Link href="/register">
              <Button variant="secondary">Create account</Button>
            </Link>
          </div>
          <Link href="/app">
            <Button variant="secondary" style={{ width: "100%" }}>
              Open app
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

