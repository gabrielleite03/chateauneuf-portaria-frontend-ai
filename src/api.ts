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
type CreateReservationInput = Omit<CommonAreaReservation, 'id' | 'status' | 'syncStatus' | 'createdAt' | 'updatedAt'>;

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
    throw new Error(`Backend Go retornou HTTP ${response.status}`);
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

export async function withdrawShoppingDelivery(id: string): Promise<ShoppingDelivery> {
  return request<ShoppingDelivery>('/api/shopping/withdraw', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function fetchReservations(): Promise<CommonAreaReservation[]> {
  return request<CommonAreaReservation[]>('/api/reservations');
}

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
