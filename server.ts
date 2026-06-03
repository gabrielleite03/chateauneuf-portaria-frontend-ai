/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'db_portaria.json');

// Interface for visits matching src/types.ts
interface Visit {
  id: string;
  name: string;
  document: string;
  company: string;
  visitorType: 'Visitante' | 'Prestador de Serviço' | 'Fornecedor' | 'Outro';
  unit: string;
  licensePlate?: string;
  entryTime: string;
  exitTime?: string;
  notes?: string;
  photo?: string;
  syncStatus: 'synced' | 'pending' | 'failed';
}

interface Resident {
  unit: string;
  owner: string;
  phones: string;
  tenant?: string;
  familyMembers?: string;
  photo?: string;
  lastUpdated?: string;
}

interface DiaristaEntry {
  id: string;
  date: string;
  name: string;
  rg: string;
  unit: string;
  authorizedBy: string;
  entryTime: string;
  exitTime?: string;
  gatekeeper: string;
  photo?: string;
  syncStatus: 'synced' | 'pending' | 'failed';
}

interface ScheduledService {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  document: string;
  company: string;
  unit: string;
  authorizedBy: string;
  arrivalTime?: string;
  notes?: string;
  status: 'agendado' | 'realizado' | 'cancelado';
  photo?: string;
  syncStatus: 'synced' | 'pending' | 'failed';
}

interface KeyRecord {
  id: string;
  date: string; // YYYY-MM-DD
  local: string; // Local
  residentName: string; // Morador
  unit: string; // Apto
  pickupTime: string; // Hora entrega
  returnTime?: string; // Hora devolução
  gatekeeper: string; // Porteiro
  status: 'retirada' | 'devolvida';
  syncStatus: 'synced' | 'pending' | 'failed';
}

interface DBStructure {
  visits: Visit[];
  residents?: Resident[];
  diaristas?: DiaristaEntry[];
  scheduledServices?: ScheduledService[];
  keyRecords?: KeyRecord[];
  isInternetOnline: boolean;
  lastSyncTime: string | null;
  syncHistory: Array<{
    id: string;
    timestamp: string;
    status: 'success' | 'warning' | 'error';
    message: string;
  }>;
}

const DEFAULT_RESIDENTS: Resident[] = [
  { unit: "11", owner: "Carlos Alberto de Souza", phones: "(11) 98765-4321", tenant: "Ana Carolina Nogueira", familyMembers: "Gustavo Nogueira (filho)" },
  { unit: "12", owner: "Maria Helena Ramos", phones: "(11) 99123-0987", tenant: "", familyMembers: "Pedro Ramos (marido), Clara Ramos (filha)" },
  { unit: "13", owner: "Joaquim Barbosa", phones: "(11) 97712-4455", tenant: "", familyMembers: "Marta Barbosa (esposa)" },
  { unit: "14", owner: "Elis Regina Santos", phones: "(11) 98877-6655", tenant: "Rodrigo Lacerda", familyMembers: "" },
  { unit: "21", owner: "José Bonifácio", phones: "(11) 96544-3322", tenant: "", familyMembers: "" },
  { unit: "22", owner: "Amanda Linhares", phones: "(11) 97123-4567", tenant: "", familyMembers: "Thiago Linhares (irmão)" },
  { unit: "23", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "24", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "31", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "32", owner: "Augusto dos Anjos", phones: "(11) 98211-5342", tenant: "", familyMembers: "Beatriz dos Anjos (esposa)" },
  { unit: "33", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "34", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "41", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "42", owner: "Marcelo Gleiser", phones: "(11) 99234-5678", tenant: "", familyMembers: "Sandra Gleiser (filha)" },
  { unit: "43", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "44", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "51", owner: "Robert de Souza", phones: "(11) 98112-9988", tenant: "Julia Fernandes", familyMembers: "" },
  { unit: "52", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "53", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "54", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "61", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "62", owner: "Luzia da Silva", phones: "(11) 99888-7766", tenant: "Marcos Lima", familyMembers: "" },
  { unit: "63", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "64", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "71", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "72", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "73", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "74", owner: "Gisele Bündchen", phones: "(11) 99111-2233", tenant: "", familyMembers: "Benjamin (filho), Vivian (filha)" },
  { unit: "81", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "82", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "83", owner: "", phones: "", tenant: "", familyMembers: "" },
  { unit: "84", owner: "Fernando Sabino", phones: "(11) 99321-4567", tenant: "", familyMembers: "Carla Sabino (filha)" }
];

