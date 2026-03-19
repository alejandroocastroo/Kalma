'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clients } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials, formatDate, appointmentStatusConfig } from '@/lib/utils'
import { Search, Plus, ChevronLeft, ChevronRight, User, Phone, Mail, Edit } from 'lucide-react'
import { toast } from 'sonner'
import type { Client } from '@/types'

export default function ClientesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [editMode, setEditMode] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, page],
    queryFn: () => clients.list({ search, page, limit: 15 }),
  })

  const { data: clientAppointments = [] } = useQuery({
    queryKey: ['client-appointments', selected?.id],
    queryFn: () => clients.appointments(selected!.id),
    enabled: !!selected,
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, email o teléfono..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Button onClick={() => { setShowForm(true); setEditMode(false) }}>
          <Plus className="w-4 h-4" /> Nuevo cliente
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Sesiones</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : data?.items.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(client)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-semibold">
                          {getInitials(client.full_name)}
                        </div>
                        <span className="font-medium text-gray-900">{client.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">{client.phone || '—'}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{client.email || '—'}</TableCell>
                    <TableCell>
                      <span className="font-medium">{client.total_sessions}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={client.is_active ? 'success' : 'secondary'}>
                        {client.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">{data.total} clientes</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm">{page} / {data.pages}</span>
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages} className="p-1 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Client detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent title={selected?.full_name || 'Cliente'} className="max-w-2xl">
          {selected && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />{selected.phone || 'Sin teléfono'}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />{selected.email || 'Sin email'}
                </div>
                <div>
                  <p className="text-gray-500">Documento</p>
                  <p className="font-medium">{selected.document_type} {selected.document_number || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total sesiones</p>
                  <p className="font-medium text-lg">{selected.total_sessions}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Historial de citas</p>
                {clientAppointments.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin citas registradas</p>
                ) : (
                  <div className="space-y-2">
                    {clientAppointments.map((appt: any) => {
                      const cfg = appointmentStatusConfig[appt.status]
                      return (
                        <div key={appt.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                          <div>
                            <p className="text-sm font-medium">{appt.class_type_name}</p>
                            <p className="text-xs text-gray-500">{appt.session_start ? formatDate(appt.session_start) : '—'}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.className}`}>
                            {cfg?.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setEditMode(true); setShowForm(true) }}>
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

      {/* Create / Edit client modal */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setEditMode(false) }}>
        <DialogContent title={editMode ? 'Editar cliente' : 'Nuevo cliente'}>
          <ClientForm
            initial={editMode ? selected : undefined}
            clientId={editMode ? selected?.id : undefined}
            onClose={() => { setShowForm(false); setEditMode(false); qc.invalidateQueries({ queryKey: ['clients'] }) }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ClientForm({ onClose, initial, clientId }: { onClose: () => void; initial?: Client | null; clientId?: string }) {
  const [form, setForm] = useState({
    full_name: initial?.full_name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    document_type: initial?.document_type || 'CC',
    document_number: initial?.document_number || '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name) { toast.error('El nombre es requerido'); return }
    setLoading(true)
    try {
      if (clientId) {
        await clients.update(clientId, form)
        toast.success('Cliente actualizado')
      } else {
        await clients.create(form)
        toast.success('Cliente creado')
      }
      onClose()
    } catch { toast.error('Error al guardar') } finally { setLoading(false) }
  }

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [field]: e.target.value })

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
        <Input placeholder="Valentina Torres" value={form.full_name} onChange={f('full_name')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <Input placeholder="+573001234567" value={form.phone} onChange={f('phone')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <Input type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={f('email')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo doc.</label>
          <select className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm" value={form.document_type} onChange={f('document_type')}>
            <option value="CC">CC</option><option value="CE">CE</option><option value="Passport">Pasaporte</option><option value="NIT">NIT</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nro. documento</label>
          <Input placeholder="12345678" value={form.document_number} onChange={f('document_number')} />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : clientId ? 'Actualizar' : 'Crear cliente'}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  )
}
