'use client'
import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getInitials, formatDate } from '@/lib/utils'
import { getTenantSlug } from '@/lib/auth'
import { toast } from 'sonner'

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${parseInt(d)} de ${MONTHS_ES[parseInt(m) - 1]} ${y}`
}

function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const MEMBERSHIP_TYPE_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  session_based: 'Por sesiones',
  weekly_sessions: 'Sesiones semanales',
  hybrid_fixed: 'Híbrido fijo',
  hybrid_monthly: 'Híbrido mensual',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  attended: { label: 'Asistió', color: '#16a34a' },
  confirmed: { label: 'Confirmada', color: '#3b82f6' },
  no_show: { label: 'No asistió', color: '#ef4444' },
}

interface ClientSummaryData {
  client: {
    full_name: string
    email?: string
    phone?: string
    document_type: string
    document_number?: string
    birth_date?: string
    address?: string
    notes?: string
    is_active: boolean
  }
  membership: {
    plan_name?: string
    membership_type: string
    start_date?: string
    expiry_date?: string
    next_billing_date?: string
    billing_day?: number
    sessions_per_week?: number
    total_sessions?: number
    sessions_used: number
    bonus_sessions: number
    sessions_remaining?: number
    makeups_allowed: number
    makeups_used: number
    makeup_credits: number
    scheduled_days?: string[]
    notes?: string
  } | null
  attendance: Array<{
    status: string
    session_start?: string
    class_type_name?: string
    space_name?: string
    notes?: string
  }>
  generated_at: string
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié',
  thursday: 'Jue', friday: 'Vie', saturday: 'Sáb', sunday: 'Dom',
}

export function ClientSummaryCard({ data, onClose }: { data: ClientSummaryData; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      link.download = `resumen-${data.client.full_name.replace(/\s+/g, '-').toLowerCase()}.png`
      link.href = dataUrl
      link.click()
      toast.success('Imagen descargada')
    } catch {
      toast.error('No se pudo generar la imagen')
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = () => {
    const el = cardRef.current
    if (!el) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>Resumen - ${data.client.full_name}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        @page { margin: 10mm; }
      </style></head>
      <body>${el.outerHTML}</body></html>
    `)
    w.document.close()
    w.focus()
    w.print()
    w.close()
  }

  const { client, membership, attendance } = data
  const attended = attendance.filter(a => a.status === 'attended')
  const hideExpiryInfo = getTenantSlug() === 'reco-pilates-pedregal'

  return (
    <div className="flex flex-col gap-4">
      {/* Action buttons */}
      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
        <Button size="sm" onClick={handleDownload} disabled={downloading}>
          <Download className="w-4 h-4" />
          {downloading ? 'Generando...' : 'Descargar imagen'}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
      </div>

      {/* Printable card */}
      <div
        ref={cardRef}
        className="bg-white rounded-2xl overflow-hidden shadow-md"
        style={{ width: 640, fontFamily: "'Inter', -apple-system, sans-serif" }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #4338ca 0%, #312e81 100%)',
            padding: '28px 32px 24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: '#c7d2fe', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                Reporte de Progreso
              </p>
              <h1 style={{ color: '#ffffff', fontSize: 26, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
                {client.full_name}
              </h1>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 18, fontWeight: 700, marginLeft: 'auto',
                }}
              >
                {getInitials(client.full_name)}
              </div>
              <p style={{ color: '#a5b4fc', fontSize: 11, marginTop: 6 }}>
                {fmtDate(data.generated_at)}
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Client info + Membership side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Client info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Datos del cliente
              </p>
              {client.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                  <span style={{ color: '#9ca3af' }}>📞</span> {client.phone}
                </div>
              )}
              {client.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                  <span style={{ color: '#9ca3af' }}>✉️</span> {client.email}
                </div>
              )}
              {client.document_number && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                  <span style={{ color: '#9ca3af' }}>🪪</span> {client.document_type} {client.document_number}
                </div>
              )}
              {client.birth_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                  <span style={{ color: '#9ca3af' }}>🎂</span> {fmtDate(client.birth_date)}
                </div>
              )}
              {client.address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                  <span style={{ color: '#9ca3af' }}>📍</span> {client.address}
                </div>
              )}
              {client.notes && (
                <div style={{ marginTop: 4, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 2 }}>Observaciones</p>
                  <p style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>{client.notes}</p>
                </div>
              )}
            </div>

            {/* Membership */}
            {membership ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 18px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Membresía activa
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#14532d', marginBottom: 2 }}>
                  {membership.plan_name || 'Plan'}
                </p>
                <p style={{ fontSize: 12, color: '#166534', marginBottom: 12 }}>
                  {MEMBERSHIP_TYPE_LABELS[membership.membership_type] || membership.membership_type}
                </p>

                {/* Session progress */}
                {membership.total_sessions != null && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#166534' }}>Clases usadas</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#14532d' }}>
                        {membership.sessions_used} / {membership.total_sessions + membership.bonus_sessions}
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#dcfce7', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: '#16a34a',
                          borderRadius: 99,
                          width: `${Math.min(100, (membership.sessions_used / (membership.total_sessions + membership.bonus_sessions)) * 100)}%`,
                        }}
                      />
                    </div>
                    {membership.sessions_remaining != null && (
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginTop: 6 }}>
                        {membership.sessions_remaining} clase{membership.sessions_remaining !== 1 ? 's' : ''} restante{membership.sessions_remaining !== 1 ? 's' : ''}
                        {membership.bonus_sessions > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 400, color: '#16a34a' }}> (+{membership.bonus_sessions} bono)</span>
                        )}
                      </p>
                    )}
                  </div>
                )}

                {/* Dates */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {membership.next_billing_date && !hideExpiryInfo && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#166534' }}>Próximo pago</span>
                      <span style={{ fontWeight: 600, color: '#14532d' }}>{fmtShortDate(membership.next_billing_date)}</span>
                    </div>
                  )}
                  {membership.expiry_date && !hideExpiryInfo && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#166534' }}>Vence</span>
                      <span style={{ fontWeight: 600, color: '#14532d' }}>{fmtShortDate(membership.expiry_date)}</span>
                    </div>
                  )}
                  {membership.start_date && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#166534' }}>Inicio</span>
                      <span style={{ fontWeight: 600, color: '#14532d' }}>{fmtShortDate(membership.start_date)}</span>
                    </div>
                  )}
                  {membership.makeups_used > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#166534' }}>Reposiciones</span>
                      <span style={{ fontWeight: 600, color: '#14532d' }}>{membership.makeups_used}/{membership.makeups_allowed}</span>
                    </div>
                  )}
                  {membership.scheduled_days && membership.scheduled_days.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
                      <span style={{ color: '#166534' }}>Días</span>
                      <span style={{ fontWeight: 600, color: '#14532d' }}>
                        {membership.scheduled_days.map(d => DAY_LABELS[d] || d).join(' · ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>Sin membresía activa</p>
              </div>
            )}
          </div>

          {/* Attendance stats */}
          {attended.length > 0 && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 28, fontWeight: 800, color: '#4f46e5', lineHeight: 1 }}>{attended.length}</p>
                <p style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>clases asistidas</p>
              </div>
              {membership?.sessions_per_week && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 28, fontWeight: 800, color: '#4f46e5', lineHeight: 1 }}>{membership.sessions_per_week}</p>
                  <p style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>por semana</p>
                </div>
              )}
              {attendance.filter(a => a.status === 'no_show').length > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 28, fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>
                    {attendance.filter(a => a.status === 'no_show').length}
                  </p>
                  <p style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>inasistencias</p>
                </div>
              )}
            </div>
          )}

          {/* Attendance history */}
          {attendance.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Historial de asistencia
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {attendance.map((appt, i) => {
                  const cfg = STATUS_CONFIG[appt.status]
                  const dateStr = appt.session_start ? formatDate(appt.session_start) : '—'
                  const timeStr = appt.session_start
                    ? appt.session_start.split('T')[1]?.slice(0, 5)
                    : ''
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr auto',
                        gap: 12,
                        padding: '7px 0',
                        borderBottom: i < attendance.length - 1 ? '1px solid #f3f4f6' : 'none',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{dateStr}</p>
                        {timeStr && <p style={{ fontSize: 11, color: '#9ca3af' }}>{timeStr}</p>}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: '#374151' }}>{appt.class_type_name || '—'}</p>
                        {appt.notes && (
                          <p style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', borderRadius: 4, padding: '2px 6px', marginTop: 2, display: 'inline-block' }}>
                            {appt.notes}
                          </p>
                        )}
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', color: cfg?.color || '#374151' }}>
                        {cfg?.label || appt.status}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {attendance.length === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
              Sin historial de asistencia registrado
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            background: '#f9fafb',
            borderTop: '1px solid #f3f4f6',
            padding: '12px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <p style={{ fontSize: 11, color: '#9ca3af' }}>
            Generado el {fmtDate(data.generated_at)}
          </p>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: '0.05em' }}>
            KALMA
          </p>
        </div>
      </div>
    </div>
  )
}