const DEFAULT_DIARISTAS: DiaristaEntry[] = [
  {
    id: "d-1",
    date: new Date(Date.now() - 48 * 3600 * 1000).toISOString().split('T')[0],
    name: "Maria das Dores",
    rg: "32.456.789-0",
    unit: "11",
    authorizedBy: "Carlos Alberto de Souza (Proprietário)",
    entryTime: "07:45",
    exitTime: "16:30",
    gatekeeper: "Seu Manuel",
    syncStatus: "synced"
  },
  {
    id: "d-2",
    date: new Date().toISOString().split('T')[0],
    name: "Lúcia Helena de Souza",
    rg: "41.987.654-1",
    unit: "32",
    authorizedBy: "Augusto dos Anjos (Morador)",
    entryTime: "08:15",
    gatekeeper: "Porteiro Alencar",
    syncStatus: "synced"
  }
];

const DEFAULT_SCHEDULES: ScheduledService[] = [
  {
    id: "s-sch-1",
    date: new Date().toISOString().split('T')[0],
    name: "Roberto de Almeida",
    document: "28.543.876-2",
    company: "Claro Instalações",
    unit: "12",
    authorizedBy: "Maria Helena Ramos",
    status: "agendado",
    syncStatus: "synced"
  },
  {
    id: "s-sch-2",
    date: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0], // tomorrow
    name: "Juliana Mendes",
    document: "43.987.123-5",
    company: "Ar Condicionado ArFrio",
    unit: "74",
    authorizedBy: "Gisele Bündchen",
    notes: "Instalação de equipamento split na suíte principal",
    status: "agendado",
    syncStatus: "synced"
  }
];

// Initial mock data to display beautiful UI state immediately
const initialDB: DBStructure = {
  visits: [
    {
      id: "v-1",
      name: "Augusto dos Anjos",
      document: "45.098.231-x",
      company: "Pinturas Pinheiro",
      visitorType: "Prestador de Serviço",
      unit: "Apto 32",
      licensePlate: "BRA2E19",
      entryTime: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), // 3 hours ago, still in
      syncStatus: "synced"
    },
    {
      id: "v-2",
      name: "Cleber Roberto da Silva",
      document: "321.456.987-10",
      company: "Conserta Tudo Ltda",
      visitorType: "Prestador de Serviço",
      unit: "Apto 11",
      entryTime: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString(), // 1.5 hours ago, still in
      syncStatus: "synced"
    },
    {
      id: "v-3",
      name: "Renata Vasconcellos",
      document: "50.123.456-7",
      company: "Sul Gas Inspect",
      visitorType: "Fornecedor",
      unit: "Área Comum - Gás",
      licensePlate: "NJK9I21",
      entryTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago, still in
      syncStatus: "synced"
    },
    {
      id: "v-4",
      name: "Marcos Aurelio Antunes",
      document: "21.098.112-2",
      company: "Jardins & Flores",
      visitorType: "Prestador de Serviço",
      unit: "Área Externa",
      entryTime: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
      exitTime: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      notes: "Corte de grama e limpeza geral do gazebo",
      syncStatus: "synced"
    },
    {
      id: "v-5",
      name: "Gabriel Santos Neves",
      document: "312.876.321-44",
      company: "Mercado Pago Entregas",
      visitorType: "Fornecedor",
      unit: "Apto 84",
      entryTime: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
      exitTime: new Date(Date.now() - 9.8 * 3600 * 1000).toISOString(),
      notes: "Entrega de mercadoria de grande volume",
      syncStatus: "synced"
    },
    {
      id: "v-6",
      name: "Tatiana de Alencar",
      document: "33.222.111-9",
      company: "Enel Energia",
      visitorType: "Outro",
      unit: "Subestação Elétrica",
      licensePlate: "EFP2A44",
      entryTime: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      exitTime: new Date(Date.now() - 23 * 3600 * 1000).toISOString(),
      notes: "Troca e manutenção preventiva de medidores",
      syncStatus: "synced"
    }
  ],
  residents: DEFAULT_RESIDENTS,
  diaristas: DEFAULT_DIARISTAS,
  scheduledServices: DEFAULT_SCHEDULES,
  keyRecords: [
    {
      id: "k-1",
      date: new Date().toISOString().split('T')[0],
      local: "Salão de Festas",
      residentName: "Ana Carolina Nogueira",
      unit: "11",
      pickupTime: "10:30",
      gatekeeper: "Porteiro Alencar",
      status: "retirada",
      syncStatus: "synced"
    },
    {
      id: "k-2",
      date: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
      local: "Academia de Ginástica",
      residentName: "Pedro Ramos",
      unit: "12",
      pickupTime: "08:00",
      returnTime: "09:30",
      gatekeeper: "Seu Manuel",
      status: "devolvida",
      syncStatus: "synced"
    }
  ],
  isInternetOnline: true,
  lastSyncTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // synced 12 minutes ago
  syncHistory: [
    {
      id: "s-1",
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      status: "success",
      message: "Sincronização completa de 2 registros novos com Google Sheets"
    },
    {
      id: "s-2",
      timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      status: "success",
      message: "Verificação periódica: SQLite e Google Sheets em plena harmonia"
    }
  ]
};

