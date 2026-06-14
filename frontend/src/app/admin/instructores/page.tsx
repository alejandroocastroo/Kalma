'use client'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { instructors } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials, getApiErrorMessage } from '@/lib/utils'
import { Search, Plus, Phone, Mail, Edit, Calendar, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { Instructor, InstructorSession } from '@/types'

function formatDateTime(dt: string) {
  const d = new Date(dt)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function InstructoresPage() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Instructor | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Instructor | null>(null)
  const qc = useQueryClient()

  const { data: allInstructors = [], isLoading } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructors.list(),
  })

  const { data: sessions = [] } = useQuery({
    queryKey: ['instructor-sessions', selected?.id],
    queryFn: () => instructors.sessions(selected!.id),
    enabled: !!selected,
  })

  const filtered = search
    ? allInstructors.filter((i) =>
        i.full_name.toLowerCase().includes(search.toLowerCase()) ||
        i.email?.toLowerCase().includes(search.toLowerCase())
      )
    : allInstructors

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => { setEditTarget(null); setShowForm(true) }}>
          <Plus className="w-4 h-4" /> Nuevo instructor
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Instructor</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Clases este mes</TableHead>
              <TableHead className="text-center">Total clases</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : filtered.length === 0
              ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-gray-400">
                      {search ? 'No se encontraron instructores con ese criterio.' : 'Aún no hay instructores registrados.'}
                    </TableCell>
                  </TableRow>
                )
              : filtered.map((instructor) => (
                  <TableRow
                    key={instructor.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(instructor)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 text-xs font-semibold">
                          {getInitials(instructor.full_name)}
                        </div>
                        <span className="font-medium text-gray-900">{instructor.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">{instructor.phone || '—'}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{instructor.email || '—'}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-semibold text-gray-800">{instructor.sessions_this_month}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-gray-600">{instructor.sessions_count}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={instructor.is_active ? 'success' : 'secondary'}>
                        {instructor.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>

        {!isLoading && allInstructors.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-400">{allInstructors.length} instructor{allInstructors.length !== 1 ? 'es' : ''} en total</p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent title={selected?.full_name || 'Instructor'} className="max-w-2xl">
          {selected && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {selected.phone || 'Sin teléfono'}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {selected.email || 'Sin email'}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Este mes:</span>
                  <span className="font-semibold text-gray-900">{selected.sessions_this_month} clases</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Total histórico:</span>
                  <span className="font-semibold text-gray-900">{selected.sessions_count} clases</span>
                </div>
                <div>
                  <Badge variant={selected.is_active ? 'success' : 'secondary'}>
                    {selected.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Sesiones recientes</p>
                <SessionsList sessions={sessions} />
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => { setEditTarget(selected); setSelected(null); setShowForm(true) }}
                >
                  <Edit className="w-4 h-4" /> Editar
                </Button>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Cerrar</Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit modal */}
      <Dialog
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o)
          if (!o) setEditTarget(null)
        }}
      >
        <DialogContent title={editTarget ? 'Editar instructor' : 'Nuevo instructor'}>
          <InstructorForm
            initial={editTarget}
            onClose={() => {
              setShowForm(false)
              setEditTarget(null)
              qc.invalidateQueries({ queryKey: ['instructors'] })
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SessionsList({ sessions }: { sessions: InstructorSession[] }) {
  if (sessions.length === 0) {
    return <p className="text-gray-400 text-sm">Sin sesiones registradas aún.</p>
  }

  const statusLabel: Record<string, { label: string; className: string }> = {
    scheduled: { label: 'Programada', className: 'bg-blue-50 text-blue-700' },
    in_progress: { label: 'En curso', className: 'bg-emerald-50 text-emerald-700' },
    completed: { label: 'Completada', className: 'bg-gray-100 text-gray-600' },
    cancelled: { label: 'Cancelada', className: 'bg-red-50 text-red-600' },
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
      {sessions.map((s) => {
        const cfg = statusLabel[s.status] ?? { label: s.status, className: 'bg-gray-100 text-gray-600' }
        return (
          <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {s.class_type_name || 'Sesión'}
                {s.space_name && <span className="text-gray-400 font-normal"> · {s.space_name}</span>}
              </p>
              <p className="text-xs text-gray-500">{formatDateTime(s.start_datetime)}</p>
            </div>
            <div className="flex items-center gap-3 text-right">
              <span className="text-xs text-gray-500">{s.enrolled_count}/{s.capacity} asist.</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>{cfg.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InstructorForm({ onClose, initial }: { onClose: () => void; initial?: Instructor | null }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    full_name: initial?.full_name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    is_active: initial?.is_active ?? true,
  })
  const [loading, setLoading] = useState(false)

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) { toast.error('El nombre es requerido'); return }

    setLoading(true)
    try {
      if (isEdit) {
        await instructors.update(initial!.id, {
          full_name: form.full_name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          is_active: form.is_active,
        })
        toast.success('Instructor actualizado')
      } else {
        await instructors.create({
          full_name: form.full_name,
          email: form.email || undefined,
          phone: form.phone || undefined,
        })
        toast.success('Instructor creado')
      }
      onClose()
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Error al guardar'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
        <Input placeholder="María González" value={form.full_name} onChange={f('full_name')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <Input type="email" placeholder="instructor@estudio.com" value={form.email} onChange={f('email')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <Input placeholder="+573001234567" value={form.phone} onChange={f('phone')} />
        </div>
      </div>
      {isEdit && (
        <div className="flex items-center gap-3">
          <input
            id="is_active"
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="w-4 h-4 accent-primary-600"
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">Instructor activo</label>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear instructor'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  )
}
