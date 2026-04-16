'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { superadminApi } from '@/lib/superadmin-api'

const schema = z.object({
  tenant_name: z.string().min(2, 'Mínimo 2 caracteres'),
  tenant_slug: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Solo minúsculas, números y guiones'),
  plan: z.enum(['basic', 'pro', 'enterprise']),
  admin_full_name: z.string().min(2, 'Mínimo 2 caracteres'),
  admin_email: z.string().email('Email inválido'),
  admin_password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateTenantModal({ open, onClose }: Props) {
  const qc = useQueryClient()

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { plan: 'basic' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => superadminApi.tenants.create(data),
    onSuccess: (res) => {
      toast.success(`Tenant "${res.tenant.name}" creado. Admin: ${res.admin_email}`)
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      reset()
      onClose()
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Error al crear el tenant')
    },
  })

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setValue('tenant_name', name)
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (slug.length >= 2) setValue('tenant_slug', slug)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent title="Nuevo tenant">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">

          {/* Tenant info */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del estudio</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del estudio *</label>
              <Input
                placeholder="Gym en Casa"
                {...register('tenant_name')}
                onChange={handleNameChange}
              />
              {errors.tenant_name && <p className="text-red-500 text-xs mt-1">{errors.tenant_name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL) *</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 whitespace-nowrap">kalma.com/</span>
                  <Input
                    placeholder="gymencasa"
                    {...register('tenant_slug')}
                    className="text-sm"
                  />
                </div>
                {errors.tenant_slug && <p className="text-red-500 text-xs mt-1">{errors.tenant_slug.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                <select
                  {...register('plan')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          {/* Admin user */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuenta del administrador</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <Input placeholder="Juan Pérez" {...register('admin_full_name')} />
              {errors.admin_full_name && <p className="text-red-500 text-xs mt-1">{errors.admin_full_name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <Input type="email" placeholder="juan@gymencasa.com" {...register('admin_email')} />
                {errors.admin_email && <p className="text-red-500 text-xs mt-1">{errors.admin_email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                <Input type="password" placeholder="Mínimo 8 caracteres" {...register('admin_password')} />
                {errors.admin_password && <p className="text-red-500 text-xs mt-1">{errors.admin_password.message}</p>}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creando...' : 'Crear tenant'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
