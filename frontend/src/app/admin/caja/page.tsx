'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payments } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatsCard } from '@/components/admin/stats-card'
import { formatCOP, categoryLabels, paymentMethodLabels } from '@/lib/utils'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { DollarSign, TrendingUp, TrendingDown, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

export default function CajaPage() {
  const today = new Date()
  const [startDate, setStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'))
  const [showIncome, setShowIncome] = useState(false)
  const [showExpense, setShowExpense] = useState(false)
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => payments.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['payment-summary'] })
      toast.success('Registro eliminado')
    },
  })

  const chartData = summary
    ? Object.entries(summary.by_category || {}).map(([key, val]) => ({
        name: categoryLabels[key] || key,
        value: Number(val),
      }))
    : []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payments'] })
    qc.invalidateQueries({ queryKey: ['payment-summary'] })
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
          <Button onClick={() => setShowIncome(true)}>
            <Plus className="w-4 h-4" /> Ingreso
          </Button>
          <Button variant="outline" onClick={() => setShowExpense(true)}>
            <Plus className="w-4 h-4" /> Egreso
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                    </TableRow>
                  ))
                : paymentList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-gray-500 text-xs whitespace-nowrap">{p.payment_date}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{p.description || '—'}</p>
                        {p.client_name && <p className="text-xs text-gray-500">{p.client_name}</p>}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">{categoryLabels[p.category] || p.category}</TableCell>
                      <TableCell className="text-xs text-gray-600">{paymentMethodLabels[p.payment_method] || p.payment_method}</TableCell>
                      <TableCell className={`text-right font-semibold ${p.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                        {p.type === 'expense' ? '-' : '+'}{formatCOP(p.amount)}
                      </TableCell>
                      <TableCell>
                        <button onClick={() => deleteMutation.mutate(p.id)} className="text-gray-400 hover:text-red-500 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Income modal */}
      <Dialog open={showIncome} onOpenChange={setShowIncome}>
        <DialogContent title="Registrar ingreso">
          <PaymentForm type="income" onClose={() => { setShowIncome(false); invalidate() }} />
        </DialogContent>
      </Dialog>

      {/* Expense modal */}
      <Dialog open={showExpense} onOpenChange={setShowExpense}>
        <DialogContent title="Registrar egreso">
          <PaymentForm type="expense" onClose={() => { setShowExpense(false); invalidate() }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentForm({ type, onClose }: { type: 'income' | 'expense'; onClose: () => void }) {
  const incomeCategories = [['class_fee', 'Cobro de clase'], ['membership', 'Membresía'], ['package', 'Paquete'], ['other', 'Otro']]
  const expenseCategories = [['equipment', 'Equipamiento'], ['rent', 'Arriendo'], ['salary', 'Nómina'], ['other', 'Otro']]
  const categories = type === 'income' ? incomeCategories : expenseCategories
  const methods = [['cash', 'Efectivo'], ['transfer', 'Transferencia'], ['card', 'Tarjeta'], ['nequi', 'Nequi'], ['daviplata', 'Daviplata']]

  const [form, setForm] = useState({ amount: '', category: categories[0][0], payment_method: 'cash', description: '', payment_date: format(new Date(), 'yyyy-MM-dd') })
  const [loading, setLoading] = useState(false)

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount) { toast.error('Ingresa el monto'); return }
    setLoading(true)
    try {
      await payments.create({ ...form, type, amount: String(parseFloat(form.amount)) as any })
      toast.success(type === 'income' ? 'Ingreso registrado' : 'Egreso registrado')
      onClose()
    } catch { toast.error('Error al registrar') } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monto (COP) *</label>
        <Input type="number" min="0" placeholder="120000" value={form.amount} onChange={f('amount')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <select className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm" value={form.category} onChange={f('category')}>
            {categories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
          <select className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm" value={form.payment_method} onChange={f('payment_method')}>
            {methods.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <Input placeholder="Descripción del pago..." value={form.description} onChange={f('description')} />
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
