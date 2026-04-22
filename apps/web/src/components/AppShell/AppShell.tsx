"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

type SidebarSection = {
  title: string;
  items: Array<{
    key: string;
    href: string;
    label: string;
    icon?: ReactNode;
    suffix?: ReactNode;
  }>;
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  workspaceName,
  workspaceTitle,
  workspaceSubtitle,
  workspaceAvatarUrl,
  workspaceId,
  header,
  sections,
  children,
  rightRail,
}: {
  workspaceName?: string | null;
  workspaceTitle?: string | null;
  workspaceSubtitle?: string | null;
  workspaceAvatarUrl?: string | null;
  workspaceId: string;
  header?: ReactNode;
  sections: SidebarSection[];
  children: ReactNode;
  rightRail?: ReactNode;
}) {
  const pathname = usePathname();
  const title = workspaceTitle ?? workspaceName ?? "Workspace";
  const subtitle = workspaceSubtitle ?? workspaceId;
  const letter = useMemo(() => (title ?? "W").slice(0, 1).toUpperCase(), [title]);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const showAvatarImg = Boolean(workspaceAvatarUrl) && !avatarBroken;

  useEffect(() => {
    setAvatarBroken(false);
  }, [workspaceAvatarUrl]);

  return (
    <div className="appFrame">
      <aside className="appSidebar">
        <div className="sidebarTop">
          <div className="workspaceSwitcher">
            <div className="workspaceAvatar" aria-hidden="true">
              {showAvatarImg ? (
                <img
                  className="workspaceAvatarImg"
                  src={workspaceAvatarUrl!}
                  alt=""
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                letter
              )}
            </div>
            <div className="workspaceMeta">
              <div className="workspaceName">{title}</div>
              <div className="workspaceSub">{subtitle}</div>
            </div>
          </div>

          <div className="sidebarActions">
            <Link className="uiLink" href="/app" title="All workspaces">
              <Icon title="Back to workspaces">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                  <path
                    d="M8.3 4.6 3.2 9.7a.9.9 0 0 0 0 1.2l5.1 5.1"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3.7 10h13.1"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Icon>
            </Link>
          </div>
        </div>

        <nav className="sidebarNav" aria-label="Workspace navigation">
          {sections.map((section) => (
            <div className="sidebarSection" key={section.title}>
              <div className="sidebarSectionTitle">{section.title}</div>
              <div className="sidebarSectionItems">
                {section.items.map((it) => {
                  const active = isActive(pathname, it.href);
                  return (
                    <Link
                      key={it.key}
                      className={["sidebarItem", active ? "sidebarItem--active" : ""].filter(Boolean).join(" ")}
                      href={it.href}
                      title={it.label}
                    >
                      <span className="sidebarItemIcon">{it.icon ?? <span className="sidebarBullet" />}</span>
                      <span className="sidebarItemLabel">{it.label}</span>
                      {it.suffix ? <span className="sidebarItemSuffix">{it.suffix}</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebarBottom">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // layout doesn't own auth; keep it simple and consistent with existing /app page
              window.localStorage.removeItem("nottermost.token");
              window.location.href = "/login";
            }}
          >
            Log out
          </Button>
        </div>
      </aside>

      <div className="appMain">
        <header className="appHeader">{header}</header>
        <div className={["appContent", rightRail ? "appContent--withRightRail" : ""].filter(Boolean).join(" ")}>
          <div className="appPane">{children}</div>
          {rightRail ? <div className="appRightRail">{rightRail}</div> : null}
        </div>
      </div>
    </div>
  );
}

