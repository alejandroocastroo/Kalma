'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { classTypes } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCOP } from '@/lib/utils'
import { Plus, Clock, Users, DollarSign, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ClassType } from '@/types'

export default function ClasesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ClassType | null>(null)
  const qc = useQueryClient()

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['class-types'],
    queryFn: classTypes.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => classTypes.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['class-types'] }); toast.success('Clase desactivada') },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="w-4 h-4" /> Nueva clase
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {types.map((ct) => (
            <div key={ct.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ct.color }} />
                  <h3 className="font-semibold text-gray-900">{ct.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(ct); setShowForm(true) }} className="p-1.5 text-gray-400 hover:text-primary-600 transition rounded-lg hover:bg-primary-50">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(ct.id)} title="Desactivar clase" className="p-1.5 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 text-xs flex items-center gap-1">
                    <Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Desactivar</span>
                  </button>
                </div>
              </div>

              {ct.description && <p className="text-sm text-gray-500 mb-4 line-clamp-2">{ct.description}</p>}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />{ct.duration_minutes} minutos
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4 text-gray-400" />Capacidad: {ct.capacity} personas
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <DollarSign className="w-4 h-4 text-green-600" />{formatCOP(ct.price)}
                </div>
              </div>

              <div className="mt-4">
                <Badge variant={ct.is_active ? 'success' : 'secondary'}>
                  {ct.is_active ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent title={editing ? 'Editar clase' : 'Nueva clase'}>
          <ClassTypeForm
            initial={editing}
            onClose={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['class-types'] }) }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClassTypeForm({ initial, onClose }: { initial: ClassType | null; onClose: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    duration_minutes: String(initial?.duration_minutes || 60),
    capacity: String(initial?.capacity || 10),
    price: String(initial?.price || ''),
    color: initial?.color || '#6366f1',
  })
  const [loading, setLoading] = useState(false)
  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.price) { toast.error('Nombre y precio son requeridos'); return }
    setLoading(true)
    try {
      const data = { ...form, duration_minutes: parseInt(form.duration_minutes), capacity: parseInt(form.capacity), price: parseFloat(form.price) }
      if (initial) { await classTypes.update(initial.id, data) } else { await classTypes.create(data as any) }
      toast.success(initial ? 'Clase actualizada' : 'Clase creada')
      onClose()
    } catch { toast.error('Error al guardar') } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
        <Input placeholder="Reformer Pilates" value={form.name} onChange={f('name')} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm resize-none" rows={3} placeholder="Describe la clase..." value={form.description} onChange={f('description')} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duración (min)</label>
          <Input type="number" min="15" value={form.duration_minutes} onChange={f('duration_minutes')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
          <Input type="number" min="1" value={form.capacity} onChange={f('capacity')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
          <input type="color" className="w-full h-[42px] rounded-xl border border-gray-300 cursor-pointer px-1" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Precio (COP) *</label>
        <Input type="number" min="0" placeholder="120000" value={form.price} onChange={f('price')} />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : initial ? 'Actualizar' : 'Crear'}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  )
}
