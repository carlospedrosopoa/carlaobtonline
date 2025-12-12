// components/InputMonetario.tsx - Componente de input para valores monetários
'use client';

import { useState, useEffect } from 'react';

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

  // Converter valor numérico para string formatada
  useEffect(() => {
    if (value === null || value === undefined) {
      setDisplayValue('');
    } else {
      // Formatar como moeda brasileira
      const formatted = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
      setDisplayValue(formatted);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;

    // Remover tudo exceto números, vírgula e ponto
    inputValue = inputValue.replace(/[^\d,.-]/g, '');

    // Substituir ponto por vírgula (padrão brasileiro)
    inputValue = inputValue.replace(/\./g, ',');

    // Garantir apenas uma vírgula
    const parts = inputValue.split(',');
    if (parts.length > 2) {
      inputValue = parts[0] + ',' + parts.slice(1).join('');
    }

    // Limitar a 2 casas decimais
    if (parts.length === 2 && parts[1].length > 2) {
      inputValue = parts[0] + ',' + parts[1].substring(0, 2);
    }

    setDisplayValue(inputValue);

    // Converter para número
    if (inputValue === '' || inputValue === ',') {
      onChange(null);
    } else {
      // Substituir vírgula por ponto para parseFloat
      const numericValue = parseFloat(inputValue.replace(',', '.'));
      if (!isNaN(numericValue)) {
        // Aplicar validações de min/max
        let finalValue = numericValue;
        if (min !== undefined && finalValue < min) {
          finalValue = min;
        }
        if (max !== undefined && finalValue > max) {
          finalValue = max;
        }
        onChange(finalValue);
      } else {
        onChange(null);
      }
    }
  };

  const handleBlur = () => {
    // Ao sair do campo, formatar o valor exibido
    if (value !== null && value !== undefined) {
      const formatted = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
      setDisplayValue(formatted);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Ao focar, mostrar apenas números para facilitar edição
    if (value !== null && value !== undefined) {
      setDisplayValue(value.toString().replace('.', ','));
    }
    e.target.select();
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
          id={id}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${className} ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
        />
      </div>
    </div>
  );
}

