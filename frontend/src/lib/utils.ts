import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BOGOTA_TZ = 'America/Bogota'

// ─── Moneda ───────────────────────────────────────────────────────────────────

const CURRENCY_LOCALES: Record<string, string> = {
  COP: 'es-CO',
  MXN: 'es-MX',
  USD: 'en-US',
  EUR: 'es-ES',
  ARS: 'es-AR',
  PEN: 'es-PE',
  CLP: 'es-CL',
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  COP: '$', MXN: '$', USD: '$', EUR: '€', ARS: '$', PEN: 'S/', CLP: '$',
}

export const CURRENCY_OPTIONS = [
  { value: 'COP', label: 'Peso colombiano (COP)', example: '$150.000' },
  { value: 'MXN', label: 'Peso mexicano (MXN)', example: '$150,000' },
  { value: 'USD', label: 'Dólar estadounidense (USD)', example: '$150,000' },
  { value: 'EUR', label: 'Euro (EUR)', example: '€150.000' },
  { value: 'ARS', label: 'Peso argentino (ARS)', example: '$150.000' },
  { value: 'PEN', label: 'Sol peruano (PEN)', example: 'S/150,000' },
  { value: 'CLP', label: 'Peso chileno (CLP)', example: '$150.000' },
]

export function formatCurrency(amount: number | string, currency = 'COP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return `${CURRENCY_SYMBOLS[currency] || '$'}0`
  const locale = CURRENCY_LOCALES[currency] || 'es-CO'
  const symbol = CURRENCY_SYMBOLS[currency] || '$'
  return symbol + new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(num)
}

export function getCurrencyLocale(currency: string): string {
  return CURRENCY_LOCALES[currency] || 'es-CO'
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || '$'
}

// Backward-compat alias — siempre formatea en COP
export function formatCOP(amount: number | string): string {
  return formatCurrency(amount, 'COP')
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
  // Ingresos
  clase_dia: 'Clase Día',
  clase_grupal: 'Clase grupal',
  clase_privada: 'Clase privada',
  paquete_sesiones: 'Paquete de sesiones',
  membresia: 'Membresía',
  membresia_hibrida: 'Membresía Híbrida',
  inscripcion: 'Inscripción / matrícula',
  otro_ingreso: 'Otro ingreso',
  // Egresos
  arriendo: 'Arriendo',
  servicios_publicos: 'Servicios públicos',
  nomina_instructores: 'Nómina instructores',
  nomina_admin: 'Nómina administrativa',
  mantenimiento: 'Mantenimiento',
  equipamiento: 'Equipamiento',
  marketing: 'Marketing y publicidad',
  contabilidad: 'Contabilidad',
  tecnologia: 'Software / tecnología',
  seguros: 'Seguros',
  otros_gastos: 'Otros gastos',
  // Legado
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
