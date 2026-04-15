'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payments, reports, spaces as spacesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from '@/components/admin/stats-card'
import { formatCOP, categoryLabels, paymentMethodLabels } from '@/lib/utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { DollarSign, TrendingUp, TrendingDown, Plus, Trash2, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Space } from '@/types'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']
const SPACE_COLORS: Record<string, string> = {
  Pilates: '#6366f1',
  Barre: '#10b981',
  General: '#94a3b8',
}

const INCOME_CATEGORIES = [
  ['clase_grupal', 'Clase grupal'],
  ['clase_privada', 'Clase privada'],
  ['paquete_sesiones', 'Paquete de sesiones'],
  ['membresia', 'Membresía'],
  ['inscripcion', 'Inscripción / matrícula'],
  ['otro_ingreso', 'Otro ingreso'],
]

const EXPENSE_CATEGORIES = [
  ['arriendo', 'Arriendo'],
  ['servicios_publicos', 'Servicios públicos'],
  ['nomina_instructores', 'Nómina instructores'],
  ['nomina_admin', 'Nómina administrativa'],
  ['mantenimiento', 'Mantenimiento'],
  ['equipamiento', 'Equipamiento'],
  ['marketing', 'Marketing y publicidad'],
  ['contabilidad', 'Contabilidad'],
  ['tecnologia', 'Software / tecnología'],
  ['seguros', 'Seguros'],
  ['otros_gastos', 'Otros gastos'],
]

