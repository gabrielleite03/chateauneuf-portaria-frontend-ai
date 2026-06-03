import { SyncStatus, Visit } from './types';

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
