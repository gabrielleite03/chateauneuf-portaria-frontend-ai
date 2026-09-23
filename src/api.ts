import { AppVersion, CommonAreaReservation, KeyRecord, ShoppingDelivery, SyncStatus, Visit } from './types';

type BackendSyncStatus = {
  online: boolean;
  pending_count: number;
  last_synced_at: string | null;
  last_error: string;
};

type BackendAccessLog = {
  id: number;
  visitor_name: string;
  document: string;
  company: string;
  unit: string;
  service_type: string;
  vehicle_plate: string;
  photo: string;
  entry_at: string;
  exit_at: string | null;
  sync_status: 'PENDENTE_SYNC' | 'SINCRONIZADO' | 'ERRO_SYNC';
};

type CreateVisitInput = Omit<Visit, 'id' | 'entryTime' | 'syncStatus'>;
type CreateShoppingInput = Omit<ShoppingDelivery, 'id' | 'receivedAt' | 'withdrawnAt' | 'status' | 'syncStatus'>;
type CreateReservationInput = Omit<CommonAreaReservation, 'id' | 'status' | 'syncStatus' | 'signed' | 'createdAt' | 'updatedAt'>;

export type InternetAccount = { id:string; account_type:'resident'|'employee'; name?:string; apartment:string; username:string; enabled:boolean; expires_at:string; max_connections:number; download_kbps:number; upload_kbps:number; active_connections:number; generated_password?:string };

const syncStatusMap: Record<BackendAccessLog['sync_status'], Visit['syncStatus']> = {
  PENDENTE_SYNC: 'pending',
  SINCRONIZADO: 'synced',
  ERRO_SYNC: 'failed',
};

function toVisit(log: BackendAccessLog): Visit {
  return {
    id: String(log.id),
    name: log.visitor_name,
    document: log.document,
    company: log.company,
    visitorType: (log.service_type || 'Prestador de Servico') as Visit['visitorType'],
    unit: log.unit,
    licensePlate: log.vehicle_plate || undefined,
    photo: log.photo || undefined,
    entryTime: log.entry_at,
    exitTime: log.exit_at || undefined,
    syncStatus: syncStatusMap[log.sync_status] || 'pending',
  };
}

