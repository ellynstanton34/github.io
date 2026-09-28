"use client";

import { useActionState } from "react";
import { requestLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLink, {});
  if (state.sent) {
    return (
      <div className="card space-y-3">
        <p className="text-sm">Check your email for a sign-in link. It works once and expires in 20 minutes.</p>
        {state.devLink && (
          <p className="rounded-md bg-accent-soft p-3 text-sm">
            Development mode, no email is sent.{" "}
            <a href={state.devLink} className="font-medium text-accent underline">
              Open your sign-in link
            </a>
          </p>
        )}
      </div>
    );
  }
  return (
    <form action={action} className="card space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" placeholder="you@example.com" />
      </div>
      {state.error && <p className="text-sm text-warn">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Sending..." : "Send sign-in link"}
      </button>
    </form>
  );
}
