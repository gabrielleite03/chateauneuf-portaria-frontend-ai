/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Visit {
  id: string;
  name: string;
  document: string;
  company: string;
  visitorType: 'Visitante' | 'Prestador de Serviço' | 'Fornecedor' | 'Outro';
  unit: string;
  licensePlate?: string;
  entryTime: string; // ISO string
  exitTime?: string; // ISO string
  notes?: string;
  photo?: string; // Base64 image
  syncStatus: 'synced' | 'pending' | 'failed';
}

export interface Resident {
  unit: string; // APTO, e.g. "101"
  owner: string; // PROPRIETÁRIO
  phones: string; // TELEFONES
  tenant?: string; // INQUILINO
  familyMembers?: string; // FAMILIARES
  photo?: string; // Base64 image
  lastUpdated?: string; // ISO string
}

export interface DiaristaEntry {
  id: string;
  date: string; // Data
  name: string; // Nome
  rg: string; // RG
  unit: string; // Apto
  authorizedBy: string; // Autorizado por
  entryTime: string; // Hora da Entrada (ISO string or time string)
  exitTime?: string; // Hora da Saída (ISO string or time string)
  gatekeeper: string; // Porteiro
  photo?: string; // Base64 image
  syncStatus: 'synced' | 'pending' | 'failed';
}

export interface ScheduledService {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  document: string;
  company: string;
  unit: string;
  authorizedBy: string;
  arrivalTime?: string; // Time of arrival if completed
  notes?: string;
  status: 'agendado' | 'realizado' | 'cancelado';
  photo?: string; // Base64 image captured on entrance
  syncStatus: 'synced' | 'pending' | 'failed';
}

export interface KeyRecord {
  id: string;
  date: string; // yyyy-mm-dd
  local: string; // Local
  residentName: string; // Morador
  unit: string; // Apto
  pickupTime: string; // Hora entrega (e.g., 14:30)
  returnTime?: string; // Hora devolução (e.g., 18:00)
  gatekeeper: string; // Porteiro
  status: 'retirada' | 'devolvida';
  syncStatus: 'synced' | 'pending' | 'failed';
}

export interface SyncStatus {
  isInternetOnline: boolean;
  isBackendConnected: boolean;
  lastSyncTime: string | null;
  pendingSyncCount: number;
  syncHistory: Array<{
    id: string;
    timestamp: string;
    status: 'success' | 'warning' | 'error';
    message: string;
  }>;
}
