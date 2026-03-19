import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface StatsCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  loading?: boolean
  className?: string
}

export function StatsCard({ title, value, change, icon, loading, className }: StatsCardProps) {
  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm p-6', className)}>
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-16" />
      </div>
    )
  }

  const positive = change !== undefined ? change >= 0 : null

  return (
    <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm p-6', className)}>
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <div className="text-primary-600">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      {change !== undefined && (
        <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', positive ? 'text-green-600' : 'text-red-500')}>
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(change)}% vs. mes anterior
        </div>
      )}
    </div>
  )
}
