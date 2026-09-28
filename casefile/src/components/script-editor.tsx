"use client";

import { useActionState, useState } from "react";
import { runCheck, runDraft, saveScript, type AiState } from "@/app/cases/actions";

export function ScriptEditor({ episodeId, script }: { episodeId: string; script: string }) {
  const [text, setText] = useState(script);
  const [checkState, check, checking] = useActionState<AiState, FormData>(runCheck, {});
  const [draftState, draft, drafting] = useActionState<AiState, FormData>(runDraft, {});
  const busy = checking || drafting;
  const error = checkState.error ?? draftState.error;

  // Keep the textarea in sync when the server changes the script (a draft, or an applied rewrite).
  const [lastServerScript, setLastServerScript] = useState(script);
  if (script !== lastServerScript) {
    setLastServerScript(script);
    setText(script);
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Script</h2>
        <form
          action={draft}
          onSubmit={(e) => {
            if (text.trim() && !confirm("Replace the current script with a new draft from your timeline and sources?")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="episodeId" value={episodeId} />
          <button className="btn-quiet" disabled={busy}>
            {drafting ? "Drafting... (about a minute)" : "Draft from timeline"}
          </button>
        </form>
      </div>
      <form action={check} className="space-y-3">
        <input type="hidden" name="episodeId" value={episodeId} />
        <textarea
          name="script"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          className="input font-serif text-[15px] leading-relaxed"
          placeholder="Paste your script here."
        />
        {error && <p className="rounded-md bg-warn-soft p-3 text-sm text-warn">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={busy || !text.trim()}>
            {checking ? "Checking... (about a minute)" : "Run pre-publish check"}
          </button>
          <button className="btn-quiet" formAction={saveScript} disabled={busy}>
            Save without checking
          </button>
        </div>
      </form>
    </div>
  );
}
