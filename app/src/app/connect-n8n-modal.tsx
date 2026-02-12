"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface ConnectN8nModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Status = "idle" | "loading" | "success" | "error";

export default function ConnectN8nModal({
  open,
  onClose,
  onSuccess,
}: ConnectN8nModalProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus first input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset state when modal is reopened
  useEffect(() => {
    if (open) {
      setBaseUrl("");
      setApiKey("");
      setStatus("idle");
      setErrorMsg("");
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus("loading");
      setErrorMsg("");

      try {
        const res = await fetch("/api/connections/n8n", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseUrl, apiKey }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setErrorMsg(data.error ?? "Unknown error");
          return;
        }

        setStatus("success");
        // Close after a short delay so user sees the success message
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } catch {
        setStatus("error");
        setErrorMsg("Network error — check your connection");
      }
    },
    [baseUrl, apiKey, onSuccess, onClose],
  );

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== "loading") onClose();
      }}
    >
      {/* Modal card */}
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-base">
              ⚡
            </span>
            <h2 className="text-base font-semibold text-zinc-900">
              Connect n8n
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === "loading"}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <p className="mb-4 text-sm text-zinc-500">
            Enter your n8n instance URL and API key. We&apos;ll test the
            connection before saving.
          </p>

          {/* Base URL */}
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            n8n URL
          </label>
          <input
            ref={inputRef}
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://your-n8n.example.com"
            required
            disabled={status === "loading" || status === "success"}
            className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-300 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-zinc-50 disabled:text-zinc-400"
          />

          {/* API Key */}
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="n8n API key"
            required
            disabled={status === "loading" || status === "success"}
            className="mb-5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-300 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-zinc-50 disabled:text-zinc-400"
          />

          {/* Error message */}
          {status === "error" && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          {/* Success message */}
          {status === "success" && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
              Connected successfully!
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={status === "loading"}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                status === "loading" ||
                status === "success" ||
                !baseUrl.trim() ||
                !apiKey.trim()
              }
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {status === "loading" && (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="opacity-25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="opacity-75"
                  />
                </svg>
              )}
              {status === "loading" ? "Testing…" : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
