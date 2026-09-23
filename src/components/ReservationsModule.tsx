import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, CalendarDays, ChevronRight, Clock, Eye, MapPin, PartyPopper, Plus, RefreshCw, Search, Trash2, User, Users, X } from 'lucide-react';
import { CommonAreaReservation } from '../types';
import { createReservation, createReservationSignatureCode, deleteReservation, fetchReservations, updateReservationStatus } from '../api';
import RegisteredUnitAutocomplete from './RegisteredUnitAutocomplete';
import ReservationGuests from './ReservationGuests';

interface ReservationsModuleProps {
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  isInternetOnline: boolean;
}

const COMMON_AREAS: CommonAreaReservation['area'][] = ['Churrasqueira', 'Salão de festas'];
const MAX_RESERVATION_ADVANCE_DAYS = 30;
const CANCELLATION_LIMIT_DAYS = 7;

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseReservationDate(value: string) {
  return startOfLocalDay(new Date(`${value}T00:00:00`));
}

function daysUntilReservation(value: string) {
  const today = startOfLocalDay(new Date());
  const reservationDay = parseReservationDate(value);
  return Math.ceil((reservationDay.getTime() - today.getTime()) / 86_400_000);
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function reservationDateBounds() {
  const min = startOfLocalDay(new Date());
  const max = new Date(min);
  max.setDate(max.getDate() + MAX_RESERVATION_ADVANCE_DAYS);
  return { min: formatDateInput(min), max: formatDateInput(max) };
}

function canCancelReservation(reservation: CommonAreaReservation) {
  return daysUntilReservation(reservation.reservationDate) >= CANCELLATION_LIMIT_DAYS;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ReservationsModule({ showToast, isInternetOnline }: ReservationsModuleProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const dateBounds = reservationDateBounds();
  const [reservations, setReservations] = useState<CommonAreaReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState<'todos' | CommonAreaReservation['area']>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | CommonAreaReservation['status']>('todos');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [signatureCode, setSignatureCode] = useState<{ reservationId: string; code: string; expiresAt: string } | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [updatingReservationId, setUpdatingReservationId] = useState<string | null>(null);
  const [signatureIssue, setSignatureIssue] = useState<{ unit: string; message: string } | null>(null);

  const [formData, setFormData] = useState({
    area: 'Churrasqueira' as CommonAreaReservation['area'],
    residentName: '',
    unit: '',
    reservationDate: dateBounds.min,
    startTime: '09:00',
    endTime: '18:00',
    guests: '',
    notes: '',
  });

  const loadReservations = async () => {
    setIsLoading(true);
    try {
      setReservations(await fetchReservations());
    } catch (err) {
      console.error(err);
      showToast('Nao foi possivel carregar as reservas das areas comuns.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, []);

  useEffect(() => {
    if (!reservations.some(item => item.syncStatus !== 'synced')) return;
    let disposed = false;
    const timer = window.setInterval(async () => {
      try {
        const rows = await fetchReservations();
        if (!disposed) setReservations(rows);
      } catch { /* Keep the current records visible until the next refresh. */ }
    }, 10000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [reservations]);

  useEffect(() => {
    if (!signatureCode) return;
    const refresh = async () => {
      const remaining = Math.max(0, Math.ceil((new Date(signatureCode.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      try {
        const rows = await fetchReservations();
        setReservations(rows);
        if (rows.find(item => item.id === signatureCode.reservationId)?.signed) {
          setSignatureCode(null);
          showToast('Termo assinado com sucesso.', 'success');
        }
      } catch { /* mantém a contagem mesmo durante uma falha breve */ }
    };
    refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [signatureCode]);

  const filteredReservations = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return reservations.filter(reservation => {
      const matchesSearch = !term ||
        reservation.area.toLowerCase().includes(term) ||
        reservation.residentName.toLowerCase().includes(term) ||
        reservation.unit.toLowerCase().includes(term) ||
        (reservation.guests || '').toLowerCase().includes(term) ||
        (reservation.notes || '').toLowerCase().includes(term);
      const matchesArea = areaFilter === 'todos' || reservation.area === areaFilter;
      const matchesStatus = statusFilter === 'todos' || reservation.status === statusFilter;
      return matchesSearch && matchesArea && matchesStatus;
    });
  }, [areaFilter, reservations, searchTerm, statusFilter]);

  const selectedReservation = reservations.find(item => item.id === selectedReservationId);
  const closeDetails = () => {
    setSelectedReservationId(null);
    setSignatureCode(null);
    setSignatureIssue(null);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedReservation) {
      if (!dialog?.open) dialog?.showModal();
    } else {
      dialog?.close();
      if (selectedReservationId) closeDetails();
    }
  }, [selectedReservation, selectedReservationId]);

  const conflictingReservation = useMemo(() => {
    if (!formData.reservationDate) return undefined;
    const selectedUnit = formData.unit.trim().toLocaleLowerCase('pt-BR');
    return reservations.find(reservation =>
      reservation.status === 'reservada' &&
      reservation.reservationDate === formData.reservationDate &&
      (
        reservation.area === formData.area ||
        (selectedUnit !== '' && reservation.unit.trim().toLocaleLowerCase('pt-BR') === selectedUnit)
      )
    );
  }, [formData.area, formData.reservationDate, formData.unit, reservations]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.area) nextErrors.area = 'Selecione a area comum.';
    if (!formData.residentName.trim()) nextErrors.residentName = 'Informe o morador responsavel.';
    if (!formData.unit.trim()) nextErrors.unit = 'Informe o apartamento.';
    if (!formData.reservationDate) nextErrors.reservationDate = 'Informe a data da reserva.';
    if (formData.reservationDate) {
      const days = daysUntilReservation(formData.reservationDate);
      if (days < 0) nextErrors.reservationDate = 'A data da reserva nao pode estar no passado.';
      if (days > MAX_RESERVATION_ADVANCE_DAYS) {
        nextErrors.reservationDate = 'A reserva so pode ser feita com ate 30 dias de antecedencia.';
      }
    }
    if (!formData.startTime) nextErrors.startTime = 'Informe o horario inicial.';
    if (!formData.endTime) nextErrors.endTime = 'Informe o horario final.';
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      nextErrors.endTime = 'Horario final deve ser maior que o inicial.';
    }
    if (conflictingReservation) {
      nextErrors.reservationDate = conflictingReservation.area === formData.area
        ? `${formData.area} ja esta reservada nesta data.`
        : `O Apto ${formData.unit.trim()} ja reservou ${conflictingReservation.area} nesta data.`;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) {
      showToast('Revise os campos obrigatorios da reserva.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createReservation({
        area: formData.area,
        residentName: formData.residentName.trim(),
        unit: formData.unit.trim(),
        reservationDate: formData.reservationDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        guests: formData.guests.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });
      setReservations(prev => [created, ...prev]);
      setFormData(prev => ({ ...prev, residentName: '', unit: '', guests: '', notes: '' }));
      showToast(
        isInternetOnline
          ? `Reserva da ${created.area} cadastrada para o Apto ${created.unit}.`
          : `Reserva da ${created.area} salva localmente e pendente de sincronizacao.`,
        isInternetOnline ? 'success' : 'warning',
      );
    } catch (err) {
      console.error(err);
      showToast(errorMessage(err, 'Nao foi possivel cadastrar a reserva.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatus = async (reservation: CommonAreaReservation, status: CommonAreaReservation['status']) => {
	if (updatingReservationId === reservation.id) return;
    if (status === 'cancelada' && !canCancelReservation(reservation)) {
      showToast('A reserva so pode ser cancelada ate 7 dias antes da data do evento.', 'warning');
      return;
    }

    setUpdatingReservationId(reservation.id);
    try {
      const updated = await updateReservationStatus(reservation.id, status);
      setReservations(prev => prev.map(item => item.id === reservation.id ? updated : item));
      showToast(status === 'cancelada' ? 'Reserva cancelada.' : 'Status da reserva atualizado.', 'success');
    } catch (err) {
      console.error(err);
      showToast(errorMessage(err, 'Nao foi possivel atualizar a reserva.'), 'error');
    } finally {
      setUpdatingReservationId(null);
    }
  };

  const handleDelete = async (reservation: CommonAreaReservation) => {
    if (!window.confirm(`Excluir a reserva da ${reservation.area} do Apto ${reservation.unit}?`)) return;
    try {
      await deleteReservation(reservation.id);
      setReservations(prev => prev.filter(item => item.id !== reservation.id));
      showToast('Reserva excluida.', 'success');
    } catch (err) {
      console.error(err);
      showToast(errorMessage(err, 'Nao foi possivel excluir a reserva.'), 'error');
    }
  };

  const handleSignature = async (reservation: CommonAreaReservation) => {
    try {
      const result = await createReservationSignatureCode(reservation.id);
      setSignatureCode({ reservationId: reservation.id, code: result.code, expiresAt: result.expiresAt });
    } catch (err) {
      const message = errorMessage(err, 'Não foi possível gerar o código de assinatura.');
      if (message.toLocaleLowerCase('pt-BR').includes('e-mail')) {
        setSignatureIssue({ unit: reservation.unit, message });
      }
      showToast(message, 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="reservations-module">
      <div className="lg:col-span-4">
        <div className="bg-[#0a0d14] border border-slate-800/40 rounded-sm overflow-hidden">
          <div className="bg-[#07090f] border-b border-slate-800/40 px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-emerald-950/40 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <PartyPopper size={18} />
            </div>
            <div>
              <h2 className="text-sm text-emerald-400 font-bold uppercase tracking-widest">Nova Reserva</h2>
              <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">Areas comuns do condominio</p>
            </div>
          </div>

          <div className="mx-5 mt-5 border border-emerald-500/20 bg-emerald-950/15 rounded-sm p-3 font-mono">
            <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-400 mb-2">Regras de reserva</p>
            <ul className="space-y-1 text-[10px] leading-relaxed text-slate-400 list-disc pl-4">
              <li>Cada area aceita somente um apartamento por data.</li>
              <li>Cada apartamento pode reservar somente uma das areas na mesma data.</li>
              <li>A data deve estar entre hoje e 30 dias.</li>
              <li>O cancelamento exige no minimo 7 dias de antecedencia.</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4 font-mono">
            <FieldError error={errors.area}>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Area Comum *</label>
              <div className="grid grid-cols-2 gap-2">
                {COMMON_AREAS.map(area => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, area }))}
                    className={`py-2 px-2 rounded-sm border text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                      formData.area === area
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-emerald-400'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </FieldError>

            <div className="grid grid-cols-3 gap-3">
              <FieldError className="col-span-1" error={errors.unit}>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Apto *</label>
                <RegisteredUnitAutocomplete
                  value={formData.unit}
                  onChange={unit => setFormData(prev => ({ ...prev, unit }))}
                  className={`w-full bg-slate-950 border ${errors.unit ? 'border-red-500' : 'border-slate-800'} text-slate-100 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-emerald-500/60`}
                />
              </FieldError>

              <FieldError className="col-span-2" error={errors.residentName}>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Morador *</label>
                <input
                  value={formData.residentName}
                  onChange={(e) => setFormData(prev => ({ ...prev, residentName: e.target.value }))}
                  placeholder="Nome do responsavel"
                  className={`w-full bg-slate-950 border ${errors.residentName ? 'border-red-500' : 'border-slate-800'} text-slate-100 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-emerald-500/60`}
                />
              </FieldError>
            </div>

            <FieldError error={errors.reservationDate}>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Data da Reserva *</label>
              <input
                type="date"
                value={formData.reservationDate}
                min={dateBounds.min}
                max={dateBounds.max}
                onChange={(e) => setFormData(prev => ({ ...prev, reservationDate: e.target.value }))}
                className={`w-full bg-slate-950 border ${errors.reservationDate ? 'border-red-500' : 'border-slate-800'} text-slate-100 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-emerald-500/60`}
              />
              {!errors.reservationDate && !conflictingReservation && (
                <p className="text-[9px] text-slate-500 font-mono uppercase mt-1">
                  Uma reserva por area e uma unica area por apartamento na mesma data.
                </p>
              )}
              {!errors.reservationDate && conflictingReservation && (
                <p className="text-[9px] text-amber-400 font-mono uppercase mt-1">
                  Conflito com {conflictingReservation.area} do Apto {conflictingReservation.unit}.
                </p>
              )}
            </FieldError>

            <div className="grid grid-cols-2 gap-3">
              <FieldError error={errors.startTime}>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Inicio *</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className={`w-full bg-slate-950 border ${errors.startTime ? 'border-red-500' : 'border-slate-800'} text-slate-100 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-emerald-500/60`}
                />
              </FieldError>
              <FieldError error={errors.endTime}>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Fim *</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className={`w-full bg-slate-950 border ${errors.endTime ? 'border-red-500' : 'border-slate-800'} text-slate-100 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-emerald-500/60`}
                />
              </FieldError>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Convidados / Quantidade</label>
              <input
                value={formData.guests}
                onChange={(e) => setFormData(prev => ({ ...prev, guests: e.target.value }))}
                placeholder="Ex: 20 pessoas"
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-emerald-500/60"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Observacoes</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Ex: aniversario, uso de churrasqueira, limpeza confirmada..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-emerald-500/60 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-sm py-3 font-bold uppercase tracking-widest text-xs transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>{isSubmitting ? 'Cadastrando...' : 'Cadastrar Reserva'}</span>
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-4">
        <div className="bg-[#0a0d14] border border-slate-800/40 rounded-sm p-4 flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              aria-label="Buscar reservas"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por apto, morador, area ou observacao..."
              className="w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-sm outline-none focus:border-emerald-500/60 placeholder-slate-600"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select aria-label="Filtrar por area" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value as typeof areaFilter)} className="bg-slate-950 border border-slate-800 text-slate-100 rounded-sm px-3 py-3 text-sm outline-none">
              <option value="todos">Todas as areas</option>
              {COMMON_AREAS.map(area => <option key={area} value={area}>{area}</option>)}
            </select>
            <select aria-label="Filtrar por status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="bg-slate-950 border border-slate-800 text-slate-100 rounded-sm px-3 py-3 text-sm outline-none">
              <option value="todos">Todos os status</option>
              <option value="reservada">Reservadas</option>
              <option value="concluida">Concluidas</option>
              <option value="cancelada">Canceladas</option>
            </select>
            <button aria-label="Atualizar reservas" onClick={loadReservations} disabled={isLoading} className="bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-sm px-4 py-3 transition cursor-pointer">
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500">Selecione uma reserva para consultar os detalhes e acessar as ações.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start" id="reservation-columns" aria-busy={isLoading}>
          {COMMON_AREAS.map((area, index) => {
            const items = filteredReservations.filter(reservation => reservation.area === area);
            const accent = index === 0 ? 'text-emerald-400' : 'text-cyan-300';
            const border = index === 0 ? 'border-emerald-900/50' : 'border-cyan-900/50';
            return (
              <section key={area} aria-labelledby={`reservation-area-${index}`} className={`min-w-0 rounded-sm border bg-[#0a0d14] ${border}`}>
                <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 ${border}`}>
                  <h3 id={`reservation-area-${index}`} className={`flex items-center gap-2 font-bold ${accent}`}>
                    {index === 0 ? <MapPin size={18} /> : <PartyPopper size={18} />}{area}
                  </h3>
                  <span className={`text-xs font-mono ${accent}`}>{items.length} reserva{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2 p-3">
                  {items.map(reservation => (
                    <button key={reservation.id} type="button" id={`reservation-card-${reservation.id}`}
                      onClick={() => setSelectedReservationId(reservation.id)} aria-haspopup="dialog"
                      aria-label={`Abrir reserva de ${area}, apartamento ${reservation.unit}, ${formatDate(reservation.reservationDate)}`}
                      className={`w-full rounded-sm border border-slate-800 bg-slate-950/60 p-3 text-left transition hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 ${index === 0 ? 'hover:border-emerald-500/60 focus-visible:outline-emerald-400' : 'hover:border-cyan-500/60 focus-visible:outline-cyan-400'}`}>
                      <span className="flex flex-wrap items-start justify-between gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] uppercase tracking-wider text-slate-500">Apartamento</span>
                          <span className="block break-words text-xl font-bold text-white">{reservation.unit}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={`flex items-center justify-end gap-1.5 text-sm font-bold ${accent}`}><CalendarDays size={13} />{formatDate(reservation.reservationDate)}</span>
                          <span className="mt-1 flex items-center justify-end gap-1 text-xs text-slate-400"><Clock size={12} />{reservation.startTime} – {reservation.endTime}</span>
                        </span>
                      </span>
                      <span className="mt-2 flex items-center gap-2 border-t border-slate-800/60 pt-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-200" title={reservation.residentName}>{reservation.residentName}</span>
                          <span className={`mt-1 block text-[10px] uppercase tracking-wide ${reservation.status === 'cancelada' ? 'text-red-400' : reservation.status === 'concluida' ? 'text-slate-500' : accent}`}>
                            {reservation.status === 'concluida' ? 'Concluída' : reservation.status === 'cancelada' ? 'Cancelada' : 'Reservada'}
                            {reservation.status === 'reservada' && (reservation.signed ? ' · Termo assinado' : ' · Assinatura pendente')}
                          </span>
                        </span>
                        <ChevronRight size={16} className={`shrink-0 ${accent}`} />
                      </span>
                      {reservation.syncStatus !== 'synced' && <span className="mt-2 block text-[10px] text-amber-400">{reservation.syncStatus === 'failed' ? 'Falha na sincronização' : 'Sincronização pendente'}</span>}
                    </button>
                  ))}
                  {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">{isLoading ? 'Carregando reservas...' : searchTerm || areaFilter !== 'todos' || statusFilter !== 'todos' ? 'Nenhuma reserva corresponde aos filtros.' : 'Nenhuma reserva cadastrada para esta área.'}</p>}
                </div>
              </section>
            );
          })}
        </div>

      </div>
      {createPortal(
        <dialog ref={dialogRef} aria-labelledby="reservation-details-title"
          className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg border border-slate-700 bg-[#0a0d14] p-0 text-slate-100 shadow-2xl backdrop:bg-black/80"
          onClose={closeDetails}
          onCancel={event => {
            event.preventDefault();
            if (signatureCode) setSignatureCode(null);
            else if (signatureIssue) setSignatureIssue(null);
            else closeDetails();
          }}
          onClick={event => { if (event.target === event.currentTarget) closeDetails(); }}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <h3 id="reservation-details-title" className="font-bold">Detalhes da reserva</h3>
            <button type="button" autoFocus onClick={closeDetails} aria-label="Fechar detalhes" className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"><X size={20} /></button>
          </div>
          {selectedReservation && <div className="p-4"><ReservationCard reservation={selectedReservation} onStatus={handleStatus} onDelete={handleDelete} onSignature={handleSignature} updatingReservationId={updatingReservationId} /><ReservationGuests key={selectedReservation.id} reservationId={selectedReservation.id} /></div>}
      {signatureCode && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0d14] border border-[#c9a45d]/50 rounded-lg p-7 text-center shadow-2xl font-mono">
            <p className="text-[#c9a45d] text-xs font-bold uppercase tracking-[0.2em]">Código para assinatura</p>
            <p className="text-white text-5xl sm:text-6xl tracking-[0.2em] font-black my-6">{signatureCode.code}</p>
            <p className={secondsRemaining > 0 ? 'text-slate-400' : 'text-red-400 font-bold'}>
              {secondsRemaining > 0 ? `Expira em ${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}` : 'Código expirado'}
            </p>
            <button onClick={() => setSignatureCode(null)} className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-sm text-xs uppercase font-bold tracking-widest">Fechar</button>
          </div>
        </div>
      )}
      {signatureIssue && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0d14] border border-amber-500/50 rounded-lg p-7 text-center shadow-2xl font-mono">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">Assinatura pendente</p>
            <h3 className="text-white text-xl font-black mt-4">Apartamento {signatureIssue.unit}</h3>
            <p className="text-slate-300 text-sm leading-relaxed mt-4">Não foi possível gerar o código porque o morador não possui um e-mail válido cadastrado.</p>
            <p className="text-slate-500 text-xs mt-3">Cadastre o e-mail do proprietário ou inquilino e tente novamente.</p>
            <button onClick={() => setSignatureIssue(null)} className="mt-6 w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-sm text-xs uppercase font-bold tracking-widest">Entendi</button>
          </div>
        </div>
      )}

        </dialog>, document.body
      )}
    </div>
  );
}

function FieldError({ children, error, className = '' }: { children: React.ReactNode; error?: string; className?: string }) {
  return (
    <div className={className}>
      {children}
      {error && <p className="text-[9px] text-red-400 font-mono uppercase mt-1">{error}</p>}
    </div>
  );
}

interface ReservationCardProps {
  reservation: CommonAreaReservation;
  onStatus: (reservation: CommonAreaReservation, status: CommonAreaReservation['status']) => Promise<void>;
  onDelete: (reservation: CommonAreaReservation) => Promise<void>;
  onSignature: (reservation: CommonAreaReservation) => Promise<void>;
  updatingReservationId: string | null;
}

const ReservationCard: React.FC<ReservationCardProps> = ({ reservation, onStatus, onDelete, onSignature, updatingReservationId }) => {
  const statusClasses = {
    reservada: 'bg-emerald-950/35 text-emerald-400 border-emerald-500/25',
    concluida: 'bg-slate-950 text-slate-400 border-slate-700',
    cancelada: 'bg-red-950/35 text-red-400 border-red-500/25',
  };
  const canCancel = canCancelReservation(reservation);

  return (
    <div className="bg-[#0a0d14] border border-slate-800/60 rounded-sm p-5 font-mono">
      <div className="flex items-start justify-between gap-3 border-b border-slate-900/70 pb-3">
        <div>
          <div className="flex items-center gap-2 text-white">
            <MapPin size={16} className="text-emerald-400" />
            <h3 className="font-black text-lg uppercase leading-tight">{reservation.area}</h3>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500 uppercase">
            <span className="flex items-center gap-1"><CalendarDays size={11} /> {formatDate(reservation.reservationDate)}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {reservation.startTime} - {reservation.endTime}</span>
          </div>
        </div>
        <span className={`border px-2 py-1 rounded-sm text-[9px] uppercase tracking-widest font-bold ${statusClasses[reservation.status]}`}>
          {reservation.status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
        <div className="bg-slate-950/60 border border-slate-800 rounded-sm p-3">
          <div className="flex items-center gap-1.5 text-[9px] uppercase text-slate-500 font-bold tracking-widest">
            <User size={12} />
            <span>Responsavel</span>
          </div>
          <p className="text-white text-base font-bold truncate mt-1" title={reservation.residentName}>{reservation.residentName}</p>
        </div>
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-sm p-3">
          <div className="flex items-center gap-1.5 text-[9px] uppercase text-emerald-400 font-bold tracking-widest">
            <Users size={12} />
            <span>Apartamento</span>
          </div>
          <p className="text-white text-2xl font-black truncate leading-tight mt-1">Apto {reservation.unit}</p>
        </div>
      </div>

      {(reservation.guests || reservation.notes) && (
        <div className="text-[11px] text-slate-400 bg-slate-950/50 border border-slate-900 rounded-sm p-3 mb-4">
          {reservation.guests && <p><span className="text-slate-600 uppercase font-bold">Convidados:</span> {reservation.guests}</p>}
          {reservation.notes && <p className="mt-1"><span className="text-slate-600 uppercase font-bold">Obs:</span> {reservation.notes}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-900/70 pt-3">
        <span className={`text-[9px] uppercase font-bold ${reservation.syncStatus !== 'synced' ? 'text-amber-400' : 'text-emerald-400'}`}>
          {reservation.syncStatus === 'failed' ? 'Falha na sincronização' : reservation.syncStatus === 'pending' ? 'Sincronização pendente' : 'Sincronizada'}
          {reservation.status === 'reservada' && !canCancel && (
            <span className="block text-red-400 mt-1">Cancelamento fora do prazo</span>
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          {reservation.status === 'reservada' && (
            <>
              {!reservation.signed ? (
                <button onClick={() => onSignature(reservation)} className="px-3 py-1.5 bg-blue-950 hover:bg-blue-900 border border-blue-500/25 text-blue-300 rounded-sm text-[9px] uppercase font-bold tracking-wider cursor-pointer">Assinar</button>
              ) : (
                <a href={`/api/reservations/${reservation.id}/signed-document`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-emerald-950 border border-emerald-500/25 text-emerald-400 rounded-sm text-[9px] uppercase font-bold flex items-center gap-1"><Eye size={11}/> Ver termo</a>
              )}
              <button
                onClick={() => onStatus(reservation, 'cancelada')}
                disabled={!canCancel || updatingReservationId === reservation.id}
                title={canCancel ? 'Cancelar reserva' : 'Cancelamento permitido somente ate 7 dias antes do evento'}
                className="px-3 py-1.5 bg-red-950/35 hover:bg-red-950 disabled:bg-slate-950 disabled:text-slate-600 disabled:border-slate-800 border border-red-500/25 text-red-400 rounded-sm text-[9px] uppercase font-bold tracking-wider cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Ban size={11} /> {updatingReservationId === reservation.id ? 'Cancelando...' : 'Cancelar'}
              </button>
            </>
          )}
          {reservation.status !== 'reservada' && (
            <button onClick={() => onDelete(reservation)} className="p-1.5 bg-slate-950 hover:bg-red-950/50 border border-slate-800 hover:border-red-500/30 text-slate-500 hover:text-red-400 rounded-sm cursor-pointer" title="Excluir reserva">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}
