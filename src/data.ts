import { User, Category, Supplier, Customer, Product, Sale, StockHistory, Settings, Expense, Purchase } from './types';

export const DEFAULT_USERS = [
  { id: 1, username: 'admin', fullName: 'Administrator', role: 'Admin' as const, createdAt: '2026-01-01T10:00:00Z' },
  { id: 2, username: 'manager', fullName: 'Store Manager', role: 'Manager' as const, createdAt: '2026-01-05T11:30:00Z' },
  { id: 3, username: 'cashier', fullName: 'Lead Cashier', role: 'Cashier' as const, createdAt: '2026-02-10T09:00:00Z' },
];

// Helper to "hash" simple passwords
export function hashPassword(password: string): string {
  // A simple deterministic hash simulation for the web demo
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

// Simulating database storage for hashed passwords
export const DEFAULT_USER_PASSWORDS: Record<string, string> = {
  'admin': hashPassword('admin123'),
  'manager': hashPassword('manager123'),
  'cashier': hashPassword('cashier123'),
};

// Demo/sample business data has been cleared. The app now starts empty
// so you can populate it with your own real records. Login accounts above
// are unchanged.
export const DEFAULT_CATEGORIES: Category[] = [];
export const DEFAULT_SUPPLIERS: Supplier[] = [];

// Keep only the built-in "Walk-in Customer" (id: 1) which the POS relies on
// for cash sales that are not tied to a tracked customer account.
export const DEFAULT_CUSTOMERS: Customer[] = [
  { id: 1, name: 'Walk-in Customer', phone: '0000-0000000', email: 'walkin@shop.com', address: 'N/A', balance: 0, openingBalance: 0 },
];

export const DEFAULT_PRODUCTS: Product[] = [];

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  shopName: 'Smart Shop',
  shopAddress: 'Sector G-11 Markaz, Islamabad, Pakistan',
  phone: '051-111-222-333',
  taxPercentage: 5,
  currencySymbol: 'Rs.',
  receiptFooter: 'Thank you for shopping with us! Please come again.',
};

export const DEFAULT_SALES: Sale[] = [];
export const DEFAULT_STOCK_HISTORY: StockHistory[] = [];
export const DEFAULT_EXPENSES: Expense[] = [];
export const DEFAULT_PURCHASES: Purchase[] = [];

// Bump this when default data changes to force a one-time reset of stale
// localStorage values that were persisted from the old demo dataset.
export const DATA_VERSION = 2;

// Keys that should be wiped when the persisted data version is out of date.
// Login accounts (users / userPasswords) are intentionally NOT in this list so
// existing credentials keep working across a reset.
export const RESETTABLE_KEYS = [
  'products',
  'categories',
  'suppliers',
  'customers',
  'sales',
  'stockHistory',
  'loans',
  'loanPayments',
  'expenses',
  'purchases',
];

// Runs the one-time stale-data reset. Returns true if a reset happened.
// Safe to call repeatedly — it's a no-op once the stored version matches.
export function ensureDataVersion(): boolean {
  try {
    const storedVersion = localStorage.getItem('smart_shop_data_version');
    if (storedVersion !== String(DATA_VERSION)) {
      RESETTABLE_KEYS.forEach((k) => localStorage.removeItem(`smart_shop_${k}`));
      localStorage.setItem('smart_shop_data_version', String(DATA_VERSION));
      return true;
    }
  } catch (e) {
    console.error('Failed to reset stale data version', e);
  }
  return false;
}

// LocalStorage persistence loader/saver
export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(`smart_shop_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error loading key from localStorage', key, error);
    return defaultValue;
  }
}

export function saveToLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`smart_shop_${key}`, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving key to localStorage', key, error);
  }
}
