// components/CurrencyInput.tsx - Componente de input de moeda que permite digitar em centavos
'use client';

import { useState, useEffect, useRef } from 'react';

interface CurrencyInputProps {
  name: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
}

export default function CurrencyInput({
  name,
  value,
  onChange,
  className = '',
  required = false,
  disabled = false,
  placeholder = '0,00',
  min,
  max,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatToBrazilian = (num: number): string => {
    if (num === 0 || !num) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const centavosToReais = (centavos: number): number => {
    return centavos / 100;
  };

  const reaisToCentavos = (reais: number): number => {
    return Math.round(reais * 100);
  };

  useEffect(() => {
    if (!isFocused) {
      if (value > 0) {
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
      onChange(0);
      return;
    }

    const centavos = parseInt(numbersOnly, 10);
    const reais = centavosToReais(centavos);
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
    if (value > 0) {
      setDisplayValue(formatToBrazilian(value));
    } else {
      setDisplayValue('');
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
        R$
      </div>
      <input
        ref={inputRef}
        type="text"
        name={name}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`${className} pl-10`}
        required={required}
        disabled={disabled}
        inputMode="numeric"
      />
    </div>
  );
}
