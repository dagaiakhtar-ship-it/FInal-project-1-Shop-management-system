import { Sale, Product, Customer, Supplier, Loan, LoanPayment, Expense, Purchase, Settings } from '../types';
import { generateBusinessSummaryPdf } from './pdfDocument';

export type DataManagementAction =
  | 'clear_sales'
  | 'clear_products'
  | 'clear_customers'
  | 'clear_loans'
  | 'clear_suppliers'
  | 'clear_purchases'
  | 'clear_reports'
  | 'reset_dashboard'
  | 'clear_activity_logs'
  | 'reset_settings'
  | 'clear_images'
  | 'factory_reset';

export interface DataActionConfig {
  id: DataManagementAction;
  label: string;
  emoji: string;
  description: string;
  dataAffected: string;
  confirmPhrase: 'DELETE' | 'DELETE ALL DATA';
  category: 'clear' | 'export' | 'reset';
}

export const DATA_ACTION_CONFIGS: DataActionConfig[] = [
  {
    id: 'clear_sales',
    label: 'Clear Sales',
    emoji: '🛒',
    description: 'Permanently delete all sales transaction records. Sales history and billing records will be removed.',
    dataAffected: 'Sales',
    confirmPhrase: 'DELETE',
    category: 'clear',
  },
  {
    id: 'clear_products',
    label: 'Clear Products',
    emoji: '📦',
    description: 'Permanently delete all products and stock history. Inventory will be empty.',
    dataAffected: 'Products, Stock History',
    confirmPhrase: 'DELETE',
    category: 'clear',
  },
  {
    id: 'clear_customers',
    label: 'Clear Customers',
    emoji: '👥',
    description: 'Remove all customer records except the built-in Walk-in Customer.',
    dataAffected: 'Customers',
    confirmPhrase: 'DELETE',
    category: 'clear',
  },
  {
    id: 'clear_loans',
    label: 'Clear Loans',
    emoji: '💳',
    description: 'Permanently delete all loan records, loan payments, and reset customer outstanding balances.',
    dataAffected: 'Loans, Loan Payments, Customer Balances',
    confirmPhrase: 'DELETE',
    category: 'clear',
  },
  {
    id: 'clear_suppliers',
    label: 'Clear Suppliers',
    emoji: '🏢',
    description: 'Permanently delete all supplier records.',
    dataAffected: 'Suppliers',
    confirmPhrase: 'DELETE',
    category: 'clear',
  },
  {
    id: 'clear_purchases',
    label: 'Clear Purchases',
    emoji: '📥',
    description: 'Permanently delete all supplier purchase records.',
    dataAffected: 'Purchases',
    confirmPhrase: 'DELETE',
    category: 'clear',
  },
  {
    id: 'clear_reports',
    label: 'Clear Reports',
    emoji: '📊',
    description: 'Clear expense records and cached report data used for business reporting.',
    dataAffected: 'Expenses, Report Cache',
    confirmPhrase: 'DELETE',
    category: 'clear',
  },
  {
    id: 'reset_dashboard',
    label: 'Reset Dashboard Statistics',
    emoji: '📈',
    description: 'Clear all transactional data that feeds the dashboard: sales, loans, loan payments, and expenses.',
    dataAffected: 'Sales, Loans, Loan Payments, Expenses',
    confirmPhrase: 'DELETE',
    category: 'clear',
  },
  {
    id: 'clear_activity_logs',
    label: 'Clear Activity Logs',
    emoji: '📝',
    description: 'Permanently delete all administrator activity log entries.',
    dataAffected: 'Activity Logs',
    confirmPhrase: 'DELETE',
    category: 'clear',
  },
  {
    id: 'reset_settings',
    label: 'Reset Application Settings',
    emoji: '⚙',
    description: 'Restore shop settings (name, address, tax, currency, receipt footer) to factory defaults.',
    dataAffected: 'Application Settings',
    confirmPhrase: 'DELETE',
    category: 'reset',
  },
  {
    id: 'clear_images',
    label: 'Clear Images',
    emoji: '🖼',
    description: 'Remove all locally stored product and shop images from browser storage.',
    dataAffected: 'Stored Images',
    confirmPhrase: 'DELETE',
    category: 'clear',
  },
  {
    id: 'factory_reset',
    label: 'Factory Reset (Delete Everything)',
    emoji: '🗑',
    description: 'Delete ALL application data including products, sales, customers, suppliers, settings, and reset user accounts to defaults. This cannot be undone.',
    dataAffected: 'All Application Data',
    confirmPhrase: 'DELETE ALL DATA',
    category: 'reset',
  },
];

export function getDeviceInfo(): string {
  const parts = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    `${window.screen.width}x${window.screen.height}`,
  ];
  return parts.join(' | ');
}

export function clearStoredImages(): number {
  let removed = 0;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('smart_shop_image_') || key.startsWith('smart_shop_images_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
    removed++;
  });
  return removed;
}

export function clearReportCache(): number {
  let removed = 0;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('smart_shop_report')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
    removed++;
  });
  return removed;
}

export interface CsvExportData {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  expenses: Expense[];
  purchases: Purchase[];
}

export function exportShopDataCsv(data: CsvExportData): void {
  let csv = 'data:text/csv;charset=utf-8,';
  csv += '=== SALES ===\n';
  csv += 'Invoice No,Customer ID,Date,Grand Total,Paid Amount,Payment Method\n';
  data.sales.forEach((s) => {
    csv += `"${s.invoiceNo}",${s.customerId ?? 1},"${s.saleDate}",${s.grandTotal},${s.paidAmount},"${s.paymentMethod}"\n`;
  });
  csv += '\n=== PRODUCTS ===\n';
  csv += 'ID,Name,Barcode,Sale Price,Quantity,Unit\n';
  data.products.forEach((p) => {
    csv += `${p.id},"${p.name}","${p.barcode}",${p.salePrice},${p.quantity},"${p.unit}"\n`;
  });
  csv += '\n=== CUSTOMERS ===\n';
  csv += 'ID,Name,Phone,Balance\n';
  data.customers.forEach((c) => {
    csv += `${c.id},"${c.name}","${c.phone}",${c.balance}\n`;
  });
  csv += '\n=== SUPPLIERS ===\n';
  csv += 'ID,Name,Company,Phone\n';
  data.suppliers.forEach((s) => {
    csv += `${s.id},"${s.name}","${s.companyName}","${s.phone}"\n`;
  });
  csv += '\n=== LOANS ===\n';
  csv += 'Invoice,Customer ID,Bill Amount,Remaining,Status\n';
  data.loans.forEach((l) => {
    csv += `"${l.invoiceNumber}",${l.customerId},${l.billAmount},${l.remainingBalance},"${l.status}"\n`;
  });
  csv += '\n=== EXPENSES ===\n';
  csv += 'Category,Amount,Date,Description\n';
  data.expenses.forEach((e) => {
    csv += `"${e.category}",${e.amount},"${e.expenseDate}","${e.description}"\n`;
  });
  csv += '\n=== PURCHASES ===\n';
  csv += 'Invoice,Supplier ID,Total,Paid,Status\n';
  data.purchases.forEach((p) => {
    csv += `"${p.invoiceNo}",${p.supplierId},${p.totalAmount},${p.paidAmount},"${p.status}"\n`;
  });

  const link = document.createElement('a');
  link.href = encodeURI(csv);
  link.download = `smart_shop_data_export_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface ReportSummaryData {
  settings: Settings;
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  expenses: Expense[];
  purchases: Purchase[];
}

export function exportReportsPdf(data: ReportSummaryData): void {
  generateBusinessSummaryPdf(data);
}
