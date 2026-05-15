import { ClassSession } from '@/types'
import { formatTime } from '@/lib/utils'
import { Users, AlertCircle } from 'lucide-react'

interface SessionCardProps {
  session: ClassSession
  onClick?: () => void
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const isFull = session.enrolled_count >= session.capacity
  const percentage = (session.enrolled_count / session.capacity) * 100

  return (
    <div
      onClick={onClick}
      style={{ borderLeftColor: session.class_type_color || '#6366f1' }}
      className="relative border-l-4 bg-white rounded-lg shadow-sm p-3 cursor-pointer hover:shadow-md transition mb-1 text-left w-full"
    >
      {session.has_health_alerts && (
        <AlertCircle className="absolute top-2 right-2 w-3.5 h-3.5 text-amber-400" />
      )}
      <p className="font-semibold text-sm text-gray-900 truncate pr-5">{session.class_type_name || 'Clase'}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {formatTime(session.start_datetime)} · {session.instructor_name || 'Sin instructor'}
      </p>
      <div className="flex items-center gap-1 mt-2">
        <Users className="w-3 h-3 text-gray-400" />
        <span className={`text-xs ${isFull ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
          {session.enrolled_count}/{session.capacity}
        </span>
        <div className="flex-1 h-1 bg-gray-100 rounded-full ml-1">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percentage}%`, backgroundColor: session.class_type_color || '#6366f1' }}
          />
        </div>
      </div>
    </div>
  )
}
