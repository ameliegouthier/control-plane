"use client";

import React, { useState } from "react";
import { useProviderFilter } from "@/hooks/useProviderFilter";
import { getProviderConfig } from "@/lib/provider-config";

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
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 hover:scale-105 border ${config.bgColor} ${config.color} ${config.borderColor} ${
                selected
                  ? "ring-2 ring-offset-1 ring-gray-300 opacity-100"
                  : "opacity-50 hover:opacity-70"
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