export default function CajaPage() {
  const today = new Date()
  const [startDate, setStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'))
  const [showIncome, setShowIncome] = useState(false)
  const [showExpense, setShowExpense] = useState(false)
  const [activeSpace, setActiveSpace] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const qc = useQueryClient()

  const params = { start: startDate, end: endDate }

  const { data: paymentList = [], isLoading } = useQuery({
    queryKey: ['payments', params],
    queryFn: () => payments.list(params),
  })

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['payment-summary', params],
    queryFn: () => payments.summary(params),
  })

  const { data: spacesList = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => payments.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['payment-summary'] })
      toast.success('Registro eliminado')
    },
  })

  const filteredList = useMemo(() => {
    if (!activeSpace) return paymentList
    if (activeSpace === '__general__') return paymentList.filter((p) => !p.space_id)
    return paymentList.filter((p) => p.space_name === activeSpace)
  }, [paymentList, activeSpace])

  const chartData = summary
    ? Object.entries(summary.by_category || {}).map(([key, val]) => ({
        name: categoryLabels[key] || key,
        value: Number(val),
      }))
    : []

  const bySpace = summary?.by_space || {}

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payments'] })
    qc.invalidateQueries({ queryKey: ['payment-summary'] })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await payments.exportExcel({ start: startDate, end: endDate })
    } catch {
      toast.error('Error al generar el Excel')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Desde</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Hasta</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            {exporting ? 'Generando...' : 'Exportar Excel'}
          </Button>
          <Button onClick={() => setShowIncome(true)}>
            <Plus className="w-4 h-4 mr-1" /> Ingreso
          </Button>
          <Button variant="outline" onClick={() => setShowExpense(true)}>
            <Plus className="w-4 h-4 mr-1" /> Egreso
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total ingresos"
          value={formatCOP(summary?.total_income || 0)}
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          loading={loadingSummary}
        />
        <StatsCard
          title="Total egresos"
          value={formatCOP(summary?.total_expenses || 0)}
          icon={<TrendingDown className="w-5 h-5 text-red-500" />}
          loading={loadingSummary}
        />
        <StatsCard
          title="Balance neto"
          value={formatCOP(summary?.net || 0)}
          icon={<DollarSign className="w-5 h-5" />}
          loading={loadingSummary}
        />
      </div>

      {/* By space breakdown */}
      {Object.keys(bySpace).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(bySpace).map(([spaceName, data]) => (
            <div key={spaceName} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: SPACE_COLORS[spaceName] || '#94a3b8' }}
                />
                <p className="font-semibold text-gray-800 text-sm">{spaceName}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Ingresos</p>
                  <p className="text-xs font-semibold text-green-600">{formatCOP(data.income)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Egresos</p>
                  <p className="text-xs font-semibold text-red-500">{formatCOP(data.expenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Neto</p>
                  <p className={`text-xs font-semibold ${data.net >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                    {formatCOP(data.net)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Donut chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">Por categoría</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCOP(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Transactions table */}
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${chartData.length > 0 ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
          {/* Space filter tabs */}
          <div className="flex gap-1 px-4 pt-4 pb-3 border-b border-gray-100 overflow-x-auto">
            <button
              onClick={() => setActiveSpace(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${!activeSpace ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              Todos
            </button>
            {spacesList.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSpace(s.name)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeSpace === s.name ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {s.name}
              </button>
            ))}
            <button
              onClick={() => setActiveSpace('__general__')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeSpace === '__general__' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              General
            </button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Espacio</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : filteredList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-gray-500 text-xs whitespace-nowrap">{p.payment_date}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{p.description || '—'}</p>
                        {p.client_name && <p className="text-xs text-gray-500">{p.client_name}</p>}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">{categoryLabels[p.category] || p.category}</TableCell>
                      <TableCell>
                        {p.space_name ? (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${SPACE_COLORS[p.space_name] || '#6366f1'}18`,
                              color: SPACE_COLORS[p.space_name] || '#6366f1',
                            }}
                          >
                            {p.space_name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">General</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">{paymentMethodLabels[p.payment_method] || p.payment_method}</TableCell>
                      <TableCell className={`text-right font-semibold ${p.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                        {p.type === 'expense' ? '-' : '+'}{formatCOP(p.amount)}
                      </TableCell>
                      <TableCell>
                        <button onClick={() => deleteMutation.mutate(p.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && filteredList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 text-sm py-10">
                    Sin registros en este período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Income modal */}
      <Dialog open={showIncome} onOpenChange={setShowIncome}>
        <DialogContent title="Registrar ingreso">
          <PaymentForm type="income" spaces={spacesList} onClose={() => { setShowIncome(false); invalidate() }} />
        </DialogContent>
      </Dialog>

      {/* Expense modal */}
      <Dialog open={showExpense} onOpenChange={setShowExpense}>
        <DialogContent title="Registrar egreso">
          <PaymentForm type="expense" spaces={spacesList} onClose={() => { setShowExpense(false); invalidate() }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentForm({ type, spaces, onClose }: { type: 'income' | 'expense'; spaces: Space[]; onClose: () => void }) {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const methods = [
    ['cash', 'Efectivo'],
    ['transfer', 'Transferencia'],
    ['card', 'Tarjeta'],
    ['nequi', 'Nequi'],
    ['daviplata', 'Daviplata'],
  ]

  const [form, setForm] = useState({
    amountDisplay: '',
    category: categories[0][0],
    payment_method: 'cash',
    description: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    space_id: '',
  })
  const [loading, setLoading] = useState(false)

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setForm((f) => ({ ...f, amountDisplay: '' }))
      return
    }
    const formatted = new Intl.NumberFormat('es-CO').format(parseInt(digits, 10))
    setForm((f) => ({ ...f, amountDisplay: formatted }))
  }

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawAmount = parseInt(form.amountDisplay.replace(/\D/g, ''), 10)
    if (!rawAmount) { toast.error('Ingresa el monto'); return }
    setLoading(true)
    try {
      await payments.create({
        type,
        amount: rawAmount as any,
        category: form.category,
        payment_method: form.payment_method,
        description: form.description || undefined,
        payment_date: form.payment_date,
        space_id: form.space_id || undefined,
      } as any)
      toast.success(type === 'income' ? 'Ingreso registrado' : 'Egreso registrado')
      onClose()
    } catch {
      toast.error('Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monto (COP) *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="120.000"
            value={form.amountDisplay}
            onChange={handleAmount}
            className="pl-7"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <select
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.category}
            onChange={f('category')}
          >
            {categories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
          <select
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.payment_method}
            onChange={f('payment_method')}
          >
            {methods.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Espacio</label>
        <select
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={form.space_id}
          onChange={f('space_id')}
        >
          <option value="">General (sin espacio específico)</option>
          {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <Input placeholder="Descripción del registro..." value={form.description} onChange={f('description')} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
        <Input type="date" value={form.payment_date} onChange={f('payment_date')} />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Registrar'}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  )
}
