'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Calendar, DollarSign, X } from 'lucide-react'
import { plans as plansApi, spaces as spacesApi } from '@/lib/api'
import type { Plan, SpaceQuota, MembershipType } from '@/types'
import { formatCurrency, getCurrencyLocale, getApiErrorMessage } from '@/lib/utils'
import { getTenantCurrency } from '@/lib/auth'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const HYBRID_TYPES: MembershipType[] = ['hybrid_fixed', 'hybrid_monthly']
const SESSION_TYPES: MembershipType[] = ['session_based', 'weekly_sessions']

const PLAN_TYPE_OPTIONS = [
  { value: 'monthly', label: 'Mensualidad fija', desc: 'Vence el mismo día cada mes, sin límite de sesiones' },
  { value: 'session_based', label: 'Sesiones semanales días fijos', desc: 'Vence al agotar las sesiones en días seleccionados' },
  { value: 'weekly_sessions', label: 'Sesiones semanales mes a mes', desc: 'X sesiones/semana, se renueva mes a mes sin días fijos' },
  { value: 'hybrid_fixed', label: 'Híbrido con días fijos', desc: 'Cubre 2+ espacios con días seleccionados por espacio. Vence al agotar sesiones.' },
  { value: 'hybrid_monthly', label: 'Híbrido mes a mes', desc: 'Cubre 2+ espacios sin días fijos. Se renueva mensualmente.' },
] as const

function membershipTypeLabel(plan: Plan): string {
  if (plan.membership_type === 'hybrid_fixed') return 'Híbrido días fijos'
  if (plan.membership_type === 'hybrid_monthly') return 'Híbrido mes a mes'
  if (plan.membership_type === 'session_based') return `${plan.sessions_per_week ?? plan.classes_per_week}x sem (paquete)`
  if (plan.membership_type === 'weekly_sessions') return `${plan.sessions_per_week ?? plan.classes_per_week}x sem (semanal)`
  return 'Mensualidad'
}

