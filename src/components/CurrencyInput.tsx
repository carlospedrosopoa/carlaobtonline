// components/CurrencyInput.tsx - Componente de input de moeda que permite digitar e formata automaticamente
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

  // Converter formato brasileiro para número
  const parseFromBrazilian = (str: string): number => {
    // Remove tudo exceto números e vírgula/ponto
    const cleaned = str.replace(/[^\d,.-]/g, '');
    
    // Substitui vírgula por ponto para parseFloat
    const normalized = cleaned.replace(',', '.');
    
    // Remove múltiplos pontos/vírgulas, mantendo apenas o último
    const parts = normalized.split(/[.,]/);
    if (parts.length > 2) {
      const integerPart = parts.slice(0, -1).join('');
      const decimalPart = parts[parts.length - 1];
      return parseFloat(integerPart + '.' + decimalPart) || 0;
    }
    
    return parseFloat(normalized) || 0;
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
    if (inputValue === '' || inputValue === 'R$' || inputValue.trim() === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Remover "R$" e espaços se o usuário digitar
    let cleaned = inputValue.replace(/R\$\s*/g, '').trim();
    
    // Se ainda estiver vazio após limpar
    if (cleaned === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Parsear o valor digitado
    const numericValue = parseFromBrazilian(cleaned);
    
    // Validar min/max
    let finalValue = numericValue;
    if (min !== undefined && finalValue < min) {
      finalValue = min;
    }
    if (max !== undefined && finalValue > max) {
      finalValue = max;
    }

    // Formatar para exibição
    setDisplayValue(formatToBrazilian(finalValue));
    
    // Chamar onChange com o valor numérico
    onChange(finalValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Se o valor for 0, limpar o campo ao focar
    if (value === 0) {
      setDisplayValue('');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Garantir que o valor está formatado corretamente
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
        inputMode="decimal"
      />
    </div>
  );
}

