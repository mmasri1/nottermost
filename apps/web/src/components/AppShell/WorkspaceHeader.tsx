"use client";

import type { ReactNode } from "react";

export function WorkspaceHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | null;
  actions?: ReactNode;
}) {
  return (
    <div className="workspaceHeader">
      <div className="workspaceHeaderMain">
        <div className="workspaceHeaderTitle">{title}</div>
        {subtitle ? <div className="workspaceHeaderSubtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="workspaceHeaderActions">{actions}</div> : null}
    </div>
  );
}

