import type { ReactNode } from "react";

export function Icon({
  children,
  size = 18,
  className,
  title,
}: {
  children: ReactNode;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={className}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      title={title}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
      }}
    >
      {children}
    </span>
  );
}

