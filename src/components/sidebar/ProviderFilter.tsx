"use client";

import React, { useState } from "react";
import { useProviderFilter } from "@/hooks/useProviderFilter";
import { getProviderConfig } from "@/lib/provider-config";

const PROVIDER_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  n8n:    { bg: "bg-orange-50",  border: "border-orange-300", icon: "text-orange-500" },
  make:   { bg: "bg-violet-50",  border: "border-violet-300", icon: "text-violet-500" },
  zapier: { bg: "bg-amber-50",   border: "border-amber-300",  icon: "text-amber-500"  },
};

/**
 * Provider filter icons for the sidebar.
 * Each icon acts as a toggle filter. Active = highlighted, inactive = lower opacity.
 * No status dots or notification indicators.
 */
export default function ProviderFilter() {
  const { providers, toggleProvider, isSelected } = useProviderFilter();
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);

  return (
    <>
      {providers.map((provider) => {
        const config = getProviderConfig(provider);
        const IconComponent = config.icon;
        const selected = isSelected(provider);
        return (
          <div
            key={provider}
            className="relative"
            onMouseEnter={() => setHoveredProvider(provider)}
            onMouseLeave={() => setHoveredProvider(null)}
          >
            <button
              type="button"
              onClick={() => toggleProvider(provider)}
              title={config.label}
              aria-pressed={selected}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all border ${
                selected
                  ? `${PROVIDER_STYLES[provider]?.bg ?? "bg-gray-50"} ${PROVIDER_STYLES[provider]?.border ?? "border-gray-300"} ${PROVIDER_STYLES[provider]?.icon ?? config.color} opacity-100`
                  : `bg-transparent border-transparent ${PROVIDER_STYLES[provider]?.icon ?? config.color} opacity-30 hover:opacity-60`
              }`}
            >
              <IconComponent className="w-[15px] h-[15px]" />
            </button>
            {hoveredProvider === provider && (
              <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[11px] px-2.5 py-1 rounded-md whitespace-nowrap z-50 pointer-events-none">
                {config.label}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
