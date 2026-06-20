// Zonas horarias ofrecidas al crear/editar un tenant en el panel de superadmin.
// El backend acepta cualquier zona IANA válida; esta es la lista curada para la UI.
export const TIMEZONE_OPTIONS = [
  { value: 'America/Bogota', label: 'Colombia (Bogotá) — UTC-5' },
  { value: 'America/Mexico_City', label: 'México (Centro / CDMX) — UTC-6' },
  { value: 'America/Cancun', label: 'México (Cancún / Quintana Roo) — UTC-5' },
  { value: 'America/Tijuana', label: 'México (Tijuana / Noroeste) — UTC-8' },
  { value: 'America/Lima', label: 'Perú (Lima) — UTC-5' },
  { value: 'America/Santiago', label: 'Chile (Santiago) — UTC-4/-3' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires) — UTC-3' },
  { value: 'America/New_York', label: 'EE. UU. (Este) — UTC-5/-4' },
  { value: 'America/Los_Angeles', label: 'EE. UU. (Pacífico) — UTC-8/-7' },
  { value: 'Europe/Madrid', label: 'España (Madrid) — UTC+1/+2' },
]

export const DEFAULT_TIMEZONE = 'America/Bogota'
