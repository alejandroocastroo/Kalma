'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clients, appointments as appointmentsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { getInitials, formatDate, formatTime, appointmentStatusConfig } from '@/lib/utils'
import { Search, Plus, ChevronLeft, ChevronRight, Phone, Mail, Edit, Cake, MessageSquare, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Client } from '@/types'

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function formatBirthDate(birth_date: string): string {
  const [, m, d] = birth_date.split('-')
  return `${parseInt(d)} de ${MONTHS_ES[parseInt(m) - 1]}`
}

export default function ClientesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [editMode, setEditMode] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, page, statusFilter],
    queryFn: () => clients.list({
      search,
      page,
      limit: 15,
      is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
    }),
  })

  const { data: birthdayClients = [] } = useQuery({
    queryKey: ['clients-birthdays'],
    queryFn: () => clients.birthdays(),
  })

  const { data: clientAppointments = [], refetch: refetchAppts } = useQuery({
    queryKey: ['client-appointments', selected?.id],
    queryFn: () => clients.appointments(selected!.id),
    enabled: !!selected,
  })

  const saveNoteMutation = useMutation({
    mutationFn: ({ apptId, notes }: { apptId: string; notes: string }) =>
      appointmentsApi.update(apptId, { notes: notes || undefined }),
    onSuccess: () => refetchAppts(),
    onError: () => toast.error('No se pudo guardar la nota'),
  })

  return (
    <div className="space-y-4">
      {/* Birthday section */}
      {birthdayClients.length > 0 && (
        <BirthdaySection clients={birthdayClients} />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          {(['active', 'inactive', 'all'] as const).map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s === 'active' ? 'Activos' : s === 'inactive' ? 'Inactivos' : 'Todos'}
            </button>
          ))}
        </div>
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
              <TableHead>Membresía</TableHead>
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
                      {client.active_plan_name ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5">
                          {client.active_plan_name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sin plan</span>
                      )}
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

                {selected.birth_date && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Cake className="w-4 h-4 text-gray-400" />
                    <span>{formatBirthDate(selected.birth_date)}</span>
                  </div>
                )}
              </div>

              {selected.notes && (
                <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-xs text-amber-600 font-semibold mb-1">Observaciones</p>
                  <p className="text-sm text-amber-800 leading-relaxed">{selected.notes}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Historial de citas</p>
                {clientAppointments.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin citas registradas</p>
                ) : (
                  <div className="space-y-1">
                    {clientAppointments.map((appt: any) => (
                      <AppointmentRow
                        key={appt.id}
                        appt={appt}
                        onSaveNote={(notes) => saveNoteMutation.mutate({ apptId: appt.id, notes })}
                      />
                    ))}
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
            onClose={() => { setShowForm(false); setEditMode(false); qc.invalidateQueries({ queryKey: ['clients'] }); qc.invalidateQueries({ queryKey: ['clients-birthdays'] }) }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AppointmentRow({ appt, onSaveNote }: { appt: any; onSaveNote: (notes: string) => void }) {
  const cfg = appointmentStatusConfig[appt.status]
  const dateStr = appt.session_start ? formatDate(appt.session_start) : '—'
  const timeStr = appt.session_start ? formatTime(appt.session_start) : ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(appt.notes || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleOpen = () => {
    setDraft(appt.notes || '')
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleSave = () => {
    onSaveNote(draft.trim())
    setEditing(false)
  }

  const handleCancel = () => {
    setDraft(appt.notes || '')
    setEditing(false)
  }

  return (
    <div className="py-2 border-b border-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{appt.class_type_name || '—'}</p>
          <p className="text-xs text-gray-500">
            {dateStr}{timeStr ? ` · ${timeStr}` : ''}
            {appt.space_name ? <span className="ml-1 text-gray-400">· {appt.space_name}</span> : null}
          </p>
          {!editing && appt.notes && (
            <p className="mt-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 leading-relaxed">{appt.notes}</p>
          )}
          {editing && (
            <div className="mt-2 flex flex-col gap-1.5">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Ej: Avisó que asistiría pero no canceló a tiempo..."
                rows={2}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <div className="flex gap-1.5">
                <button onClick={handleSave} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary-600 text-white hover:bg-primary-700">
                  <Check className="w-3 h-3" /> Guardar
                </button>
                <button onClick={handleCancel} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                  <X className="w-3 h-3" /> Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg?.className}`}>
            {cfg?.label}
          </span>
          {!editing && (
            <button
              onClick={handleOpen}
              title={appt.notes ? 'Editar nota' : 'Agregar nota'}
              className={`p-1 rounded-lg transition-colors ${appt.notes ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function BirthdaySection({ clients: list }: { clients: Client[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const todayMonth = today.getMonth() + 1
  const todayDay = today.getDate()

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' })
  }

  return (
    <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl border border-pink-100 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cake className="w-4 h-4 text-pink-500" />
          <h3 className="text-sm font-semibold text-gray-700">Próximos cumpleaños</h3>
          <span className="text-xs bg-pink-100 text-pink-700 font-semibold px-2 py-0.5 rounded-full">{list.length}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-lg hover:bg-pink-100 text-gray-400 hover:text-pink-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-lg hover:bg-pink-100 text-gray-400 hover:text-pink-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {list.map((client) => {
          const [, mStr, dStr] = client.birth_date!.split('-')
          const month = parseInt(mStr)
          const day = parseInt(dStr)
          const isCurrentMonth = month === todayMonth
          const isToday = isCurrentMonth && day === todayDay
          const isPast = isCurrentMonth && day < todayDay
          return (
            <div
              key={client.id}
              style={{ scrollSnapAlign: 'start' }}
              className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border min-w-[84px] transition-colors ${
                isToday ? 'bg-pink-100 border-pink-300' : 'bg-white border-gray-100'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                isToday ? 'bg-pink-500 text-white' : 'bg-primary-100 text-primary-700'
              }`}>
                {getInitials(client.full_name)}
              </div>
              <p className="text-xs font-medium text-gray-800 text-center leading-tight">
                {client.full_name.split(' ')[0]}
              </p>
              <p className={`text-xs font-semibold text-center ${
                isToday ? 'text-pink-600' : isPast ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {isToday ? '¡Hoy! 🎂' : `${day} de ${MONTHS_ES[month - 1]}`}
              </p>
            </div>
          )
        })}
      </div>
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
    birth_date: initial?.birth_date || '',
    notes: initial?.notes || '',
    is_active: initial?.is_active ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [docError, setDocError] = useState('')
  const [dupeWarning, setDupeWarning] = useState<string | null>(null)

  const buildPayload = () => ({
    ...form,
    birth_date: form.birth_date || undefined,
    notes: form.notes || null,
  })

  const doCreate = async () => {
    setLoading(true)
    try {
      await clients.create(buildPayload())
      toast.success('Cliente creado')
      onClose()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (err?.response?.status === 409) {
        setDocError(typeof detail === 'string' ? detail : 'Ya existe un cliente con ese número de documento')
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Error al guardar')
      }
    } finally { setLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name) { toast.error('El nombre es requerido'); return }

    // Validación de cédula: mínimo 5 dígitos si se ingresa
    if (form.document_number) {
      const digits = form.document_number.replace(/\D/g, '')
      if (digits.length < 5) {
        setDocError('El número de documento debe tener al menos 5 dígitos')
        return
      }
    }
    setDocError('')

    setLoading(true)
    try {
      if (clientId) {
        await clients.update(clientId, { ...buildPayload(), is_active: form.is_active })
        toast.success('Cliente actualizado')
        onClose()
      } else {
        // Advertencia de nombre duplicado cuando no hay documento
        if (!form.document_number) {
          const existing = await clients.list({ search: form.full_name, limit: 20 })
          const exactMatch = existing.items.find(c =>
            c.full_name.toLowerCase().trim() === form.full_name.toLowerCase().trim()
          )
          if (exactMatch) {
            setDupeWarning(form.full_name)
            setLoading(false)
            return
          }
        }
        // doCreate manages its own loading state
        setLoading(false)
        await doCreate()
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (err?.response?.status === 409) {
        setDocError(typeof detail === 'string' ? detail : 'Ya existe un cliente con ese número de documento')
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Error al guardar')
      }
      setLoading(false)
    }
  }

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [field]: e.target.value })
    if (field === 'document_number') setDocError('')
  }

  return (
    <>
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
            <Input
              placeholder="1234567890"
              value={form.document_number}
              onChange={f('document_number')}
              className={docError ? 'border-red-400 focus-visible:ring-red-400' : ''}
            />
            {docError && <p className="mt-1 text-xs text-red-500">{docError}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento <span className="text-gray-400 font-normal">(opcional)</span></label>
          <Input type="date" value={form.birth_date} onChange={f('birth_date')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones <span className="text-gray-400 font-normal">(lesiones, cirugías, restricciones)</span></label>
          <textarea
            value={form.notes}
            onChange={f('notes')}
            placeholder="Ej: operada de rodilla derecha, no puede hacer flexiones de cadera completas..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        {clientId && (
          <div className="flex items-center gap-3">
            <input id="is_active" type="checkbox" checked={form.is_active ?? true}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 accent-primary-600" />
            <label htmlFor="is_active" className="text-sm text-gray-700">Cliente activo</label>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : clientId ? 'Actualizar' : 'Crear cliente'}</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </form>

      <Dialog open={!!dupeWarning} onOpenChange={() => setDupeWarning(null)}>
        <DialogContent title="Nombre duplicado">
          <p className="text-sm text-gray-700">
            Ya existe un cliente llamado <strong>{dupeWarning}</strong>. Si son personas distintas, puedes agregar el número de documento para diferenciarlos.
          </p>
          <div className="flex gap-2 mt-4">
            <Button onClick={async () => { setDupeWarning(null); await doCreate() }}>
              Continuar de todas formas
            </Button>
            <Button variant="outline" onClick={() => setDupeWarning(null)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
