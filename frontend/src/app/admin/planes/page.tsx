'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Calendar, DollarSign } from 'lucide-react'
import { plans as plansApi } from '@/lib/api'
import type { Plan } from '@/types'
import { formatCOP } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export default function PlanesPage() {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    price_cop: '',
    classes_per_week: '3',
    is_active: true,
  })

  const { data: plansList, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: plansApi.list,
  })

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Plan>) =>
      editing ? plansApi.update(editing.id, data) : plansApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast.success(editing ? 'Plan actualizado' : 'Plan creado')
      setDialogOpen(false)
    },
    onError: () => toast.error('Error al guardar el plan'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => plansApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] })
      toast.success('Plan eliminado')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Error al eliminar'),
  })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', price_cop: '', classes_per_week: '3', is_active: true })
    setDialogOpen(true)
  }

  function openEdit(plan: Plan) {
    setEditing(plan)
    setForm({
      name: plan.name,
      description: plan.description || '',
      price_cop: String(plan.price_cop),
      classes_per_week: String(plan.classes_per_week),
      is_active: plan.is_active,
    })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.name.trim() || !form.price_cop || !form.classes_per_week) {
      toast.error('Completa todos los campos requeridos')
      return
    }
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description || undefined,
      price_cop: Number(form.price_cop),
      classes_per_week: Number(form.classes_per_week),
      is_active: form.is_active,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mt-1">Configura los planes de membresía mensual</p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-primary-600 hover:bg-primary-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo Plan
        </Button>
      </div>

      {/* Plans grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
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
            <div
              key={plan.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
                <Badge variant={plan.is_active ? 'success' : 'secondary'}>
                  {plan.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              {plan.description && (
                <p className="text-sm text-gray-500">{plan.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-700">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-primary-600" />
                  {plan.classes_per_week} clases/sem
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  {formatCOP(plan.price_cop)}
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(plan)}
                  className="gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(`¿Eliminar plan "${plan.name}"?`)) {
                      deleteMutation.mutate(plan.id)
                    }
                  }}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Precio (COP) *</label>
                <Input
                  type="number"
                  min="0"
                  value={form.price_cop}
                  onChange={e => setForm(f => ({ ...f, price_cop: e.target.value }))}
                  placeholder="150000"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Clases por semana *</label>
                <Input
                  type="number"
                  min="1"
                  max="7"
                  value={form.classes_per_week}
                  onChange={e => setForm(f => ({ ...f, classes_per_week: e.target.value }))}
                />
              </div>
            </div>
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
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.is_active ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <label className="text-sm font-medium text-gray-700">Plan activo</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
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
