import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary-600 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Estudio no encontrado</h2>
        <p className="text-gray-500 mb-8">Este estudio no existe o no está disponible.</p>
        <Link href="/" className="bg-primary-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-700 transition">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