function toSyncStatus(status: BackendSyncStatus): SyncStatus {
  const syncHistory: SyncStatus['syncHistory'] = [];

  if (status.last_error) {
    syncHistory.push({
      id: 'sync-error',
      timestamp: new Date().toISOString(),
      status: 'error',
      message: status.last_error,
    });
  }

  return {
    isInternetOnline: status.online,
    isBackendConnected: true,
    lastSyncTime: status.last_synced_at,
    pendingSyncCount: status.pending_count,
    syncHistory,
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `Backend Go retornou HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  return toSyncStatus(await request<BackendSyncStatus>('/api/sync/status'));
}

export async function fetchBackendVersion(): Promise<AppVersion> {
  return request<AppVersion>('/api/version');
}

export async function fetchVisits(): Promise<Visit[]> {
  const logs = await request<BackendAccessLog[]>('/api/access-logs');
  return logs.map(toVisit);
}

export async function createVisit(input: CreateVisitInput): Promise<Visit> {
  const log = await request<BackendAccessLog>('/api/access-logs', {
    method: 'POST',
    body: JSON.stringify({
      visitor_name: input.name,
      document: input.document,
      company: input.company,
      unit: input.unit,
      service_type: input.visitorType,
      vehicle_plate: input.licensePlate || '',
      photo: input.photo || '',
      authorized_by: '',
      doorman: '',
    }),
  });

  return toVisit(log);
}

export async function checkoutVisit(id: string): Promise<Visit> {
  const log = await request<BackendAccessLog>(`/api/access-logs/${id}/checkout`, {
    method: 'PATCH',
  });

  return toVisit(log);
}

export async function runSync(): Promise<SyncStatus> {
  return toSyncStatus(await request<BackendSyncStatus>('/api/sync/run', { method: 'POST' }));
}

export async function fetchShoppingDeliveries(): Promise<ShoppingDelivery[]> {
  return request<ShoppingDelivery[]>('/api/shopping');
}

export async function fetchKeyRecords(): Promise<KeyRecord[]> {
  return request<KeyRecord[]>('/api/keys');
}

export async function createShoppingDelivery(input: CreateShoppingInput): Promise<ShoppingDelivery> {
  return request<ShoppingDelivery>('/api/shopping', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type DeliveryPhotoSession = { id: string; code: string; expiresAt: string };
export type DeliveryPhotoStatus = { status: 'waiting' | 'ready' | 'expired' | 'consumed'; photo?: string };

export async function createDeliveryPhotoSession(): Promise<DeliveryPhotoSession> {
  return request<DeliveryPhotoSession>('/api/delivery-photo-sessions', { method: 'POST' });
}

export async function fetchDeliveryPhotoStatus(id: string): Promise<DeliveryPhotoStatus> {
  return request<DeliveryPhotoStatus>(`/api/delivery-photo-sessions/${id}`);
}

export async function withdrawShoppingDelivery(id: string): Promise<ShoppingDelivery> {
  return request<ShoppingDelivery>('/api/shopping/withdraw', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export type DeliveryWithdrawalCode = { code: string; expiresAt: string };
export type DeliveryWithdrawalStatus = { status: 'waiting' | 'signed' | 'expired'; emailStatus?: 'pending' | 'sent' | 'failed' };

export async function createDeliveryWithdrawalCode(id: string): Promise<DeliveryWithdrawalCode> {
  return request<DeliveryWithdrawalCode>(`/api/shopping/${id}/withdrawal-signature-code`, { method: 'POST' });
}

export async function fetchDeliveryWithdrawalStatus(id: string): Promise<DeliveryWithdrawalStatus> {
  return request<DeliveryWithdrawalStatus>(`/api/shopping/${id}/withdrawal-signature-status`);
}

export async function fetchReservations(): Promise<CommonAreaReservation[]> {
  return request<CommonAreaReservation[]>('/api/reservations');
}

export type ReservationGuest = { id: string; name: string; document: string; confirmed: boolean };
export const fetchReservationGuests = (id: string) => request<ReservationGuest[]>(`/api/reservations/${encodeURIComponent(id)}/guests`);
export const addReservationGuest = (id: string, name: string, document: string) => request<ReservationGuest>(`/api/reservations/${encodeURIComponent(id)}/guests`, { method: 'POST', body: JSON.stringify({ name, document }) });
export const confirmReservationGuest = (id: string, guestID: string, confirmed: boolean) => request<{ confirmed: boolean }>(`/api/reservations/${encodeURIComponent(id)}/guests/${encodeURIComponent(guestID)}`, { method: 'PATCH', body: JSON.stringify({ confirmed }) });

export async function createReservation(input: CreateReservationInput): Promise<CommonAreaReservation> {
  return request<CommonAreaReservation>('/api/reservations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateReservationStatus(id: string, status: CommonAreaReservation['status']): Promise<CommonAreaReservation> {
  return request<CommonAreaReservation>('/api/reservations/status', {
    method: 'POST',
    body: JSON.stringify({ id, status }),
  });
}

export async function deleteReservation(id: string): Promise<void> {
  await request<{ status: string }>('/api/reservations/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export type ReservationSignatureCode = { code: string; expiresAt: string };
export async function createReservationSignatureCode(id: string): Promise<ReservationSignatureCode> {
  return request<ReservationSignatureCode>(`/api/reservations/${id}/signature-code`, { method: 'POST' });
}

export const fetchInternetAccounts = () => request<InternetAccount[]>('/api/internet-accounts');
export const createInternetAccount = (apartment:string) => request<InternetAccount>('/api/internet-accounts',{method:'POST',body:JSON.stringify({apartment})});
export const createEmployeeInternetAccount = (name:string,username:string,password:string,enrollmentPassword:string) => request<InternetAccount>('/api/internet-accounts/employees',{method:'POST',body:JSON.stringify({name,username,password,enrollment_password:enrollmentPassword})});
export const updateInternetAccount = (account:InternetAccount) => request<InternetAccount>(`/api/internet-accounts/${account.id}`,{method:'PUT',body:JSON.stringify({apartment:account.apartment,username:account.username,enabled:account.enabled,expires_at:account.expires_at})});
export const changeInternetPassword = (id:string) => request<{generated_password?:string;email_sent?:boolean}>(`/api/internet-accounts/${id}/password`,{method:'POST'});
export async function deleteInternetAccount(id:string):Promise<void>{const response=await fetch(`/api/internet-accounts/${id}`,{method:'DELETE'});if(!response.ok)throw new Error(`Backend Go retornou HTTP ${response.status}`)}
