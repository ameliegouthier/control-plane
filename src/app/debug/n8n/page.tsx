import React from "react";

export default async function DebugN8n() {
  let json: unknown = null;
  let error: string | null = null;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/n8n/workflows`,
      { cache: "no-store" }
    );
    json = await res.json();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : "Could not reach API";
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="mb-4 text-lg font-semibold text-foreground">
        Debug — /api/n8n/workflows
      </h1>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <pre className="overflow-auto rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-foreground">
          {JSON.stringify(json, null, 2)}
        </pre>
      )}
    </div>
  );
}
