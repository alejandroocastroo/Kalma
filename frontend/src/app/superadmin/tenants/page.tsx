'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { superadminApi } from '@/lib/superadmin-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Building2, PowerOff, Power } from 'lucide-react'
import { toast } from 'sonner'
import { CreateTenantModal } from './create-tenant-modal'
import type { SuperadminTenant } from '@/types/superadmin'

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export default function TenantsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['superadmin-tenants'],
    queryFn: () => superadminApi.tenants.list(),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => superadminApi.tenants.toggle(id),
    onSuccess: (updated) => {
      toast.success(`Tenant "${updated.name}" ${updated.is_active ? 'activado' : 'desactivado'}`)
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
    },
    onError: () => toast.error('Error al cambiar el estado'),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">{tenants.length} estudios registrados</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo tenant
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estudio</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              : tenants.map((tenant: SuperadminTenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{tenant.name}</p>
                          {tenant.email && <p className="text-xs text-gray-400">{tenant.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        {tenant.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tenant.plan === 'pro' ? 'default' : 'secondary'}>
                        {PLAN_LABELS[tenant.plan] || tenant.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tenant.is_active ? 'success' : 'secondary'}>
                        {tenant.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(tenant.created_at).toLocaleDateString('es-CO', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={tenant.is_active ? 'outline' : 'default'}
                        onClick={() => toggleMutation.mutate(tenant.id)}
                        disabled={toggleMutation.isPending}
                        className={tenant.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}
                      >
                        {tenant.is_active
                          ? <><PowerOff className="w-3 h-3 mr-1" /> Desactivar</>
                          : <><Power className="w-3 h-3 mr-1" /> Activar</>
                        }
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 text-sm py-12">
                  No hay tenants registrados. Crea el primero.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateTenantModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
