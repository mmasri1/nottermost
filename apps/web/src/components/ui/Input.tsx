import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return <input {...props} className={["uiInput", className ?? ""].filter(Boolean).join(" ")} />;
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return <textarea {...props} className={["uiTextArea", className ?? ""].filter(Boolean).join(" ")} />;
}

