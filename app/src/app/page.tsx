import React from "react";
import Dashboard from "./dashboard";
import type { Workflow } from "./workflow-helpers";

// Force Next.js to treat this page as fully dynamic (no SSG/cache)
export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function Home() {
  let workflows: Workflow[] = [];
  let error: string | null = null;
  let n8nConnected = false;

  // 1. Check if n8n connection exists in DB
  try {
    const connRes = await fetch(`${BASE}/api/connections/n8n`, {
      cache: "no-store",
    });
    const connJson = await connRes.json();
    n8nConnected = connJson.connected === true;
  } catch {
    // Connection check failed — treat as not connected
  }

  // 2. If connected, sync from n8n then read from DB
  if (n8nConnected) {
    // 2a. Trigger sync (n8n → DB)
    try {
      const syncRes = await fetch(`${BASE}/api/n8n/workflows`, { cache: "no-store" });
      if (!syncRes.ok) {
        console.warn("[page] sync returned", syncRes.status);
      }
    } catch (syncErr) {
      console.error("[page] sync call failed:", syncErr);
    }

    // 2b. Read from DB (source of truth)
    try {
      const res = await fetch(`${BASE}/api/workflows`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) {
        error = json.error ?? "Failed to fetch workflows";
      } else {
        workflows = json.data ?? [];
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Could not reach API";
    }
  }

  return (
    <Dashboard
      workflows={workflows}
      error={error}
      initialN8nConnected={n8nConnected}
    />
  );
}
