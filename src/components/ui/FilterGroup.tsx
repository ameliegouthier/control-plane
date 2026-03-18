"use client";

interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface FilterGroupProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterGroup({ options, value, onChange }: FilterGroupProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100/80 rounded-lg p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-2.5 py-1.5 text-[11px] rounded-md transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
            value === option.value
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
          {option.count != null && (
            <span className="text-[10px] text-gray-400">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