// Helper to loads DB
function loadDB(): DBStructure {
  try {
    let db: DBStructure;
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
    } else {
      // Write and returns default data
      db = initialDB;
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
      return db;
    }

    // Migration: make sure residents list exists
    if (!db.residents || db.residents.length === 0) {
      db.residents = DEFAULT_RESIDENTS;
      saveDB(db);
    } else {
      // Migrate 3-digit to 2-digit units if found (e.g. "101" -> "11")
      let migrated = false;
      db.residents = db.residents.map(r => {
        if (r.unit.length === 3 && r.unit.substring(1, 2) === '0') {
          migrated = true;
          return {
            ...r,
            unit: r.unit.slice(0, 1) + r.unit.slice(2)
          };
        }
        return r;
      });

      // Migrate existing visits units from three figures to two
      db.visits = db.visits.map(v => {
        const match = v.unit.match(/^(Apto\s+)?(\d)0(\d)$/i);
        if (match) {
          migrated = true;
          const prefix = match[1] || '';
          return {
            ...v,
            unit: `${prefix}${match[2]}${match[3]}`
          };
        }
        // Also handle Apto 1102 to Apto 84 or similar as fallback
        if (v.unit.includes("1102")) {
          migrated = true;
          return {
            ...v,
            unit: v.unit.replace("1102", "84")
          };
        }
        return v;
      });

      if (migrated) {
        saveDB(db);
      }
    }

    // Migration: make sure diaristas list exists
    if (!db.diaristas || db.diaristas.length === 0) {
      db.diaristas = DEFAULT_DIARISTAS;
      saveDB(db);
    }

    // Migration: make sure scheduledServices list exists
    if (!db.scheduledServices || db.scheduledServices.length === 0) {
      db.scheduledServices = DEFAULT_SCHEDULES;
      saveDB(db);
    }

    // Migration: make sure keyRecords list exists
    if (!db.keyRecords) {
      db.keyRecords = [
        {
          id: "k-1",
          date: new Date().toISOString().split('T')[0],
          local: "Salão de Festas",
          residentName: "Ana Carolina Nogueira",
          unit: "11",
          pickupTime: "10:30",
          gatekeeper: "Porteiro Alencar",
          status: "retirada",
          syncStatus: "synced"
        },
        {
          id: "k-2",
          date: new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0],
          local: "Academia de Ginástica",
          residentName: "Pedro Ramos",
          unit: "12",
          pickupTime: "08:00",
          returnTime: "09:30",
          gatekeeper: "Seu Manuel",
          status: "devolvida",
          syncStatus: "synced"
        }
      ];
      saveDB(db);
    }

    return db;
  } catch (error) {
    console.error("Error reading database file, returning initial mock data", error);
    return initialDB;
  }
}

