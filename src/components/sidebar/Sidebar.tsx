"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProviderFilter from "./ProviderFilter";
import { useProviderFilter } from "@/hooks/useProviderFilter";
import { N8nIcon, MakeIcon } from "@/lib/provider-config";
import ConnectProviderModal from "@/app/connect-provider-modal";
import type { AutomationProvider } from "@/lib/providers/types";

/**
 * App sidebar. Lives in layout.tsx to avoid re-renders on navigation.
 * Provider filter state is global via ProviderFilterContext.
 */
export default function Sidebar() {
  const router = useRouter();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AutomationProvider | null>(null);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [hoveredAdd, setHoveredAdd] = useState(false);

  const handleConnectSuccess = () => {
    setShowConnectModal(false);
    setSelectedProvider(null);
    router.refresh();
  };

  return (
    <>
      <aside
        className="fixed left-4 top-4 bottom-4 w-[56px] z-50 flex flex-col items-center py-4 bg-white border border-gray-200/60 rounded-2xl"
        style={{
          boxShadow:
            "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)",
        }}
      >
        <Link
          href="/overview"
          className="w-8 h-8 rounded-[18px] flex items-center justify-center bg-[#050605]"
          aria-label="Control Plane"
        >
          <Image
            src="/logo-mark.png"
            alt="Control Plane logo"
            width={24}
            height={24}
            className="w-full h-full rounded-[18px]"
          />
        </Link>

        <div className="w-6 h-px bg-gray-100 my-4" />

        <nav className="flex flex-col items-center gap-1.5" aria-label="Provider filter">
          <ProviderFilter />

          <div
            className="relative"
            onMouseEnter={() => setHoveredAdd(true)}
            onMouseLeave={() => setHoveredAdd(false)}
          >
            <button
              type="button"
              onClick={() => setShowProviderMenu((v) => !v)}
              title="Connect integration"
              className="w-8 h-8 flex items-center justify-center rounded-lg border bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all duration-150 hover:scale-105"
            >
              <span className="text-[18px] leading-none">+</span>
            </button>
            {hoveredAdd && !showProviderMenu && (
              <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[11px] px-2.5 py-1 rounded-md whitespace-nowrap z-50 pointer-events-none">
                Connect integration
              </div>
            )}
            {showProviderMenu && (
              <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-lg shadow-lg text-[12px] text-gray-900 py-2 z-50 min-w-[160px]">
                <div className="px-3 pb-1 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  Connect automation tool
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProvider("n8n");
                    setShowConnectModal(true);
                    setShowProviderMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left"
                >
                  <N8nIcon className="w-4 h-4 text-orange-600" />
                  <span className="text-xs text-gray-900">n8n</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProvider("make");
                    setShowConnectModal(true);
                    setShowProviderMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left"
                >
                  <MakeIcon className="w-4 h-4 text-violet-600" />
                  <span className="text-xs text-gray-900">Make</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="flex-1" />

        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            title="Settings"
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 flex items-center justify-center transition-colors"
          >
            <svg
              className="w-[15px] h-[15px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-[10px] text-gray-600">JD</span>
          </div>
        </div>
      </aside>

      {selectedProvider && (
        <ConnectProviderModal
          open={showConnectModal}
          provider={selectedProvider}
          onClose={() => {
            setShowConnectModal(false);
            setSelectedProvider(null);
          }}
          onSuccess={handleConnectSuccess}
        />
      )}
    </>
  );
}
