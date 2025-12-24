import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SingleSelectDropdownProps {
  label: string;
  options: Option[];
  selected: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function SingleSelectDropdown({
  label,
  options,
  selected,
  onChange,
  className = ''
}: SingleSelectDropdownProps) {
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

  const handleSelect = (value: string) => {
    onChange(value);
    setIsOpen(false);
  };

  const selectedLabel = options.find(o => o.value === selected)?.label || selected;

  return (
    <div className={`relative group ${className}`} ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg hover:bg-slate-50 transition-colors h-11 ${
          isOpen ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-300'
        } text-slate-700 bg-white min-w-[140px] justify-between`}
      >
        <span className="truncate text-sm font-medium">
          {selectedLabel}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto p-1">
          {options.map((option) => {
            const isSelected = selected === option.value;
            return (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`flex items-center px-3 py-2.5 rounded-md cursor-pointer text-sm ${
                  isSelected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
