"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ConfirmInner() {
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    const q = new URLSearchParams({
      installation_id: params.get("installation_id") ?? "",
      setup_action: params.get("setup_action") ?? "",
      state: params.get("state") ?? ""
    });
    fetch("/api/backend/github/install/callback?" + q.toString())
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Link failed");
        setState("ok");
      })
      .catch((err) => {
        setState("error");
        setDetail(err instanceof Error ? err.message : "Link failed");
      });
  }, [params]);

  if (state === "working") return <p className="card-body">Linking your GitHub App installation.</p>;
  if (state === "ok") {
    return (
      <div className="card">
        <div className="card-title">Installation linked</div>
        <p className="card-body">Pushes, pull requests, and issues will now arrive within seconds.</p>
        <p>
          <Link className="btn btn-primary" href="/projects">
            Back to dashboard
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-title">Link failed</div>
      <p className="card-body">{detail || "The installation could not be linked."}</p>
      <p>
        <Link className="btn btn-secondary" href="/projects">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}

export default function InstallCallbackPage() {
  return (
    <div>
      <p className="kicker">GitHub App</p>
      <h1>Finishing install</h1>
      <Suspense fallback={<p className="card-body">Working.</p>}>
        <ConfirmInner />
      </Suspense>
    </div>
  );
}
