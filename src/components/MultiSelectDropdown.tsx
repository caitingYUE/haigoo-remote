import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  disabled = false,
  disabledMessage = '暂无权限'
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (disabled) return;
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange([]);
  };

  return (
    <div className="hg-multi-select relative z-50 group" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-disabled={disabled}
        className={`hg-multi-select__trigger flex h-12 items-center gap-2 border px-5 text-sm font-bold transition-colors ${
          disabled
            ? 'border-[#deddd7] bg-transparent text-slate-400'
            : selected.length > 0 ? 'border-[#718d80] bg-[#edf3ef] text-[#31594e]' : 'border-[#bfc8c4] bg-transparent text-slate-700 hover:border-[#718d80]'
        }`}
      >
        <span className="truncate max-w-[100px]">
          {selected.length === 0 
            ? label 
            : selected.length === 1 
              ? options.find(o => o.value === selected[0])?.label || selected[0]
              : `${label} (${selected.length})`
          }
        </span>
        {selected.length > 0 && (
          <span 
            onClick={clearSelection}
            className="p-0.5 text-[#31594e] mr-1 hover:bg-[#dfe9e3]"
          >
            <X className="w-3 h-3" />
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="hg-multi-select__panel absolute right-0 top-full z-[90] mt-2 w-72 max-h-80 overflow-y-auto border border-[#bfc8c4] bg-[#fffdf8] p-2 shadow-[0_24px_56px_-42px_rgba(15,23,42,0.35)]">
          {disabled ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm font-bold text-slate-500">
              {disabledMessage}
            </div>
          ) : options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <div
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={`flex items-center px-3 py-2.5 cursor-pointer text-sm ${
                  isSelected ? 'bg-[#edf3ef] text-[#31594e]' : 'text-slate-700 hover:bg-[#f4f6f4]'
                }`}
              >
                <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-[#31594e] border-[#31594e]' : 'border-slate-300'
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <span>{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
