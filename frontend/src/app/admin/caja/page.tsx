'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payments, spaces as spacesApi, clients as clientsApi, instructors as instructorsApi, auth as authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from '@/components/admin/stats-card'
import { formatCurrency, getCurrencyLocale, categoryLabels, paymentMethodLabels } from '@/lib/utils'
import { getTenantCurrency } from '@/lib/auth'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { DollarSign, TrendingUp, TrendingDown, Plus, Trash2, FileSpreadsheet, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Space, Instructor, Client, PaginatedResponse } from '@/types'

const PERIOD_DAY_KEY = 'caja_period_start_day'

function getPeriodDates(startDay: number): { start: string; end: string } {
  const today = new Date()
  const d = today.getDate()
  let periodStart: Date
  let periodEnd: Date
  if (d >= startDay) {
    periodStart = new Date(today.getFullYear(), today.getMonth(), startDay)
    periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, startDay - 1)
  } else {
    periodStart = new Date(today.getFullYear(), today.getMonth() - 1, startDay)
    periodEnd = new Date(today.getFullYear(), today.getMonth(), startDay - 1)
  }
  return {
    start: format(periodStart, 'yyyy-MM-dd'),
    end: format(periodEnd, 'yyyy-MM-dd'),
  }
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']
const SPACE_COLORS: Record<string, string> = {
  Pilates: '#6366f1',
  Barre: '#10b981',
  General: '#94a3b8',
}

