"use client";

import { useState } from "react";
import { addSource } from "@/app/cases/actions";
import { SubmitButton } from "@/components/submit-button";
import { kindLabel, ratingLabel } from "@/lib/labels";

const ratingHelp = {
  PRIMARY: "Court records, police records, official documents, first-hand family statements.",
  RELIABLE: "Established news outlets, on-record interviews.",
  WEAK: "Forums, social media, anonymous tips, anything unverified.",
};

export function SourceForm({ caseId }: { caseId: string }) {
  const [type, setType] = useState<"URL" | "FILE" | "TEXT">("URL");
  const [rating, setRating] = useState<keyof typeof ratingHelp>("RELIABLE");
  return (
    <form action={addSource} className="card space-y-4">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="type" value={type} />
      <div className="flex gap-2">
        {(["URL", "FILE", "TEXT"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={type === t ? "btn py-1.5" : "btn-quiet"}
          >
            {t === "URL" ? "Link" : t === "FILE" ? "Upload file" : "Paste text"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input name="title" required className="input" placeholder="e.g. Criminal complaint, State v. Pratt" />
        </div>
        {type === "URL" && (
          <div className="sm:col-span-2">
            <label className="label">URL</label>
            <input name="url" type="url" required className="input" placeholder="https://" />
          </div>
        )}
        {type === "FILE" && (
          <div className="sm:col-span-2">
            <label className="label">File</label>
            <input name="file" type="file" required className="input" />
            <p className="muted mt-1">Text files are read by the pre-publish check. For PDFs, paste the key passages below.</p>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label">{type === "TEXT" ? "Text" : "Key passages (optional)"}</label>
          <textarea
            name="text"
            required={type === "TEXT"}
            rows={type === "TEXT" ? 8 : 3}
            className="input"
            placeholder="The check matches script claims against this text."
          />
        </div>
        <div>
          <label className="label">Rating</label>
          <select
            name="rating"
            className="input"
            value={rating}
            onChange={(e) => setRating(e.target.value as keyof typeof ratingHelp)}
          >
            {Object.entries(ratingLabel).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
          <p className="muted mt-1">{ratingHelp[rating]}</p>
        </div>
        <div>
          <label className="label">Kind</label>
          <select name="kind" className="input" defaultValue="NEWS">
            {Object.entries(kindLabel).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Published</label>
          <input name="publishedOn" type="date" className="input" />
        </div>
        <div>
          <label className="label">Your notes</label>
          <input name="notes" className="input" />
        </div>
      </div>
      <SubmitButton pendingText="Adding...">Add source</SubmitButton>
    </form>
  );
}
