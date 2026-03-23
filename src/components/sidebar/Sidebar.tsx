"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ProviderFilter from "./ProviderFilter";

function GridIcon() {
  return (
    <svg
      className="w-[15px] h-[15px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

interface SidebarProps {
  integrationIds: string[];
  initialDemoMode: boolean;
}

/**
 * App sidebar. Lives in layout.tsx to avoid re-renders on navigation.
 * Provider filter state is global via ProviderFilterContext.
 */
export default function Sidebar({ integrationIds, initialDemoMode }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isOverview = pathname === "/overview";
  const [isResyncing, setIsResyncing] = useState(false);

  const handleResync = async () => {
    if (integrationIds.length === 0) return;
    setIsResyncing(true);
    try {
      await Promise.all(
        integrationIds.map((id) =>
          fetch(`/api/integrations/${id}/sync`, { method: "POST" }),
        ),
      );
    } catch {
      // Swallow errors; page reload will reflect eventual state.
    } finally {
      setIsResyncing(false);
      router.refresh();
    }
  };

  const handleSetDemoMode = async (enabled: boolean) => {
    try {
      await fetch("/api/demo-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      router.refresh();
    } catch {
      // ignore network errors
    }
  };

  return (
    <aside
      className="fixed left-4 top-4 bottom-4 w-[56px] z-50 flex flex-col items-center py-4 bg-white border border-gray-200/60 rounded-2xl"
      style={{
        boxShadow:
          "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)",
      }}
    >
      {/* Logo */}
      <Link href="/overview" aria-label="Control Plane">
        <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-white text-[13px] font-semibold">
          W
        </div>
        {/* TODO: remplacer par le vrai logo */}
      </Link>

      <div className="w-6 h-px bg-gray-100 my-2" />

      {/* Main nav */}
      <nav className="flex flex-col items-center gap-1.5" aria-label="Main navigation">
        <Link
          href="/overview"
          title="Overview"
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            isOverview
              ? "bg-gray-100 text-gray-800"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          }`}
        >
          <GridIcon />
        </Link>
      </nav>

      <div className="w-6 h-px bg-gray-100 my-2" />

      {/* Provider filters */}
      <div className="flex flex-col items-center gap-1.5">
        <ProviderFilter />
      </div>

      <div className="flex-1" />

      {/* Resync */}
      <button
        type="button"
        onClick={handleResync}
        disabled={isResyncing || integrationIds.length === 0}
        title="Resync workflows"
        className="w-7 h-7 rounded-md flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M23 4v6h-6" />
          <path d="M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
      </button>

      {/* Demo / Live toggle */}
      <div
        className="flex flex-col items-center gap-1 my-2"
        title={initialDemoMode ? "Demo mode" : "Live mode"}
      >
        <button
          type="button"
          onClick={() => handleSetDemoMode(true)}
          className={`w-2 h-2 rounded-full transition-all ${
            initialDemoMode ? "bg-violet-400 scale-125" : "bg-gray-200 hover:bg-gray-300"
          }`}
        />
        <button
          type="button"
          onClick={() => handleSetDemoMode(false)}
          className={`w-2 h-2 rounded-full transition-all ${
            !initialDemoMode ? "bg-emerald-400 scale-125" : "bg-gray-200 hover:bg-gray-300"
          }`}
        />
      </div>

      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
        <span className="text-[10px] text-gray-600">JD</span>
      </div>
    </aside>
  );
}
