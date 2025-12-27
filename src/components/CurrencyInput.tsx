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

  // Converter número para formato brasileiro (R$ 0,00)
  const formatToBrazilian = (num: number): string => {
    if (num === 0 || !num) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Converter centavos (número inteiro) para reais (número decimal)
  const centavosToReais = (centavos: number): number => {
    return centavos / 100;
  };

  // Converter reais (número decimal) para centavos (número inteiro)
  const reaisToCentavos = (reais: number): number => {
    return Math.round(reais * 100);
  };

  // Atualizar displayValue quando value mudar externamente
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatToBrazilian(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Se estiver vazio, limpar
    if (inputValue === '' || inputValue.trim() === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Remover tudo exceto números
    const numbersOnly = inputValue.replace(/\D/g, '');
    
    // Se não há números, limpar
    if (numbersOnly === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Os últimos 2 dígitos são sempre centavos
    // Exemplo: 6000 → 60,00 | 15050 → 150,50 | 5 → 0,05
    const centavos = parseInt(numbersOnly, 10);
    const reais = centavosToReais(centavos);
    
    // Validar min/max
    let finalValue = reais;
    if (min !== undefined && finalValue < min) {
      finalValue = min;
    }
    if (max !== undefined && finalValue > max) {
      finalValue = max;
    }

    // Durante a digitação, mostrar apenas os números (sem formatação)
    setDisplayValue(numbersOnly);
    
    // Manter cursor no final após atualizar o valor
    setTimeout(() => {
      if (inputRef.current && isFocused) {
        const length = numbersOnly.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }, 0);
    
    // Chamar onChange com o valor em reais
    onChange(finalValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Ao focar, mostrar apenas os centavos (sem formatação)
    if (value > 0) {
      const centavos = reaisToCentavos(value);
      setDisplayValue(centavos.toString());
    } else {
      setDisplayValue('');
    }
    // Manter o cursor no final do input
    setTimeout(() => {
      if (inputRef.current) {
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }, 0);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Ao perder o foco, formatar o valor
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
        pattern="[0-9]*"
      />
      {isFocused && displayValue && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500 font-medium">
          = {formatToBrazilian(centavosToReais(parseInt(displayValue.replace(/\D/g, '') || '0', 10)))}
        </div>
      )}
    </div>
  );
}

