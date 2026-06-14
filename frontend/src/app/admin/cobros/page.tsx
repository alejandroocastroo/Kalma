'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cobros as cobrosApi, apiClient } from '@/lib/api';
import type { CobrosClient, DebtDetail } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, CalendarX, Users, CheckCircle, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const PRIORITY_CONFIG = {
  1: { label: 'Sin pagar', className: 'bg-red-100 text-red-700 border border-red-200' },
  2: { label: 'Plan vencido', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  3: { label: 'Próximo a vencer', className: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  4: { label: 'Al día', className: 'bg-green-100 text-green-700 border border-green-200' },
} as const;

const PAYMENT_METHODS = [
  ['cash', 'Efectivo'],
  ['transfer', 'Transferencia'],
  ['nequi', 'Nequi'],
  ['daviplata', 'Daviplata'],
  ['card', 'Tarjeta'],
];

interface PayDialog {
  appointmentId: string;
  label: string;
  clientName: string;
}

export default function CobrosPage() {
  const [filterPriority, setFilterPriority] = useState<number | null>(null);
  const [payDialog, setPayDialog] = useState<PayDialog | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [paying, setPaying] = useState(false);
  const queryClient = useQueryClient();

  const { data: cobros = [], isLoading, refetch } = useQuery<CobrosClient[]>({
    queryKey: ['cobros'],
    queryFn: cobrosApi.list,
    staleTime: 2 * 60 * 1000,
  });

  const openPayDialog = (appointmentId: string, label: string, clientName: string) => {
    setPayAmount('');
    setPayMethod('cash');
    setPayDialog({ appointmentId, label, clientName });
  };

  const handleConfirmPay = async () => {
    if (!payDialog) return;
    const rawAmount = parseInt(payAmount.replace(/\D/g, ''), 10);
    if (!rawAmount) { toast.error('Ingresa el valor de la clase'); return; }
    setPaying(true);
    try {
      await apiClient.put(`/appointments/${payDialog.appointmentId}/mark-paid`, {
        amount: rawAmount,
        payment_method: payMethod,
      });
      toast.success('Pago registrado en caja');
      queryClient.invalidateQueries({ queryKey: ['cobros'] });
      setPayDialog(null);
    } catch {
      toast.error('Error al registrar el pago');
    } finally {
      setPaying(false);
    }
  };

  const handleAmountInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) { setPayAmount(''); return; }
    setPayAmount(new Intl.NumberFormat('es-CO').format(parseInt(digits, 10)));
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

    if (client.membership_type === 'weekly_sessions') {
      const parts: string[] = [];
      if (client.sessions_used != null && client.total_sessions != null) {
        parts.push(`${client.sessions_used} / ${client.total_sessions} clases`);
      }
      if (client.next_billing_date) {
        parts.push(`Próximo cobro: ${format(parseISO(client.next_billing_date), "d 'de' MMM yyyy", { locale: es })}`);
      }
      return parts.length ? parts.join(' · ') : 'Sesiones semanales';
    }

    const sesiones =
      client.sessions_remaining !== null
        ? `${client.sessions_remaining} sesión${client.sessions_remaining !== 1 ? 'es' : ''} restante${client.sessions_remaining !== 1 ? 's' : ''}`
        : '';
    const vence = client.expiry_date
      ? `Vence ${format(parseISO(client.expiry_date), "d 'de' MMM yyyy", { locale: es })}`
      : '';
    return [sesiones, vence].filter(Boolean).join(' · ');
  }

  function formatDebtDetail(detail: DebtDetail): string {
    const space = detail.space_name || 'Sin espacio';
    if (!detail.start_datetime) return space;
    const time = format(new Date(detail.start_datetime), 'h:mm aa', { locale: es });
    const day = format(new Date(detail.start_datetime), "d 'de' MMM", { locale: es });
    return `${space} · ${day} · ${time}`;
  }

  // For is_debt_queue cards, use the appointment_id as unique key
  function cardKey(client: CobrosClient): string {
    if (client.is_debt_queue && client.appointment_ids_with_debt.length > 0) {
      return `debt-${client.appointment_ids_with_debt[0]}`;
    }
    return `client-${client.client_id}`;
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
            <Card key={cardKey(client)} className="hover:shadow-sm transition-shadow">
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

                    {/* Membership info (only for non-queue cards) */}
                    {!client.is_debt_queue && (
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-gray-500">{formatInfo(client)}</p>
                      </div>
                    )}

                    {/* Queue card: show the single debt detail prominently */}
                    {client.is_debt_queue && client.debt_details.length > 0 && (
                      <p className="text-xs text-red-600 mt-0.5">
                        {formatDebtDetail(client.debt_details[0])}
                      </p>
                    )}

                    {/* Membership cards with debts: show debt chips */}
                    {!client.is_debt_queue && client.debt_details.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {client.debt_details.map((detail) => (
                          <span
                            key={detail.appointment_id}
                            className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-full px-2 py-0.5"
                          >
                            Debe en {formatDebtDetail(detail)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions + Plan badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {client.is_debt_queue && client.appointment_ids_with_debt.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() =>
                          openPayDialog(
                            client.appointment_ids_with_debt[0],
                            client.debt_details[0]
                              ? formatDebtDetail(client.debt_details[0])
                              : 'Clase',
                            client.client_name,
                          )
                        }
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Marcar pagado
                      </Button>
                    )}
                    {!client.is_debt_queue && client.appointment_ids_with_debt?.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() =>
                          openPayDialog(
                            client.appointment_ids_with_debt[0],
                            client.debt_details[0]
                              ? formatDebtDetail(client.debt_details[0])
                              : 'Clase',
                            client.client_name,
                          )
                        }
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

      {/* Pay dialog */}
      {payDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Registrar pago</h2>
                <p className="text-sm text-gray-500 mt-0.5">{payDialog.clientName}</p>
                <p className="text-xs text-gray-400 mt-0.5">{payDialog.label}</p>
              </div>
              <button onClick={() => setPayDialog(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Valor</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={payAmount}
                    onChange={handleAmountInput}
                    placeholder="0"
                    autoFocus
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Método de pago</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {PAYMENT_METHODS.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPayDialog(null)}
                disabled={paying}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-gray-900 text-white hover:bg-gray-800"
                onClick={handleConfirmPay}
                disabled={paying}
              >
                {paying ? 'Registrando...' : 'Confirmar pago'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
