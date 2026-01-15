// components/InputMonetario.tsx - Componente de input para valores monetários
'use client';

import { useState, useEffect, useRef } from 'react';

interface InputMonetarioProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  label?: string;
  id?: string;
}

export default function InputMonetario({
  value,
  onChange,
  placeholder = '0,00',
  className = '',
  disabled = false,
  required = false,
  min,
  max,
  label,
  id,
}: InputMonetarioProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatToBrazilian = (num: number): string => {
    if (!num) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  useEffect(() => {
    if (!isFocused) {
      if (value !== null && value !== undefined && value > 0) {
        setDisplayValue(formatToBrazilian(value));
      } else {
        setDisplayValue('');
      }
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const numbersOnly = inputValue.replace(/\D/g, '');

    if (numbersOnly === '') {
      setDisplayValue('');
      onChange(null);
      return;
    }

    const centavos = parseInt(numbersOnly, 10);
    let reais = centavos / 100;

    let finalValue = reais;
    if (min !== undefined && finalValue < min) {
      finalValue = min;
    }
    if (max !== undefined && finalValue > max) {
      finalValue = max;
    }

    const formatted = formatToBrazilian(finalValue);

    requestAnimationFrame(() => {
      setDisplayValue(formatted);
      setTimeout(() => {
        if (inputRef.current) {
          const length = formatted.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 0);
    });

    onChange(finalValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setTimeout(() => {
      if (inputRef.current) {
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }, 0);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value !== null && value !== undefined && value > 0) {
      setDisplayValue(formatToBrazilian(value));
    } else {
      setDisplayValue('');
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
          R$
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-right font-medium ${className} ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
        />
      </div>
    </div>
  );
}
