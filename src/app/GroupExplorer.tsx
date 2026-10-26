"use client";
import { useState } from "react";
import {
  GROUPS,
  TYPE_CODES,
  getType,
  groupOf,
  type GroupId,
} from "@/data/framework";
import { Octopus } from "@/components/Octopus";

export function GroupExplorer() {
  const [open, setOpen] = useState<GroupId | null>(null);
  return (
    <div className="stack">
      <div className="groups">
        {(Object.keys(GROUPS) as GroupId[]).map((id) => (
          <button
            key={id}
            type="button"
            className="group-tile"
            style={{ background: GROUPS[id].ink }}
            aria-expanded={open === id}
            onClick={() => setOpen(open === id ? null : id)}
          >
            <b>{GROUPS[id].name}</b>
            <small>{GROUPS[id].line}</small>
          </button>
        ))}
      </div>
      {open && (
        <div
          className="card"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          {TYPE_CODES.filter((c) => groupOf(c) === open).map((c) => (
            <div key={c} className="center">
              <Octopus code={c} size={64} />
              <div style={{ fontWeight: 900, letterSpacing: "0.08em" }}>
                {c}
              </div>
              <div className="small" style={{ fontWeight: 700 }}>
                {getType(c).name}
              </div>
              <div className="small muted">{getType(c).catch}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