const INCOME_CATEGORIES = [
  ['clase_dia', 'Clase Día'],
  ['clase_grupal', 'Clase grupal'],
  ['clase_privada', 'Clase privada'],
  ['paquete_sesiones', 'Paquete de sesiones'],
  ['membresia', 'Membresía'],
  ['membresia_hibrida', 'Membresía Híbrida'],
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
  const currency = getTenantCurrency()
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [periodStartDay, setPeriodStartDay] = useState(1)

  useEffect(() => {
    const day = Number(localStorage.getItem(PERIOD_DAY_KEY))
    if (day >= 1 && day <= 28) {
      const { start, end } = getPeriodDates(day)
      setStartDate(start)
      setEndDate(end)
      setPeriodStartDay(day)
    }
  }, [])
  const [showPeriodConfig, setShowPeriodConfig] = useState(false)
  const [periodDayInput, setPeriodDayInput] = useState(String(periodStartDay))
  const [showIncome, setShowIncome] = useState(false)
  const [showExpense, setShowExpense] = useState(false)
  const [activeSpace, setActiveSpace] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showCatManager, setShowCatManager] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('income')
  const qc = useQueryClient()

  function applyPeriodDay(day: number) {
    const clamped = Math.min(28, Math.max(1, day))
    const { start, end } = getPeriodDates(clamped)
    setStartDate(start)
    setEndDate(end)
    setPeriodStartDay(clamped)
    localStorage.setItem(PERIOD_DAY_KEY, String(clamped))
    setShowPeriodConfig(false)
  }

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

  const { data: customCats = { income: [], expense: [], hidden: { income: [], expense: [] } }, refetch: refetchCats } = useQuery({
    queryKey: ['custom-categories'],
    queryFn: () => authApi.getCustomCategories(),
    staleTime: 10 * 60 * 1000,
  })

  const addCatMutation = useMutation({
    mutationFn: ({ type, label }: { type: 'income' | 'expense'; label: string }) =>
      authApi.addCustomCategory(type, label),
    onSuccess: () => { refetchCats(); setNewCatLabel('') },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Error al agregar categoría'),
  })

  const deleteCatMutation = useMutation({
    mutationFn: ({ type, label }: { type: 'income' | 'expense'; label: string }) =>
      authApi.deleteCustomCategory(type, label),
    onSuccess: () => refetchCats(),
  })

  const hideCatMutation = useMutation({
    mutationFn: ({ type, key }: { type: 'income' | 'expense'; key: string }) =>
      authApi.hideDefaultCategory(type, key),
    onSuccess: () => refetchCats(),
  })

  const showCatMutation = useMutation({
    mutationFn: ({ type, key }: { type: 'income' | 'expense'; key: string }) =>
      authApi.showDefaultCategory(type, key),
    onSuccess: () => refetchCats(),
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
        {/* Configurar período */}
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => { setPeriodDayInput(String(periodStartDay)); setShowPeriodConfig(v => !v) }}
            className="text-gray-600 border-dashed"
          >
            <Settings2 className="w-4 h-4 mr-1" />
            Período {periodStartDay !== 1 && <span className="ml-1 text-xs text-primary-600 font-semibold">día {periodStartDay}</span>}
          </Button>
          {showPeriodConfig && (
            <div className="absolute left-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 w-64">
              <p className="text-sm font-semibold text-gray-800 mb-1">Inicio del período</p>
              <p className="text-xs text-gray-500 mb-3">Define el día del mes en que empieza tu período de caja (ej: 16).</p>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm text-gray-600 whitespace-nowrap">Día de inicio</label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={periodDayInput}
                  onChange={e => setPeriodDayInput(e.target.value)}
                  className="w-20 text-center"
                />
              </div>
              {(() => {
                const day = Number(periodDayInput)
                if (day >= 1 && day <= 28) {
                  const { start, end } = getPeriodDates(day)
                  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
                  return <p className="text-xs text-gray-400 mb-3">Período actual: <span className="font-medium text-gray-600">{fmt(start)} — {fmt(end)}</span></p>
                }
                return null
              })()}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-sm" onClick={() => setShowPeriodConfig(false)}>Cancelar</Button>
                <Button
                  className="flex-1 text-sm bg-primary-600 hover:bg-primary-700 text-white"
                  onClick={() => applyPeriodDay(Number(periodDayInput))}
                  disabled={Number(periodDayInput) < 1 || Number(periodDayInput) > 28}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setShowCatManager(true)} className="text-gray-500 border-dashed text-xs gap-1">
            <Settings2 className="w-3.5 h-3.5" /> Categorías
          </Button>
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
          value={formatCurrency(summary?.total_income || 0, currency)}
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          loading={loadingSummary}
        />
        <StatsCard
          title="Total egresos"
          value={formatCurrency(summary?.total_expenses || 0, currency)}
          icon={<TrendingDown className="w-5 h-5 text-red-500" />}
          loading={loadingSummary}
        />
        <StatsCard
          title="Balance neto"
          value={formatCurrency(summary?.net || 0, currency)}
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
                  <p className="text-xs font-semibold text-green-600">{formatCurrency(data.income, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Egresos</p>
                  <p className="text-xs font-semibold text-red-500">{formatCurrency(data.expenses, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Neto</p>
                  <p className={`text-xs font-semibold ${data.net >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                    {formatCurrency(data.net, currency)}
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
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
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
                <TableHead>Cliente</TableHead>
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
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : filteredList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-gray-500 text-xs whitespace-nowrap">{p.payment_date}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">
                          {p.description || p.instructor_name || '—'}
                        </p>
                        {p.description && p.instructor_name && (
                          <p className="text-xs text-gray-500">{p.instructor_name}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{p.client_name || <span className="text-gray-400 text-xs">—</span>}</TableCell>
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
                        {p.type === 'expense' ? '-' : '+'}{formatCurrency(p.amount, currency)}
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
                  <TableCell colSpan={8} className="text-center text-gray-400 text-sm py-10">
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
          <PaymentForm type="income" spaces={spacesList} customCats={customCats.income} hiddenKeys={customCats.hidden?.income ?? []} onClose={() => { setShowIncome(false); invalidate() }} />
        </DialogContent>
      </Dialog>

      {/* Expense modal */}
      <Dialog open={showExpense} onOpenChange={setShowExpense}>
        <DialogContent title="Registrar egreso">
          <PaymentForm type="expense" spaces={spacesList} customCats={customCats.expense} hiddenKeys={customCats.hidden?.expense ?? []} onClose={() => { setShowExpense(false); invalidate() }} />
        </DialogContent>
      </Dialog>

      {/* Modal: gestionar categorías */}
      <Dialog open={showCatManager} onOpenChange={setShowCatManager}>
        <DialogContent title="Gestionar categorías">
          <div className="space-y-5 py-2">
            {(['income', 'expense'] as const).map(t => {
              const list = t === 'income' ? customCats.income : customCats.expense
              const builtIn = t === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
              const hiddenKeys: string[] = customCats.hidden?.[t] ?? []
              return (
                <div key={t}>
                  <p className="text-sm font-semibold text-gray-700 mb-2">{t === 'income' ? 'Ingresos' : 'Egresos'}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {builtIn.map(([key, label]) => {
                      const isHidden = hiddenKeys.includes(key)
                      return (
                        <span
                          key={key}
                          className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${isHidden ? 'bg-red-50 text-red-400 line-through' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {label}
                          <button
                            title={isHidden ? 'Restaurar' : 'Ocultar'}
                            onClick={() => isHidden
                              ? showCatMutation.mutate({ type: t, key })
                              : hideCatMutation.mutate({ type: t, key })
                            }
                            className={`ml-0.5 text-xs leading-none ${isHidden ? 'hover:text-green-600' : 'hover:text-red-500'}`}
                          >
                            {isHidden ? '↩' : '×'}
                          </button>
                        </span>
                      )
                    })}
                    {list.map(label => (
                      <span key={label} className="text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-700 flex items-center gap-1">
                        {label}
                        <button
                          onClick={() => deleteCatMutation.mutate({ type: t, label })}
                          className="hover:text-red-500 ml-0.5"
                        >×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Agregar categoría</p>
              <div className="flex gap-2">
                <select
                  value={newCatType}
                  onChange={e => setNewCatType(e.target.value as 'income' | 'expense')}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="income">Ingreso</option>
                  <option value="expense">Egreso</option>
                </select>
                <Input
                  placeholder="Nombre de la categoría"
                  value={newCatLabel}
                  onChange={e => setNewCatLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newCatLabel.trim()) {
                      addCatMutation.mutate({ type: newCatType, label: newCatLabel.trim() })
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => { if (newCatLabel.trim()) addCatMutation.mutate({ type: newCatType, label: newCatLabel.trim() }) }}
                  disabled={!newCatLabel.trim() || addCatMutation.isPending}
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400">Presiona × en una categoría predeterminada para ocultarla. Usa ↩ para restaurarla.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

function PaymentForm({ type, spaces, customCats = [], hiddenKeys = [], onClose }: { type: 'income' | 'expense'; spaces: Space[]; customCats?: string[]; hiddenKeys?: string[]; onClose: () => void }) {
  const currency = getTenantCurrency()
  const builtIn = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const categories = [
    ...builtIn.filter(([key]) => !hiddenKeys.includes(key)),
    ...customCats.map(label => [label, label] as [string, string]),
  ]
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
    client_id: '',
    client_name_display: '',
    instructor_id: '',
  })
  const [loading, setLoading] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (clientSearchRef.current) clearTimeout(clientSearchRef.current)
    clientSearchRef.current = setTimeout(() => setDebouncedSearch(clientSearch), 300)
    return () => { if (clientSearchRef.current) clearTimeout(clientSearchRef.current) }
  }, [clientSearch])

  const { data: clientResults } = useQuery<PaginatedResponse<Client>>({
    queryKey: ['clients-search-caja', debouncedSearch],
    queryFn: () => clientsApi.list({ search: debouncedSearch, limit: 8 }),
    enabled: debouncedSearch.length >= 2,
  })

  const { data: instructorList = [] } = useQuery<Instructor[]>({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.list(),
    enabled: type === 'expense',
  })

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) { setForm((f) => ({ ...f, amountDisplay: '' })); return }
    const formatted = new Intl.NumberFormat(getCurrencyLocale(currency)).format(parseInt(digits, 10))
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
        client_id: form.client_id || undefined,
        instructor_id: form.instructor_id || undefined,
      } as any)
      toast.success(type === 'income' ? 'Ingreso registrado' : 'Egreso registrado')
      onClose()
    } catch {
      toast.error('Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  const isNomina = form.category === 'nomina_instructores'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monto ({currency}) *</label>
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

      {/* Cliente opcional — solo para ingresos */}
      {type === 'income' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente <span className="text-gray-400 font-normal">(opcional)</span></label>
          {form.client_id ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
              <span className="flex-1 truncate">{form.client_name_display}</span>
              <button type="button" className="text-emerald-500 hover:text-emerald-700 text-xs" onClick={() => setForm(f => ({ ...f, client_id: '', client_name_display: '' }))}>✕</button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Buscar cliente por nombre..."
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true) }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
              />
              {showClientDropdown && (clientResults?.items?.length ?? 0) > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {clientResults?.items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                      onMouseDown={() => {
                        setForm(f => ({ ...f, client_id: c.id, client_name_display: c.full_name }))
                        setClientSearch('')
                        setShowClientDropdown(false)
                      }}
                    >
                      {c.full_name}
                      {c.phone && <span className="text-gray-400 ml-2 text-xs">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructor opcional — solo para egresos de nómina */}
      {type === 'expense' && isNomina && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instructor <span className="text-gray-400 font-normal">(opcional)</span></label>
          <select
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={form.instructor_id}
            onChange={f('instructor_id')}
          >
            <option value="">Sin instructor específico</option>
            {instructorList.filter(ins => ins.is_active).map((ins) => (
              <option key={ins.id} value={ins.id}>{ins.full_name}</option>
            ))}
          </select>
        </div>
      )}

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
