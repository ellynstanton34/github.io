"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  quiet,
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  quiet?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={`${quiet ? "btn-quiet" : "btn"} ${className}`} disabled={pending}>
      {pending ? (pendingText ?? "Saving...") : children}
    </button>
  );
}
