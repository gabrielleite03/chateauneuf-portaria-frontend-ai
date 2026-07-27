import React, { useEffect, useMemo, useState } from 'react';
import { Resident } from '../types';

interface RegisteredUnitAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  valueFormat?: 'unit' | 'label';
}

export default function RegisteredUnitAutocomplete({
  value,
  onChange,
  id,
  placeholder = 'Digite ou selecione um apartamento',
  className = '',
  valueFormat = 'unit',
}: RegisteredUnitAutocompleteProps) {
  const [options, setOptions] = useState<Array<{ unit: string; label: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadUnits = async () => {
      try {
        const response = await fetch('/api/residents');
        if (!response.ok) return;

        const residents: Resident[] = await response.json();
        const registeredUnits = residents
          .filter(resident => resident.unit?.trim())
          .map(resident => resident.unit.trim())
          .sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true }));

        setOptions(Array.from(new Set(registeredUnits)).map(unit => ({
          unit,
          label: `Apto ${unit}`,
        })));
      } catch (error) {
        console.error('Failed to load registered apartment units', error);
      }
    };

    loadUnits();
  }, []);

  const filteredOptions = useMemo(() => {
    const term = value.trim().toLowerCase();
    return options.filter(option =>
      option.label.toLowerCase().includes(term) || option.unit.toLowerCase().includes(term)
    );
  }, [options, value]);

  const listId = `${id || 'registered-unit'}-options`;

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={event => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        autoComplete="off"
        className={className}
      />

      {isOpen && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 w-full max-h-52 overflow-y-auto rounded-sm border border-slate-700 bg-slate-950 shadow-xl"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => {
              const optionValue = valueFormat === 'label' ? option.label : option.unit;
              return (
              <button
                key={option.unit}
                type="button"
                role="option"
                aria-selected={value === optionValue}
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  onChange(optionValue);
                  setIsOpen(false);
                }}
                className="block w-full border-b border-slate-900 px-3 py-2 text-left text-xs font-mono text-slate-300 transition last:border-b-0 hover:bg-emerald-950/40 hover:text-emerald-400"
              >
                {option.label}
              </button>
              );
            })
          ) : (
            <p className="px-3 py-2 text-[10px] font-mono text-slate-500">
              Nenhum apartamento cadastrado encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
