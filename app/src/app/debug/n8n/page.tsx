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
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
      <h1 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Debug — /api/n8n/workflows
      </h1>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <pre className="overflow-auto rounded-lg border border-zinc-200 bg-white p-4 text-xs leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          {JSON.stringify(json, null, 2)}
        </pre>
      )}
    </div>
  );
}
