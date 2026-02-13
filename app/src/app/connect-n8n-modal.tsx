"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

type AuthType = "apiKey" | "basic";
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
  INVALID_CREDENTIALS:
    "Identifiants invalides — vérifie ton email/mot de passe ou ta clé API.",
  AUTH_REQUIRED: "n8n demande une authentification (login).",
  WRONG_BASE_URL_OR_API_PATH:
    "Mauvaise URL ou chemin API — l'API n8n n'a pas été trouvée.",
  NOT_JSON:
    "La réponse n'est pas du JSON — probablement une page de login ou un interstitiel ngrok.",
  N8N_ERROR: "n8n a renvoyé une erreur.",
};

function mapError(code?: string, fallbackMsg?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return fallbackMsg ?? "Erreur inconnue.";
}

// ─── Spinner SVG ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
  );
}

// ─── Modal component ────────────────────────────────────────────────────────

export default function ConnectN8nModal({
  open,
  onClose,
  onSuccess,
}: ConnectN8nModalProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState<AuthType>("basic");
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [detail, setDetail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus first input when modal opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Reset state when modal is reopened
  useEffect(() => {
    if (open) {
      setBaseUrl("");
      setAuthType("basic");
      setApiKey("");
      setUsername("");
      setPassword("");
      setStatus("idle");
      setErrorMsg("");
      setDetail("");
    }
  }, [open]);

  // Are the required fields filled?
  const canSubmit =
    baseUrl.trim() !== "" &&
    (authType === "apiKey"
      ? apiKey.trim() !== ""
      : username.trim() !== "" && password.trim() !== "");

  // ── Submit handler: test → save ───────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg("");
      setDetail("");

      const payload = {
        baseUrl,
        authType,
        ...(authType === "apiKey" ? { apiKey } : { username, password }),
      };

      // Step 1 — test
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
          if (saveData.message) setDetail(saveData.message);
          return;
        }
      } catch {
        setStatus("error");
        setErrorMsg("Erreur réseau lors de la sauvegarde.");
        return;
      }

      // Done
      setStatus("success");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    },
    [baseUrl, authType, apiKey, username, password, onSuccess, onClose],
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
        {/* ── Header ─────────────────────────────────────────────────── */}
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

        {/* ── Body ───────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <p className="mb-4 text-sm text-zinc-500">
            Entre l&apos;URL de ton instance n8n et tes identifiants.
            On teste la connexion avant de sauvegarder.
          </p>

          {/* Base URL */}
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

          {/* Auth type toggle */}
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Authentification
          </label>
          <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-0.5">
            <button
              type="button"
              disabled={busy || status === "success"}
              onClick={() => setAuthType("basic")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                authType === "basic"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              } disabled:opacity-50`}
            >
              Email / Mot de passe
            </button>
            <button
              type="button"
              disabled={busy || status === "success"}
              onClick={() => setAuthType("apiKey")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                authType === "apiKey"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              } disabled:opacity-50`}
            >
              Clé API
            </button>
          </div>

          {/* Conditional credential fields */}
          {authType === "apiKey" ? (
            <>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Clé API n8n
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Clé API n8n"
                required
                disabled={busy || status === "success"}
                className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-300 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-zinc-50 disabled:text-zinc-400"
              />
            </>
          ) : (
            <>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Email
              </label>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@example.com"
                required
                disabled={busy || status === "success"}
                className="mb-3 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-300 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-zinc-50 disabled:text-zinc-400"
              />
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe n8n"
                required
                disabled={busy || status === "success"}
                className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-300 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-zinc-50 disabled:text-zinc-400"
              />
            </>
          )}

          {/* ngrok help text */}
          <div className="mb-4 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
            <span className="font-medium text-zinc-500">ngrok ?</span>{" "}
            Si n8n tourne en local, lance{" "}
            <code className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-zinc-600">
              ngrok http 5678
            </code>{" "}
            puis utilise l&apos;URL <code className="font-mono">https://…</code>{" "}
            fournie.
          </div>

          {/* Error message */}
          {status === "error" && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              <p>{errorMsg}</p>
              {detail && detail !== errorMsg && (
                <p className="mt-1 text-[11px] text-red-400">{detail}</p>
              )}
            </div>
          )}

          {/* Success message */}
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
              disabled={busy || status === "success" || !canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy && <Spinner />}
              {status === "testing"
                ? "Test en cours…"
                : status === "saving"
                  ? "Sauvegarde…"
                  : "Connecter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
