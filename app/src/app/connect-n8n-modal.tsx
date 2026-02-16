"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type Status = "idle" | "testing" | "saving" | "success" | "error";

interface ConnectN8nModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Error-code → French message map ────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_URL: "URL invalide — inclus le protocole (https://…).",
  LOCALHOST_NOT_ALLOWED:
    "Vercel ne peut pas joindre localhost. Utilise ngrok pour exposer ton instance n8n.",
  N8N_UNREACHABLE:
    "n8n inaccessible — vérifie l'URL et que l'instance est bien démarrée.",
  AUTH_REQUIRED:
    "n8n est joignable mais demande une authentification. " +
    "L'auth n'est pas supportée dans le MVP — utilise les données de démo pour continuer.",
  WRONG_BASE_URL_OR_API_PATH:
    "Mauvaise URL ou chemin API — l'API n8n n'a pas été trouvée.",
  NOT_JSON:
    "La réponse n'est pas du JSON — probablement une page de login ou un interstitiel ngrok.",
  N8N_ERROR: "n8n a renvoyé une erreur.",
};

function mapError(code?: string, fallback?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return fallback ?? "Erreur inconnue.";
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConnectN8nModal({
  open,
  onClose,
  onSuccess,
}: ConnectN8nModalProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [detail, setDetail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (open) {
      setBaseUrl("");
      setStatus("idle");
      setErrorMsg("");
      setDetail("");
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg("");
      setDetail("");

      const payload = { baseUrl };

      // Step 1 — test reachability
      setStatus("testing");
      try {
        const testRes = await fetch("/api/connections/n8n/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const testData = await testRes.json();

        if (!testData.ok) {
          setStatus("error");
          setErrorMsg(mapError(testData.code, testData.message));
          if (testData.message) setDetail(testData.message);
          return;
        }
      } catch {
        setStatus("error");
        setErrorMsg("Erreur réseau — vérifie ta connexion.");
        return;
      }

      // Step 2 — save
      setStatus("saving");
      try {
        const saveRes = await fetch("/api/connections/n8n", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const saveData = await saveRes.json();

        if (!saveData.ok) {
          setStatus("error");
          setErrorMsg(mapError(saveData.code, saveData.message));
          return;
        }
      } catch {
        setStatus("error");
        setErrorMsg("Erreur réseau lors de la sauvegarde.");
        return;
      }

      setStatus("success");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    },
    [baseUrl, onSuccess, onClose],
  );

  if (!open) return null;

  const busy = status === "testing" || status === "saving";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
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
            disabled={busy}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <p className="mb-4 text-sm text-zinc-500">
            Entre l&apos;URL de ton instance n8n. On vérifie qu&apos;elle est joignable.
          </p>

          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            URL n8n
          </label>
          <input
            ref={inputRef}
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://xxxx.ngrok-free.app"
            required
            disabled={busy || status === "success"}
            className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-300 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-zinc-50 disabled:text-zinc-400"
          />

          {/* ngrok help */}
          <div className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
            <span className="font-medium text-zinc-500">ngrok ?</span>{" "}
            Si n8n tourne en local, lance{" "}
            <code className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-zinc-600">
              ngrok http 5678
            </code>{" "}
            puis colle l&apos;URL <code className="font-mono">https://…</code> fournie.
          </div>

          {/* Error */}
          {status === "error" && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              <p>{errorMsg}</p>
              {detail && detail !== errorMsg && (
                <p className="mt-1 text-[11px] text-red-400">{detail}</p>
              )}
            </div>
          )}

          {/* Success */}
          {status === "success" && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
              Connexion réussie !
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || status === "success" || !baseUrl.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
              )}
              {status === "testing"
                ? "Test…"
                : status === "saving"
                  ? "Sauvegarde…"
                  : "Tester la connexion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
