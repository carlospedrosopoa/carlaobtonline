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

  // Converter valor numérico para string formatada apenas quando não está editando
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      if (value === null || value === undefined) {
        setDisplayValue('');
      } else {
        // Formatar como moeda brasileira apenas quando não está editando
        const formatted = new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value);
        setDisplayValue(formatted);
      }
    }
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;

    // Remover tudo exceto números, vírgula e ponto
    inputValue = inputValue.replace(/[^\d,.]/g, '');

    // Substituir ponto por vírgula (padrão brasileiro)
    inputValue = inputValue.replace(/\./g, ',');

    // Garantir apenas uma vírgula
    const parts = inputValue.split(',');
    if (parts.length > 2) {
      inputValue = parts[0] + ',' + parts.slice(1).join('');
    }

    // Limitar a 2 casas decimais após a vírgula
    if (parts.length === 2 && parts[1].length > 2) {
      inputValue = parts[0] + ',' + parts[1].substring(0, 2);
    }

    // Se o usuário está digitando apenas números sem vírgula, permitir digitação livre
    // A formatação será aplicada no blur
    setDisplayValue(inputValue);

    // Converter para número
    if (inputValue === '' || inputValue === ',') {
      onChange(null);
    } else {
      // Se não tem vírgula, tratar como número inteiro (será formatado no blur)
      let numericValue: number;
      if (inputValue.includes(',')) {
        numericValue = parseFloat(inputValue.replace(',', '.'));
      } else {
        // Se está digitando apenas números, tratar como valor inteiro
        // Exemplo: "500" = 500.00, "50" = 50.00
        numericValue = parseFloat(inputValue);
      }
      
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
    setIsEditing(false);
    // Ao sair do campo, formatar o valor exibido sempre com 2 casas decimais
    if (value !== null && value !== undefined) {
      const formatted = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
      setDisplayValue(formatted);
    } else {
      setDisplayValue('');
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditing(true);
    // Ao focar, mostrar valor numérico simples para facilitar edição
    if (value !== null && value !== undefined) {
      // Mostrar valor com vírgula mas sem formatação de milhares
      const formatted = value.toFixed(2).replace('.', ',');
      setDisplayValue(formatted);
    } else {
      setDisplayValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Permitir navegação e edição normal
    if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
      return;
    }
    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if (e.ctrlKey || e.metaKey) {
      return;
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
          id={id}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
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

