'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Settings, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { auth } from '@/lib/api'
import { getTenantCurrency, setTenantCurrency } from '@/lib/auth'
import { CURRENCY_OPTIONS, formatCurrency } from '@/lib/utils'

export default function ConfiguracionPage() {
  const [currency, setCurrency] = useState('COP')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setCurrency(getTenantCurrency())
  }, [])

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)
    try {
      await auth.updateCurrency(currency)
      setTenantCurrency(currency)
      setSaved(true)
      toast.success('Moneda actualizada correctamente')
    } catch {
      toast.error('Error al guardar la configuración')
    } finally {
      setLoading(false)
    }
  }

  const selected = CURRENCY_OPTIONS.find(o => o.value === currency)

  return (
    <div className="space-y-6 max-w-lg">
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
            <Settings className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Moneda del estudio</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Determina cómo se muestran los precios en toda la plataforma.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
          <select
            value={currency}
            onChange={e => { setCurrency(e.target.value); setSaved(false) }}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CURRENCY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Preview */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vista previa</p>
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(150000, currency)}</p>
            <p className="text-sm text-gray-400">150.000 unidades</p>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[1000, 50000, 1000000].map(n => (
              <div key={n} className="text-center">
                <p className="text-xs text-gray-400">{n.toLocaleString()}</p>
                <p className="text-sm font-semibold text-gray-700">{formatCurrency(n, currency)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Guardado
            </span>
          )}
        </div>

        <p className="text-xs text-gray-400">
          El cambio aplica de inmediato en todos los módulos del panel de administración.
          Si cierras sesión y vuelves a entrar, se cargará la moneda configurada automáticamente.
        </p>
      </section>
    </div>
  )
}
