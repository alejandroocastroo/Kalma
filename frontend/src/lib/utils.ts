import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BOGOTA_TZ = 'America/Bogota'

export function formatCOP(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    const bogota = toZonedTime(date, BOGOTA_TZ)
    return format(bogota, "d 'de' MMMM, yyyy", { locale: es })
  } catch {
    return dateStr
  }
}

export function formatTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    const bogota = toZonedTime(date, BOGOTA_TZ)
    return format(bogota, 'h:mm a', { locale: es })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    const bogota = toZonedTime(date, BOGOTA_TZ)
    return format(bogota, "EEE d MMM, h:mm a", { locale: es })
  } catch {
    return dateStr
  }
}

export function formatShortDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    const bogota = toZonedTime(date, BOGOTA_TZ)
    return format(bogota, "d MMM", { locale: es })
  } catch {
    return dateStr
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function getDayOfWeek(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    const bogota = toZonedTime(date, BOGOTA_TZ)
    return format(bogota, 'EEEE', { locale: es })
  } catch {
    return ''
  }
}

export const appointmentStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmada', className: 'bg-blue-100 text-blue-800' },
  attended: { label: 'Asistió', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
  no_show: { label: 'No asistió', className: 'bg-gray-100 text-gray-600' },
}

export const categoryLabels: Record<string, string> = {
  class_fee: 'Cobro de clase',
  membership: 'Membresía',
  package: 'Paquete',
  equipment: 'Equipamiento',
  rent: 'Arriendo',
  salary: 'Nómina',
  other: 'Otro',
}

export const paymentMethodLabels: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
}