// Helper to save DB
function saveDB(db: DBStructure) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (error) {
    console.error("Failed to save database file", error);
  }
}

// Initialize db and setup JSON parsing
app.use(express.json());

// API Endpoints
app.get('/api/status', (req, res) => {
  const db = loadDB();
  const pendingVisits = db.visits.filter(v => v.syncStatus === 'pending' || v.syncStatus === 'failed').length;
  const pendingDiaristas = (db.diaristas || []).filter(d => d.syncStatus === 'pending' || d.syncStatus === 'failed').length;
  const pendingSchedules = (db.scheduledServices || []).filter(s => s.syncStatus === 'pending' || s.syncStatus === 'failed').length;
  const pendingCount = pendingVisits + pendingDiaristas + pendingSchedules;
  res.json({
    isInternetOnline: db.isInternetOnline,
    isBackendConnected: true,
    lastSyncTime: db.lastSyncTime,
    pendingSyncCount: pendingCount,
    syncHistory: db.syncHistory
  });
});

app.post('/api/status/toggle-internet', (req, res) => {
  const db = loadDB();
  db.isInternetOnline = !db.isInternetOnline;
  
  if (db.isInternetOnline) {
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "success",
      message: "Internet reestabelecida. Serviços em nuvem reconectados com sucesso."
    });
  } else {
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "warning",
      message: "Conexão de internet perdida com Google Sheets e Drive. Salvando em SQLite local."
    });
  }
  
  saveDB(db);
  res.json({ success: true, isInternetOnline: db.isInternetOnline });
});

app.get('/api/visits', (req, res) => {
  const db = loadDB();
  res.json(db.visits);
});

app.get('/api/residents', (req, res) => {
  const db = loadDB();
  res.json(db.residents || []);
});

app.get('/api/diaristas', (req, res) => {
  const db = loadDB();
  res.json(db.diaristas || []);
});

app.post('/api/diaristas', (req, res) => {
  const db = loadDB();
  const { date, name, rg, unit, authorizedBy, entryTime, gatekeeper, photo } = req.body;

  if (!name || !rg || !unit || !authorizedBy || !gatekeeper) {
    return res.status(400).json({ error: "Campos obrigatórios não preenchidos." });
  }

  const newEntry: DiaristaEntry = {
    id: "d-" + Date.now(),
    date: date || new Date().toISOString().split('T')[0],
    name,
    rg,
    unit,
    authorizedBy,
    entryTime: entryTime || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    gatekeeper,
    photo: photo || undefined,
    syncStatus: db.isInternetOnline ? 'synced' : 'pending'
  };

  if (!db.diaristas) {
    db.diaristas = [];
  }

  db.diaristas.unshift(newEntry);

  if (db.isInternetOnline) {
    db.lastSyncTime = new Date().toISOString();
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "success",
      message: `Google Sheets: Entrada de diarista ${name} integrada para o Apto ${unit}.`
    });
  } else {
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "warning",
      message: `Sem internet: Entrada de diarista ${name} gravada no SQLite local.`
    });
  }

  saveDB(db);
  res.status(201).json(newEntry);
});

