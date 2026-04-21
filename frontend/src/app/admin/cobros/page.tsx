'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cobros as cobrosApi, apiClient } from '@/lib/api';
import type { CobrosClient } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, CalendarX, Users, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const PRIORITY_CONFIG = {
  1: { label: 'Sin pagar', className: 'bg-red-100 text-red-700 border border-red-200' },
  2: { label: 'Plan vencido', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  3: { label: 'Próximo a vencer', className: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  4: { label: 'Al día', className: 'bg-green-100 text-green-700 border border-green-200' },
} as const;

export default function CobrosPage() {
  const [filterPriority, setFilterPriority] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: cobros = [], isLoading, refetch } = useQuery<CobrosClient[]>({
    queryKey: ['cobros'],
    queryFn: cobrosApi.list,
    staleTime: 2 * 60 * 1000,
  });

  const handleMarkPaid = async (appointmentIds: string[]) => {
    await Promise.all(
      appointmentIds.map(id => apiClient.put(`/appointments/${id}/mark-paid`))
    );
    queryClient.invalidateQueries({ queryKey: ['cobros'] });
  };

  const filtered = filterPriority ? cobros.filter(c => c.priority === filterPriority) : cobros;

  const priorityCounts = ([1, 2, 3, 4] as const).map(p => ({
    priority: p,
    count: cobros.filter(c => c.priority === p).length,
  }));

  function formatInfo(client: CobrosClient): string {
    if (!client.membership_type) return 'Sin plan activo';

    if (client.membership_type === 'monthly') {
      if (client.next_billing_date) {
        return `Próximo cobro: ${format(parseISO(client.next_billing_date), "d 'de' MMM yyyy", { locale: es })}`;
      }
      return 'Mensualidad';
    }

    // session_based
    const sesiones =
      client.sessions_remaining !== null
        ? `${client.sessions_remaining} sesión${client.sessions_remaining !== 1 ? 'es' : ''} restante${client.sessions_remaining !== 1 ? 's' : ''}`
        : '';
    const vence = client.expiry_date
      ? `Vence ${format(parseISO(client.expiry_date), "d 'de' MMM yyyy", { locale: es })}`
      : '';
    return [sesiones, vence].filter(Boolean).join(' · ');
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cobros</h1>
          <p className="text-sm text-gray-500 mt-1">Prioridad de cobro por cliente</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterPriority(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filterPriority === null
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todos ({cobros.length})
        </button>
        {priorityCounts.map(({ priority, count }) =>
          count > 0 ? (
            <button
              key={priority}
              onClick={() => setFilterPriority(filterPriority === priority ? null : priority)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filterPriority === priority
                  ? PRIORITY_CONFIG[priority].className
                  : PRIORITY_CONFIG[priority].className + ' opacity-70 hover:opacity-100'
              }`}
            >
              {PRIORITY_CONFIG[priority].label} ({count})
            </button>
          ) : null
        )}
      </div>

      {/* Client list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No hay clientes en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => (
            <Card key={client.client_id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3">
                  {/* Priority badge */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${PRIORITY_CONFIG[client.priority].className}`}
                  >
                    {PRIORITY_CONFIG[client.priority].label}
                  </span>

                  {/* Client info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{client.client_name}</span>
                      {client.has_pending_makeup && (
                        <span title="Tiene reposición pendiente" className="text-amber-500">
                          <CalendarX className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-gray-500">{formatInfo(client)}</p>
                      {client.debt_count > 0 && (
                        <span className="text-xs text-red-600">
                          Debe {client.debt_count} clase{client.debt_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions + Plan badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {client.appointment_ids_with_debt?.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => handleMarkPaid(client.appointment_ids_with_debt)}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Marcar pagado
                      </Button>
                    )}
                    {client.plan_name && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                        {client.plan_name}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
