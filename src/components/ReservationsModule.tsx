import React, { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarDays, Check, Clock, MapPin, PartyPopper, Plus, RefreshCw, Search, Trash2, User, Users } from 'lucide-react';
import { CommonAreaReservation } from '../types';
import { createReservation, deleteReservation, fetchReservations, updateReservationStatus } from '../api';

interface ReservationsModuleProps {
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
  isInternetOnline: boolean;
}

const COMMON_AREAS: CommonAreaReservation['area'][] = ['Churrasqueira', 'Salão de festas'];
const CANCELLATION_LIMIT_DAYS = 2;

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

function canCancelReservation(reservation: CommonAreaReservation) {
  return daysUntilReservation(reservation.reservationDate) >= CANCELLATION_LIMIT_DAYS;
}

export default function ReservationsModule({ showToast, isInternetOnline }: ReservationsModuleProps) {
  const [reservations, setReservations] = useState<CommonAreaReservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState<'todos' | CommonAreaReservation['area']>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | CommonAreaReservation['status']>('todos');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    area: 'Churrasqueira' as CommonAreaReservation['area'],
    residentName: '',
    unit: '',
    reservationDate: new Date().toISOString().split('T')[0],
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

  const activeReservationOnSelectedDate = useMemo(() => {
    if (!formData.reservationDate) return undefined;
    return reservations.find(reservation =>
      reservation.status === 'reservada' &&
      reservation.reservationDate === formData.reservationDate
    );
  }, [formData.reservationDate, reservations]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.area) nextErrors.area = 'Selecione a area comum.';
    if (!formData.residentName.trim()) nextErrors.residentName = 'Informe o morador responsavel.';
    if (!formData.unit.trim()) nextErrors.unit = 'Informe o apartamento.';
    if (!formData.reservationDate) nextErrors.reservationDate = 'Informe a data da reserva.';
    if (!formData.startTime) nextErrors.startTime = 'Informe o horario inicial.';
    if (!formData.endTime) nextErrors.endTime = 'Informe o horario final.';
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      nextErrors.endTime = 'Horario final deve ser maior que o inicial.';
    }
    if (activeReservationOnSelectedDate) {
      nextErrors.reservationDate = `Ja existe reserva ativa para ${activeReservationOnSelectedDate.area} nesta data.`;
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
      showToast('Nao foi possivel cadastrar a reserva.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatus = async (reservation: CommonAreaReservation, status: CommonAreaReservation['status']) => {
    if (status === 'cancelada' && !canCancelReservation(reservation)) {
      showToast('A reserva so pode ser cancelada ate 2 dias antes da data do evento.', 'warning');
      return;
    }

    try {
      const updated = await updateReservationStatus(reservation.id, status);
      setReservations(prev => prev.map(item => item.id === reservation.id ? updated : item));
      showToast(status === 'cancelada' ? 'Reserva cancelada.' : 'Status da reserva atualizado.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Nao foi possivel atualizar a reserva.', 'error');
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
      showToast('Nao foi possivel excluir a reserva.', 'error');
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
                <input
                  value={formData.unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="11"
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
                onChange={(e) => setFormData(prev => ({ ...prev, reservationDate: e.target.value }))}
                className={`w-full bg-slate-950 border ${errors.reservationDate ? 'border-red-500' : 'border-slate-800'} text-slate-100 rounded-sm px-3 py-2.5 text-sm outline-none focus:border-emerald-500/60`}
              />
              {!errors.reservationDate && activeReservationOnSelectedDate && (
                <p className="text-[9px] text-amber-400 font-mono uppercase mt-1">
                  Data ocupada por {activeReservationOnSelectedDate.area} do Apto {activeReservationOnSelectedDate.unit}.
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por apto, morador, area ou observacao..."
              className="w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-sm text-sm outline-none focus:border-emerald-500/60 placeholder-slate-600"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value as typeof areaFilter)} className="bg-slate-950 border border-slate-800 text-slate-100 rounded-sm px-3 py-3 text-sm outline-none">
              <option value="todos">Todas as areas</option>
              {COMMON_AREAS.map(area => <option key={area} value={area}>{area}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="bg-slate-950 border border-slate-800 text-slate-100 rounded-sm px-3 py-3 text-sm outline-none">
              <option value="todos">Todos os status</option>
              <option value="reservada">Reservadas</option>
              <option value="concluida">Concluidas</option>
              <option value="cancelada">Canceladas</option>
            </select>
            <button onClick={loadReservations} disabled={isLoading} className="bg-slate-950 border border-slate-800 text-slate-300 hover:text-emerald-400 rounded-sm px-4 py-3 transition cursor-pointer">
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
          {filteredReservations.map(reservation => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onStatus={handleStatus}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {!isLoading && filteredReservations.length === 0 && (
          <div className="bg-[#0a0d14] border border-dashed border-slate-800/70 rounded-sm py-16 text-center text-slate-500">
            <PartyPopper size={30} className="mx-auto mb-3 text-slate-700" />
            <p className="text-xs uppercase tracking-widest font-bold">Nenhuma reserva encontrada</p>
            <p className="text-[11px] mt-1">Cadastre uma reserva ou ajuste os filtros de busca.</p>
          </div>
        )}
      </div>
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
}

const ReservationCard: React.FC<ReservationCardProps> = ({ reservation, onStatus, onDelete }) => {
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
        <span className={`text-[9px] uppercase font-bold ${reservation.syncStatus === 'pending' ? 'text-amber-400' : 'text-emerald-400'}`}>
          {reservation.syncStatus === 'pending' ? 'Pendente local' : 'Sincronizada'}
          {reservation.status === 'reservada' && !canCancel && (
            <span className="block text-red-400 mt-1">Cancelamento fora do prazo</span>
          )}
        </span>
        <div className="flex gap-2">
          {reservation.status === 'reservada' && (
            <>
              <button onClick={() => onStatus(reservation, 'concluida')} className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/25 text-emerald-400 rounded-sm text-[9px] uppercase font-bold tracking-wider cursor-pointer flex items-center gap-1">
                <Check size={11} /> Concluir
              </button>
              <button
                onClick={() => onStatus(reservation, 'cancelada')}
                disabled={!canCancel}
                title={canCancel ? 'Cancelar reserva' : 'Cancelamento permitido somente ate 2 dias antes do evento'}
                className="px-3 py-1.5 bg-red-950/35 hover:bg-red-950 disabled:bg-slate-950 disabled:text-slate-600 disabled:border-slate-800 border border-red-500/25 text-red-400 rounded-sm text-[9px] uppercase font-bold tracking-wider cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Ban size={11} /> Cancelar
              </button>
            </>
          )}
          <button onClick={() => onDelete(reservation)} className="p-1.5 bg-slate-950 hover:bg-red-950/50 border border-slate-800 hover:border-red-500/30 text-slate-500 hover:text-red-400 rounded-sm cursor-pointer" title="Excluir reserva">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}
