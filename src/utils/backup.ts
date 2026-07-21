import {
  User,
  Product,
  Category,
  Supplier,
  Customer,
  Sale,
  StockHistory,
  Settings,
  Loan,
  LoanPayment,
  Expense,
  Purchase,
} from '../types';

export const BACKUP_COLLECTION_KEYS = [
  'products',
  'categories',
  'suppliers',
  'customers',
  'sales',
  'stockHistory',
  'loans',
  'loanPayments',
  'settings',
  'users',
  'userPasswords',
  'expenses',
  'purchases',
] as const;

export type BackupCollectionKey = (typeof BACKUP_COLLECTION_KEYS)[number];

export interface BackupCollections {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  customers: Customer[];
  sales: Sale[];
  stockHistory: StockHistory[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  settings: Settings;
  users: User[];
  userPasswords: Record<string, string>;
  expenses: Expense[];
  purchases: Purchase[];
}

export interface BackupPayload {
  meta: {
    formatVersion: 1;
    appName: string;
    exportedAt: string;
    recordCounts: Record<string, number>;
  };
  data: BackupCollections;
}

export interface BackupExportResult {
  recordCounts: Record<string, number>;
  fileSizeBytes: number;
  filename: string;
}

function countRecords(collections: BackupCollections): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of BACKUP_COLLECTION_KEYS) {
    const value = collections[key];
    counts[key] = Array.isArray(value) ? value.length : 1;
  }
  return counts;
}

export function buildBackupPayload(collections: BackupCollections): BackupPayload {
  const recordCounts = countRecords(collections);
  return {
    meta: {
      formatVersion: 1,
      appName: 'Smart Shop Management System',
      exportedAt: new Date().toISOString(),
      recordCounts,
    },
    data: collections,
  };
}

export function formatBackupFilename(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `smart_shop_backup_${y}-${m}-${d}_${h}-${min}.json`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function downloadJson(filename: string, payload: BackupPayload): number {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  return blob.size;
}

export function exportBackup(collections: BackupCollections): BackupExportResult {
  const payload = buildBackupPayload(collections);
  const filename = formatBackupFilename(new Date(payload.meta.exportedAt));
  const fileSizeBytes = downloadJson(filename, payload);
  return {
    recordCounts: payload.meta.recordCounts,
    fileSizeBytes,
    filename,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateBackupPayload(
  raw: unknown
): { ok: true; payload: BackupPayload } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Invalid backup file: expected a JSON object.' };
  }

  const meta = raw.meta;
  if (!isPlainObject(meta)) {
    return { ok: false, error: 'Invalid backup file: missing meta section.' };
  }

  if (meta.formatVersion !== 1) {
    return { ok: false, error: `Unsupported backup format version: ${String(meta.formatVersion)}` };
  }

  if (typeof meta.exportedAt !== 'string') {
    return { ok: false, error: 'Invalid backup file: missing export timestamp.' };
  }

  const data = raw.data;
  if (!isPlainObject(data)) {
    return { ok: false, error: 'Invalid backup file: missing data section.' };
  }

  const arrayKeys: BackupCollectionKey[] = [
    'products',
    'categories',
    'suppliers',
    'customers',
    'sales',
    'stockHistory',
    'loans',
    'loanPayments',
    'users',
    'expenses',
    'purchases',
  ];

  for (const key of arrayKeys) {
    if (!(key in data)) {
      return { ok: false, error: `Invalid backup file: missing "${key}" collection.` };
    }
    if (!Array.isArray(data[key])) {
      return { ok: false, error: `Invalid backup file: "${key}" must be an array.` };
    }
  }

  if (!('settings' in data) || !isPlainObject(data.settings)) {
    return { ok: false, error: 'Invalid backup file: settings must be an object.' };
  }

  if (!('userPasswords' in data) || !isPlainObject(data.userPasswords)) {
    return { ok: false, error: 'Invalid backup file: userPasswords must be an object.' };
  }

  return { ok: true, payload: raw as unknown as BackupPayload };
}

export function getBackupSummary(collections: BackupCollections): {
  recordCounts: Record<string, number>;
  totalRecords: number;
} {
  const recordCounts = countRecords(collections);
  const totalRecords = Object.values(recordCounts).reduce((sum, n) => sum + n, 0);
  return { recordCounts, totalRecords };
}
