'use client'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Banner de error para queries que fallan. Sin esto, un fallo del backend se ve
// como "sin resultados" y el admin no distingue error real de lista vacía.
export function ErrorBanner({
  message = 'No se pudieron cargar los datos. Revisa tu conexión e inténtalo de nuevo.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {message}
      </span>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-red-300 text-red-700 hover:bg-red-100"
        >
          Reintentar
        </Button>
      )}
    </div>
  )
}
