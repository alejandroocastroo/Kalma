'use client'
import { getCurrencyLocale, getCurrencySymbol } from '@/lib/utils'

interface CurrencyInputProps {
  value: string
  onChange: (display: string) => void
  currency?: string
  placeholder?: string
  required?: boolean
  className?: string
}

export function CurrencyInput({
  value,
  onChange,
  currency = 'COP',
  placeholder,
  required,
  className = '',
}: CurrencyInputProps) {
  const locale = getCurrencyLocale(currency)
  const symbol = getCurrencySymbol(currency)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) { onChange(''); return }
    const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(parseInt(digits, 10))
    onChange(formatted)
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium select-none pointer-events-none">
        {symbol}
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        className={`w-full pl-7 pr-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
      />
    </div>
  )
}