export default function PlanesPage() {
  const qc = useQueryClient()
  const currency = getTenantCurrency()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    price_cop: '',
    classes_per_week: '3',
    is_active: true,
    membership_type: 'monthly' as MembershipType,
    sessions_per_week: '3',
    space_id: '',
    space_quotas: [{ space_id: '', sessions_per_week: 2 }, { space_id: '', sessions_per_week: 2 }] as { space_id: string; sessions_per_week: number }[],
  })

  const { data: plansList, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: plansApi.list,
  })

  const { data: spacesList = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.list,
  })

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Plan>) =>
      editing ? plansApi.update(editing.id, data) : plansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast.success(editing ? 'Plan actualizado' : 'Plan creado')
      setDialogOpen(false)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al guardar el plan')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => plansApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast.success('Plan eliminado')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Error al eliminar')),
  })

  const isHybrid = HYBRID_TYPES.includes(form.membership_type)
  const isSessionType = SESSION_TYPES.includes(form.membership_type)

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', price_cop: '', classes_per_week: '3', is_active: true, membership_type: 'monthly', sessions_per_week: '3', space_id: '', space_quotas: [{ space_id: '', sessions_per_week: 2 }, { space_id: '', sessions_per_week: 2 }] })
    setDialogOpen(true)
  }

  function openEdit(plan: Plan) {
    setEditing(plan)
    setForm({
      name: plan.name,
      description: plan.description || '',
      price_cop: plan.price_cop ? new Intl.NumberFormat(getCurrencyLocale(currency)).format(plan.price_cop) : '',
      classes_per_week: String(plan.classes_per_week),
      is_active: plan.is_active,
      membership_type: (plan.membership_type || 'monthly') as MembershipType,
      sessions_per_week: plan.sessions_per_week ? String(plan.sessions_per_week) : '3',
      space_id: plan.space_id || '',
      space_quotas: plan.space_quotas?.map(q => ({ space_id: q.space_id, sessions_per_week: q.sessions_per_week })) || [{ space_id: '', sessions_per_week: 2 }, { space_id: '', sessions_per_week: 2 }],
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.name.trim() || !form.price_cop) {
      toast.error('Completa todos los campos requeridos')
      return
    }

    if (isHybrid) {
      if (form.space_quotas.length < 2) {
        toast.error('Un plan híbrido requiere al menos 2 espacios')
        return
      }
      const hasEmpty = form.space_quotas.some(q => !q.space_id)
      if (hasEmpty) {
        toast.error('Selecciona un espacio para cada entrada del plan híbrido')
        return
      }
      const ids = form.space_quotas.map(q => q.space_id)
      if (new Set(ids).size !== ids.length) {
        toast.error('No puedes repetir el mismo espacio en el plan')
        return
      }
      saveMutation.mutate({
        name: form.name.trim(),
        description: form.description || undefined,
        price_cop: parseInt(form.price_cop.replace(/\D/g, ''), 10) || 0,
        classes_per_week: form.space_quotas.reduce((s, q) => s + q.sessions_per_week, 0),
        is_active: form.is_active,
        membership_type: form.membership_type,
        space_quotas: form.space_quotas as SpaceQuota[],
      } as any)
      return
    }

    const spw = isSessionType ? Number(form.sessions_per_week) : null
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description || undefined,
      price_cop: parseInt(form.price_cop.replace(/\D/g, ''), 10) || 0,
      classes_per_week: spw ?? Number(form.classes_per_week),
      is_active: form.is_active,
      membership_type: form.membership_type,
      sessions_per_week: spw,
      space_id: form.space_id || null,
    })
  }

  const hybridTotal = form.space_quotas.reduce((s, q) => s + q.sessions_per_week, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mt-1">Configura los planes de membresía mensual</p>
        </div>
        <Button onClick={openCreate} className="bg-primary-600 hover:bg-primary-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Nuevo Plan
        </Button>
      </div>

      {/* Plans grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : !plansList?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-400">No hay planes creados aún</p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
            <Plus className="w-4 h-4" /> Crear primer plan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {plansList.map(plan => (
            <div key={plan.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
                <Badge variant={plan.is_active ? 'success' : 'secondary'}>
                  {plan.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {HYBRID_TYPES.includes(plan.membership_type as MembershipType)
                  ? plan.space_quotas?.map(q => {
                      const s = (spacesList as any[]).find((sp: any) => sp.id === q.space_id)
                      return s ? (
                        <span key={q.space_id} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {s.name} {q.sessions_per_week}x
                        </span>
                      ) : null
                    })
                  : plan.space_name && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{plan.space_name}</span>
                    )
                }
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {membershipTypeLabel(plan)}
                </span>
              </div>
              {plan.description && <p className="text-sm text-gray-500">{plan.description}</p>}
              <div className="flex items-center gap-4 text-sm text-gray-700">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-primary-600" />
                  {plan.classes_per_week} clases/sem
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  {formatCurrency(plan.price_cop, currency)}
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => openEdit(plan)} className="gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => { if (confirm(`¿Eliminar plan "${plan.name}"?`)) deleteMutation.mutate(plan.id) }}
                  className="gap-1.5 text-red-600 hover:text-red-700 hover:border-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false) }}>
        <DialogContent title={editing ? 'Editar Plan' : 'Nuevo Plan'}>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Nombre *</label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Plan Básico, Plan Premium..."
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descripción opcional del plan..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            {/* Tipo de plan */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Tipo *</label>
              <div className="grid grid-cols-1 gap-2">
                {PLAN_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, membership_type: opt.value as MembershipType }))}
                    className={`p-3 rounded-xl border text-left transition ${
                      form.membership_type === opt.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Precio */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Precio ({currency}) *</label>
              <CurrencyInput
                value={form.price_cop}
                onChange={v => setForm(f => ({ ...f, price_cop: v }))}
                currency={currency}
                placeholder="150.000"
              />
            </div>

            {/* Editor de espacios híbridos */}
            {isHybrid ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Espacios y visitas por semana *</label>
                {form.space_quotas.map((quota, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={quota.space_id}
                      onChange={e => {
                        const updated = [...form.space_quotas]
                        updated[idx] = { ...updated[idx], space_id: e.target.value }
                        setForm(f => ({ ...f, space_quotas: updated }))
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Seleccionar espacio...</option>
                      {spacesList.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <select
                      value={quota.sessions_per_week}
                      onChange={e => {
                        const updated = [...form.space_quotas]
                        updated[idx] = { ...updated[idx], sessions_per_week: Number(e.target.value) }
                        setForm(f => ({ ...f, space_quotas: updated }))
                      }}
                      className="w-32 px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {[1,2,3,4,5,6,7].map(n => (
                        <option key={n} value={n}>{n}x / sem</option>
                      ))}
                    </select>
                    {form.space_quotas.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, space_quotas: f.space_quotas.filter((_, i) => i !== idx) }))}
                        className="p-1.5 text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {form.space_quotas.length < spacesList.length && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, space_quotas: [...f.space_quotas, { space_id: '', sessions_per_week: 1 }] }))}
                    className="text-sm text-primary-600 hover:text-primary-800 underline"
                  >
                    + Agregar espacio
                  </button>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Total: {hybridTotal}x / semana · {hybridTotal * 4} sesiones / mes
                </p>
              </div>
            ) : (
              <>
                {/* Sesiones/semana para tipos no-híbridos */}
                {isSessionType && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Sesiones/semana *</label>
                    <select
                      value={form.sessions_per_week}
                      onChange={e => setForm(f => ({ ...f, sessions_per_week: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {['1','2','3','4','5','6','7'].map(n => (
                        <option key={n} value={n}>{n}x / sem ({Number(n) * 4} total)</option>
                      ))}
                    </select>
                  </div>
                )}
                {!isSessionType && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Clases por semana *</label>
                    <Input
                      type="number" min="1" max="7"
                      value={form.classes_per_week}
                      onChange={e => setForm(f => ({ ...f, classes_per_week: e.target.value }))}
                    />
                  </div>
                )}
                {/* Espacio único */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Espacio</label>
                  <select
                    value={form.space_id}
                    onChange={e => setForm(f => ({ ...f, space_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Sin espacio específico</option>
                    {spacesList.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Toggle activo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.is_active}
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  form.is_active ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <label className="text-sm font-medium text-gray-700">Plan activo</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
