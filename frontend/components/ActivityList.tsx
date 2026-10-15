"use client";
import { useState } from "react";
import { relativeTime } from "../lib/format";
import { SafeLink } from "./SafeLink";

export interface CommitItem {
  github_sha: string;
  message: string;
  author_login: string | null;
  url: string;
  committed_at: string;
  source: string;
}

export interface PullItem {
  github_number: number;
  title: string;
  state: string;
  author_login: string | null;
  url: string;
  updated_at_github: string;
  source: string;
}

export interface IssueItem {
  github_number: number;
  title: string;
  state: string;
  author_login: string | null;
  url: string;
  updated_at_github: string;
  source: string;
}

const INITIAL = 5;

function stateTagClass(state: string) {
  if (state === "open") return "tag tag-accent-2";
  if (state === "merged") return "tag tag-accent";
  return "tag tag-neutral";
}

function firstName(message: string) {
  return message.split("\n")[0];
}

type Props =
  | { kind: "commit"; items: CommitItem[] }
  | { kind: "pr"; items: PullItem[] }
  | { kind: "issue"; items: IssueItem[] };

export function ActivityList(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const items = props.items;
  const visible = expanded ? items : items.slice(0, INITIAL);
  const hiddenCount = items.length - INITIAL;

  return (
    <>
      <div className="card" style={{ padding: 0 }}>
        {visible.map((row, idx) => {
          const borderTop = idx === 0 ? "none" : "1px solid var(--color-divider)";
          if (props.kind === "commit") {
            const c = row as CommitItem;
            return (
              <div key={c.github_sha} style={{ padding: "14px 22px", borderTop }}>
                <SafeLink href={c.url}>{firstName(c.message)}</SafeLink>{" "}
                {c.source === "manual" ? <span className="tag tag-neutral">unverified</span> : null}
                <div className="card-meta" style={{ marginTop: 2 }}>
                  {(c.author_login ?? "unknown author") + ", " + relativeTime(c.committed_at)}
                </div>
              </div>
            );
          }
          const p = row as PullItem | IssueItem;
          return (
            <div key={p.github_number} style={{ padding: "14px 22px", borderTop }}>
              <SafeLink href={p.url}>{"#" + p.github_number + " " + p.title}</SafeLink>{" "}
              <span className={stateTagClass(p.state)}>{p.state}</span>{" "}
              {p.source === "manual" ? <span className="tag tag-neutral">unverified</span> : null}
              <div className="card-meta" style={{ marginTop: 2 }}>
                {(p.author_login ?? "unknown author") + ", " + relativeTime(p.updated_at_github)}
              </div>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 ? (
        <button type="button" className="btn btn-ghost" style={{ justifySelf: "start" }} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : "Show more (" + hiddenCount + ")"}
        </button>
      ) : null}
    </>
  );
}
