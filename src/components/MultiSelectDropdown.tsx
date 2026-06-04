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
}

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange
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
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className="relative z-50 group" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-12 items-center gap-2 rounded-[18px] border px-5 text-sm font-bold shadow-[0_14px_32px_-30px_rgba(61,89,120,0.5)] transition-colors hover:bg-white ${
          selected.length > 0 ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-[#dce8ef] bg-white/90 text-slate-700'
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
            className="p-0.5 rounded-full hover:bg-indigo-200 text-indigo-600 mr-1"
          >
            <X className="w-3 h-3" />
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-[90] mt-2 w-72 max-h-80 overflow-y-auto rounded-[20px] border border-[#dce8ef] bg-white p-2 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.28)]">
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <div
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={`flex items-center rounded-2xl px-3 py-2.5 cursor-pointer text-sm ${
                  isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
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