app.post('/api/diaristas/exit', (req, res) => {
  const db = loadDB();
  const { id, exitTime } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID de diarista é obrigatório." });
  }

  if (!db.diaristas) {
    db.diaristas = [];
  }

  const index = db.diaristas.findIndex(d => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Registro de diarista não encontrado." });
  }

  const diarista = db.diaristas[index];
  if (diarista.exitTime) {
    return res.status(400).json({ error: "Esta diarista já registrou saída anteriormente." });
  }

  diarista.exitTime = exitTime || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (db.isInternetOnline) {
    diarista.syncStatus = 'synced';
    db.lastSyncTime = new Date().toISOString();
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "success",
      message: `Google Sheets: Saída de diarista ${diarista.name} atualizada com sucesso.`
    });
  } else {
    diarista.syncStatus = 'pending';
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "warning",
      message: `Sem internet: Saída de diarista ${diarista.name} gravada pendente de nuvem.`
    });
  }

  saveDB(db);
  res.json(diarista);
});

app.get('/api/scheduled-services', (req, res) => {
  const db = loadDB();
  res.json(db.scheduledServices || []);
});

app.post('/api/scheduled-services', (req, res) => {
  const db = loadDB();
  const { date, name, document, company, unit, authorizedBy, notes } = req.body;

  if (!date || !name || !document || !company || !unit || !authorizedBy) {
    return res.status(400).json({ error: "Campos obrigatórios não preenchidos." });
  }

  const newSchedule: ScheduledService = {
    id: "sch-" + Date.now(),
    date,
    name,
    document,
    company,
    unit,
    authorizedBy,
    notes: notes || undefined,
    status: 'agendado',
    syncStatus: db.isInternetOnline ? 'synced' : 'pending'
  };

  if (!db.scheduledServices) {
    db.scheduledServices = [];
  }

  db.scheduledServices.unshift(newSchedule);

  if (db.isInternetOnline) {
    db.lastSyncTime = new Date().toISOString();
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "success",
      message: `Google Sheets: Agendamento de ${name} (${company}) integrado para o Apto ${unit}.`
    });
  } else {
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "warning",
      message: `Sem internet: Agendamento de ${name} salvo no SQLite local.`
    });
  }

  saveDB(db);
  res.status(201).json(newSchedule);
});

app.post('/api/scheduled-services/status', (req, res) => {
  const db = loadDB();
  const { id, status, photo, arrivalTime } = req.body;

  if (!id || !status) {
    return res.status(400).json({ error: "ID e Status são obrigatórios." });
  }

  if (!db.scheduledServices) {
    db.scheduledServices = [];
  }

  const index = db.scheduledServices.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Agendamento não encontrado." });
  }

  const schedule = db.scheduledServices[index];
  schedule.status = status;
  if (status === 'realizado') {
    schedule.arrivalTime = arrivalTime || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (photo) {
      schedule.photo = photo;
    }
  }

  if (db.isInternetOnline) {
    schedule.syncStatus = 'synced';
    db.lastSyncTime = new Date().toISOString();
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "success",
      message: `Google Sheets: Agendamento de ${schedule.name} marcado como ${status}.`
    });
  } else {
    schedule.syncStatus = 'pending';
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "warning",
      message: `Sem internet: Status do agendamento de ${schedule.name} salvo no SQLite.`
    });
  }

  saveDB(db);
  res.json(schedule);
});

app.post('/api/scheduled-services/delete', (req, res) => {
  const db = loadDB();
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID é obrigatório." });
  }

  if (!db.scheduledServices) {
    db.scheduledServices = [];
  }

  const index = db.scheduledServices.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Agendamento não encontrado." });
  }

  const deleted = db.scheduledServices.splice(index, 1)[0];

  db.syncHistory.unshift({
    id: "sh-" + Date.now(),
    timestamp: new Date().toISOString(),
    status: "success",
    message: `Agendamento de ${deleted.name} removido do sistema.`
  });

  saveDB(db);
  res.json({ success: true, deletedId: id });
});

// Key Control Endpoints (Controle de Chaves)
app.get('/api/keys', (req, res) => {
  const db = loadDB();
  res.json(db.keyRecords || []);
});

