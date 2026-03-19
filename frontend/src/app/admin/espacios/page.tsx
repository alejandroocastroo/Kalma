'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { spaces } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCOP } from '@/lib/utils'
import { Plus, Users, DollarSign, Edit, Trash2, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Space } from '@/types'

export default function EspaciosPage() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Space | null>(null)
  const qc = useQueryClient()

  const { data: spaceList = [], isLoading } = useQuery({
    queryKey: ['spaces'],
    queryFn: spaces.list,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => spaces.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] })
      toast.success('Espacio desactivado')
    },
    onError: () => toast.error('Error al desactivar espacio'),
  })

  const handleEdit = (space: Space) => {
    setEditing(space)
    setShowForm(true)
  }

  const handleCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    qc.invalidateQueries({ queryKey: ['spaces'] })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4" /> Nuevo espacio
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : spaceList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-primary-600" />
          </div>
          <p className="text-gray-500 text-sm">No hay espacios creados aún.</p>
          <button
            onClick={handleCreate}
            className="mt-3 text-sm text-primary-600 hover:underline font-medium"
          >
            Crear el primer espacio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {spaceList.map((space) => (
            <div key={space.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{space.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(space)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 transition rounded-lg hover:bg-primary-50"
                    title="Editar espacio"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(space.id)}
                    disabled={deleteMutation.isPending}
                    title="Desactivar espacio"
                    className="p-1.5 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Desactivar</span>
                  </button>
                </div>
              </div>

              {space.description && (
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{space.description}</p>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4 text-gray-400" />
                  Capacidad: {space.capacity} personas
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  {formatCOP(space.price)}
                </div>
              </div>

              <div className="mt-4">
                <Badge variant={space.is_active ? 'success' : 'secondary'}>
                  {space.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent title={editing ? 'Editar espacio' : 'Nuevo espacio'}>
          <SpaceForm initial={editing} onClose={handleClose} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SpaceForm({ initial, onClose }: { initial: Space | null; onClose: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    capacity: String(initial?.capacity || 10),
    price: String(initial?.price || ''),
  })
  const [loading, setLoading] = useState(false)

  const f =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.price) {
      toast.error('Nombre y precio son requeridos')
      return
    }
    setLoading(true)
    try {
      const data = {
        name: form.name,
        description: form.description || undefined,
        capacity: parseInt(form.capacity),
        price: parseFloat(form.price),
        currency: 'COP',
      }
      if (initial) {
        await spaces.update(initial.id, data)
        toast.success('Espacio actualizado')
      } else {
        await spaces.create(data)
        toast.success('Espacio creado')
      }
      onClose()
    } catch {
      toast.error('Error al guardar espacio')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
        <Input placeholder="Sala Pilates" value={form.name} onChange={f('name')} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={3}
          placeholder="Describe el espacio..."
          value={form.description}
          onChange={f('description')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
          <Input type="number" min="1" value={form.capacity} onChange={f('capacity')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Precio (COP) *</label>
          <Input type="number" min="0" placeholder="120000" value={form.price} onChange={f('price')} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
        <Input value="COP" disabled className="bg-gray-50 text-gray-500 cursor-not-allowed" />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : initial ? 'Actualizar' : 'Crear'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