app.post('/api/keys', (req, res) => {
  const db = loadDB();
  const { date, local, residentName, unit, pickupTime, gatekeeper } = req.body;

  if (!local || !residentName || !unit || !pickupTime || !gatekeeper) {
    return res.status(400).json({ error: "Campos obrigatórios não preenchidos." });
  }

  const newKeyRecord: KeyRecord = {
    id: "k-" + Date.now(),
    date: date || new Date().toISOString().split('T')[0],
    local,
    residentName,
    unit,
    pickupTime,
    gatekeeper,
    status: 'retirada',
    syncStatus: db.isInternetOnline ? 'synced' : 'pending'
  };

  if (!db.keyRecords) {
    db.keyRecords = [];
  }

  db.keyRecords.unshift(newKeyRecord);

  if (db.isInternetOnline) {
    db.lastSyncTime = new Date().toISOString();
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "success",
      message: `Google Sheets: Retirada de chave para ${local} pelo morador ${residentName} (Apto ${unit}) sincronizada.`
    });
  } else {
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "warning",
      message: `Sem internet: Retirada de chave para ${local} registrada no SQLite local.`
    });
  }

  saveDB(db);
  res.status(201).json(newKeyRecord);
});

app.post('/api/keys/return', (req, res) => {
  const db = loadDB();
  const { id, returnTime } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID é obrigatório para registrar a devolução." });
  }

  if (!db.keyRecords) {
    db.keyRecords = [];
  }

  const index = db.keyRecords.findIndex(k => k.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Registro de controle de chave não encontrado." });
  }

  const record = db.keyRecords[index];
  record.status = 'devolvida';
  record.returnTime = returnTime || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (db.isInternetOnline) {
    record.syncStatus = 'synced';
    db.lastSyncTime = new Date().toISOString();
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "success",
      message: `Google Sheets: Chave do ${record.local} devolvida pelo morador ${record.residentName}.`
    });
  } else {
    record.syncStatus = 'pending';
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "warning",
      message: `Sem internet: Devolução da chave do ${record.local} salva localmente.`
    });
  }

  saveDB(db);
  res.json(record);
});

app.post('/api/keys/delete', (req, res) => {
  const db = loadDB();
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID é obrigatório." });
  }

  if (!db.keyRecords) {
    db.keyRecords = [];
  }

  const index = db.keyRecords.findIndex(k => k.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Registro de controle de chave não encontrado." });
  }

  const deleted = db.keyRecords.splice(index, 1)[0];

  db.syncHistory.unshift({
    id: "sh-" + Date.now(),
    timestamp: new Date().toISOString(),
    status: "success",
    message: `Aviso: Registro de chave (${deleted.local}) removido do sistema.`
  });

  saveDB(db);
  res.json({ success: true, deletedId: id });
});

app.post('/api/residents', (req, res) => {
  const db = loadDB();
  const { unit, owner, phones, tenant, familyMembers, photo } = req.body;

  if (!unit) {
    return res.status(400).json({ error: "O número do apartamento (APTO) é obrigatório." });
  }

  if (!db.residents) {
    db.residents = [];
  }

  const index = db.residents.findIndex(r => r.unit === unit);
  
  const updatedResident: Resident = {
    unit,
    owner: owner || "",
    phones: phones || "",
    tenant: tenant || "",
    familyMembers: familyMembers || "",
    photo: photo || undefined,
    lastUpdated: new Date().toISOString()
  };

  if (index !== -1) {
    db.residents[index] = updatedResident;
  } else {
    db.residents.push(updatedResident);
  }

  if (db.isInternetOnline) {
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "success",
      message: `Google Sheets: Cadastro de moradores do Apto ${unit} atualizado com sucesso.`
    });
  } else {
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "warning",
      message: `Sem internet: Cadastro de moradores do Apto ${unit} gravado temporariamente em SQLite local.`
    });
  }

  saveDB(db);
  res.json(updatedResident);
});

app.post('/api/entry', (req, res) => {
  const db = loadDB();
  const { name, document, company, visitorType, unit, licensePlate, notes, photo } = req.body;
  
  if (!name || !document || !company || !visitorType || !unit) {
    return res.status(400).json({ error: "Campos obrigatórios não preenchidos." });
  }

  const newVisit: Visit = {
    id: "v-" + Date.now(),
    name,
    document,
    company,
    visitorType,
    unit,
    licensePlate: licensePlate || undefined,
    entryTime: new Date().toISOString(),
    notes: notes || undefined,
    photo: photo || undefined,
    syncStatus: db.isInternetOnline ? 'synced' : 'pending'
  };

  db.visits.unshift(newVisit);

  // If internet is online, simulate immediate sync, otherwise log pending
  if (db.isInternetOnline) {
    db.lastSyncTime = new Date().toISOString();
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "success",
      message: `Google Sheets: Entrada registrada para ${name} (${company}).`
    });
  } else {
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "warning",
      message: `Sem internet: Entrada de ${name} salva em SQLite local (pendente de nuvem).`
    });
  }

  saveDB(db);
  res.status(201).json(newVisit);
});

app.post('/api/exit', (req, res) => {
  const db = loadDB();
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID de visita obrigatório." });
  }

  const visitIndex = db.visits.findIndex(v => v.id === id);
  if (visitIndex === -1) {
    return res.status(404).json({ error: "Visita não encontrada." });
  }

  const visit = db.visits[visitIndex];
  if (visit.exitTime) {
    return res.status(400).json({ error: "Este visitante já registrou saída anteriormente." });
  }

  visit.exitTime = new Date().toISOString();
  
  if (db.isInternetOnline) {
    visit.syncStatus = 'synced';
    db.lastSyncTime = new Date().toISOString();
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "success",
      message: `Google Sheets: Saída registrada para ${visit.name}.`
    });
  } else {
    visit.syncStatus = 'pending';
    db.syncHistory.unshift({
      id: "sh-" + Date.now(),
      timestamp: new Date().toISOString(),
      status: "warning",
      message: `Sem internet: Saída de ${visit.name} salva no SQLite (pendente de sincronização).`
    });
  }

  saveDB(db);
  res.json(visit);
});

app.post('/api/sync', (req, res) => {
  const db = loadDB();
  
  if (!db.isInternetOnline) {
    return res.status(400).json({ 
      error: "Não é possível sincronizar: Backend Go detectou que a conexão com a internet está indisponível." 
    });
  }

  // Count pending records to sync from SQLite to sheets
  const pendingVisits = db.visits.filter(v => v.syncStatus === 'pending' || v.syncStatus === 'failed');
  const pendingDiaristas = (db.diaristas || []).filter(d => d.syncStatus === 'pending' || d.syncStatus === 'failed');
  const pendingSchedules = (db.scheduledServices || []).filter(s => s.syncStatus === 'pending' || s.syncStatus === 'failed');
  const count = pendingVisits.length + pendingDiaristas.length + pendingSchedules.length;

  // Mark all as synced
  db.visits.forEach(v => {
    if (v.syncStatus === 'pending' || v.syncStatus === 'failed') {
      v.syncStatus = 'synced';
    }
  });

  if (db.diaristas) {
    db.diaristas.forEach(d => {
      if (d.syncStatus === 'pending' || d.syncStatus === 'failed') {
        d.syncStatus = 'synced';
      }
    });
  }

  if (db.scheduledServices) {
    db.scheduledServices.forEach(s => {
      if (s.syncStatus === 'pending' || s.syncStatus === 'failed') {
        s.syncStatus = 'synced';
      }
    });
  }

  db.lastSyncTime = new Date().toISOString();
  db.syncHistory.unshift({
    id: "sh-" + Date.now(),
    timestamp: new Date().toISOString(),
    status: "success",
    message: count > 0 
      ? `Sincronização manual conluída: ${count} registros integrados ao Google Sheets e Drive.`
      : "Sincronização manual efetuada. Nenhum registro local pendente."
  });

  saveDB(db);
  res.json({
    success: true,
    syncedCount: count,
    lastSyncTime: db.lastSyncTime
  });
});

// Start our server integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom backend running on port ${PORT}`);
  });
}

startServer();
