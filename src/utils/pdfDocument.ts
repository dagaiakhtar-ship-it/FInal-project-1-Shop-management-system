import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Settings, Sale, Customer, Loan, LoanPayment, Expense, Purchase, Product } from '../types';
import {
  getInvoiceStatus,
  getSaleRemaining,
  getTotalSales,
  getCashReceipts,
  getOutstandingReceivables,
} from './finance';

export type ReportTab = 'sales' | 'customers' | 'loans' | 'daily' | 'monthly';

export interface LedgerRow {
  date: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CustomerStatementSummary {
  totalPurchases: number;
  totalPaid: number;
  totalLoanGiven: number;
  currentOutstanding: number;
}

function addPageFooters(doc: jsPDF, settings: Settings): void {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`${settings.shopName} | Generated: ${new Date().toLocaleString()}`, 14, pageHeight - 10);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    doc.text('Powered by Smart Shop Management System', pageWidth / 2, pageHeight - 6, { align: 'center' });
    doc.setTextColor(0);
  }
}

function addDocumentHeader(doc: jsPDF, settings: Settings, title: string): number {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.shopName, 105, 18, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.shopAddress, 105, 24, { align: 'center' });
  doc.text(`Tel: ${settings.phone}`, 105, 29, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 105, 38, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Report Date: ${new Date().toLocaleString()}`, 105, 44, { align: 'center' });
  doc.setDrawColor(200);
  doc.line(14, 48, 196, 48);
  return 52;
}

export interface ReportPdfData {
  settings: Settings;
  tab: ReportTab;
  sales: Sale[];
  customers: Customer[];
  loans: Loan[];
  sym: string;
  todayGross: number;
  todayCashCollected: number;
  todayLoansGranted: number;
  todayLoansRecovered: number;
  monthlyGross: number;
  monthlyCashCollected: number;
  monthlyLoansGranted: number;
  monthlyLoansRecovered: number;
}

export function generateReportTabPdf(data: ReportPdfData): void {
  const { settings, tab, sym } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const titles: Record<ReportTab, string> = {
    sales: 'Sales Report',
    customers: 'Customer Report',
    loans: 'Loan Report',
    daily: 'Daily Summary Report',
    monthly: 'Monthly Summary Report',
  };

  const startY = addDocumentHeader(doc, settings, titles[tab]);

  if (tab === 'sales') {
    autoTable(doc, {
      startY,
      head: [['Invoice', 'Customer', 'Date', 'Bill Amt', 'Paid', 'Loan Bal', 'Status']],
      body: data.sales.map((s) => {
        // PDF reports are point-in-time snapshots, so they derive status from
        // the sale's own paidAmount/grandTotal via the shared engine. PDFs do
        // not receive the live loan ledger, so pass [] — the engine falls back
        // to the sale snapshot, which is correct for a printed snapshot.
        const status = getInvoiceStatus(s.paidAmount, s.grandTotal);
        const rem = getSaleRemaining(s, data.loans ?? []);
        const cust = data.customers.find((c) => c.id === s.customerId)?.name ?? 'Walk-in';
        return [
          s.invoiceNo,
          cust,
          new Date(s.saleDate).toLocaleDateString(),
          `${sym}${s.grandTotal.toFixed(2)}`,
          `${sym}${s.paidAmount.toFixed(2)}`,
          `${sym}${rem.toFixed(2)}`,
          status,
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
  } else if (tab === 'customers') {
    autoTable(doc, {
      startY,
      head: [['Customer', 'Phone', 'Email', 'Opening Bal', 'Outstanding']],
      body: data.customers.map((c) => [
        c.name,
        c.phone,
        c.email || 'N/A',
        `${sym}${c.openingBalance.toFixed(2)}`,
        `${sym}${c.balance.toFixed(2)}`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
  } else if (tab === 'loans') {
    autoTable(doc, {
      startY,
      head: [['Invoice', 'Customer', 'Date', 'Bill Amt', 'Settled', 'Outstanding', 'Status']],
      body: data.loans.map((l) => {
        const cust = data.customers.find((c) => c.id === l.customerId)?.name ?? 'Unknown';
        return [
          l.invoiceNumber,
          cust,
          new Date(l.loanDate).toLocaleDateString(),
          `${sym}${l.billAmount.toFixed(2)}`,
          `${sym}${l.paidAmount.toFixed(2)}`,
          `${sym}${l.remainingBalance.toFixed(2)}`,
          l.status,
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });
  } else if (tab === 'daily') {
    autoTable(doc, {
      startY,
      head: [['Metric', 'Value']],
      body: [
        ['Gross Sales', `${sym}${data.todayGross.toFixed(2)}`],
        ['Cash Collected', `${sym}${data.todayCashCollected.toFixed(2)}`],
        ['Loans Granted', `${sym}${data.todayLoansGranted.toFixed(2)}`],
        ['Loans Recovered', `${sym}${data.todayLoansRecovered.toFixed(2)}`],
      ],
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
  } else if (tab === 'monthly') {
    autoTable(doc, {
      startY,
      head: [['Metric', 'Value']],
      body: [
        ['Gross Monthly Sales', `${sym}${data.monthlyGross.toFixed(2)}`],
        ['Cash Collected', `${sym}${data.monthlyCashCollected.toFixed(2)}`],
        ['Loans Granted', `${sym}${data.monthlyLoansGranted.toFixed(2)}`],
        ['Loans Recovered', `${sym}${data.monthlyLoansRecovered.toFixed(2)}`],
      ],
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      margin: { left: 14, right: 14 },
    });
  }

  addPageFooters(doc, settings);
  doc.save(`${tab}_report_${Date.now()}.pdf`);
}

export function generateCustomerStatementPdf(
  settings: Settings,
  customer: Customer,
  ledger: LedgerRow[],
  summary: CustomerStatementSummary
): void {
  const sym = settings.currencySymbol;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startY = addDocumentHeader(doc, settings, 'Customer Account Statement');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Information', 14, startY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Name: ${customer.name}`, 14, startY + 6);
  doc.text(`Phone: ${customer.phone}`, 14, startY + 11);
  doc.text(`Statement Date: ${new Date().toLocaleDateString()}`, 120, startY + 6);
  doc.text(`Outstanding: ${sym}${summary.currentOutstanding.toFixed(2)}`, 120, startY + 11);

  autoTable(doc, {
    startY: startY + 18,
    head: [['Total Bills', 'Total Paid', 'Loans Granted', 'Outstanding']],
    body: [[
      `${sym}${summary.totalPurchases.toFixed(2)}`,
      `${sym}${summary.totalPaid.toFixed(2)}`,
      `${sym}${summary.totalLoanGiven.toFixed(2)}`,
      `${sym}${summary.currentOutstanding.toFixed(2)}`,
    ]],
    styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    margin: { left: 14, right: 14 },
  });

  const ledgerStart = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 36;

  const ledgerBody: string[][] = [];
  if (customer.openingBalance > 0) {
    ledgerBody.push(['Opening', 'Opening Balance', '-', '-', `${sym}${customer.openingBalance.toFixed(2)}`]);
  }
  ledger.forEach((row) => {
    ledgerBody.push([
      new Date(row.date).toLocaleDateString(),
      row.description,
      row.debit > 0 ? `${sym}${row.debit.toFixed(2)}` : '-',
      row.credit > 0 ? `${sym}${row.credit.toFixed(2)}` : '-',
      `${sym}${row.runningBalance.toFixed(2)}`,
    ]);
  });

  autoTable(doc, {
    startY: ledgerStart + 6,
    head: [['Date', 'Description', 'Debit (+)', 'Credit (-)', 'Balance']],
    body: ledgerBody,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  addPageFooters(doc, settings);
  doc.save(`statement_${customer.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}

export interface CustomPaymentReceiptData {
  receiptNo: string;
  customerName: string;
  phone: string;
  paymentAmount: number;
  outstandingBefore: number;
  outstandingAfter: number;
  paymentDate: string;
  paymentMethod: string;
  remarks: string;
}

export function generateCustomPaymentReceiptPdf(settings: Settings, data: CustomPaymentReceiptData): void {
  const sym = settings.currencySymbol;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] });
  let y = 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.shopName.toUpperCase(), 40, y, { align: 'center' });
  y += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.shopAddress, 40, y, { align: 'center' });
  y += 4;
  doc.text(`Tel: ${settings.phone}`, 40, y, { align: 'center' });
  y += 6;

  const rows: [string, string][] = [
    ['Receipt No:', data.receiptNo],
    ['Date/Time:', new Date(data.paymentDate).toLocaleString()],
    ['Customer:', data.customerName],
    ['Phone:', data.phone],
    ['Outstanding Before:', `${sym}${data.outstandingBefore.toFixed(2)}`],
    ['Amount Received:', `${sym}${data.paymentAmount.toFixed(2)}`],
    ['Outstanding After:', `${sym}${data.outstandingAfter.toFixed(2)}`],
    ['Method:', data.paymentMethod],
    ['Remarks:', data.remarks || 'N/A'],
  ];

  doc.setFontSize(8);
  for (const [label, value] of rows) {
    doc.text(label, 4, y);
    doc.text(value, 76, y, { align: 'right' });
    y += 5;
  }

  y += 4;
  doc.setFontSize(7);
  doc.text(settings.receiptFooter, 40, y, { align: 'center' });
  y += 4;
  doc.text('Powered by Smart Retailer', 40, y, { align: 'center' });

  doc.save(`payment_receipt_${data.receiptNo}.pdf`);
}

export function generateBusinessSummaryPdf(data: {
  settings: Settings;
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  expenses: Expense[];
  purchases: Purchase[];
}): void {
  const { settings, sales, products, customers, loans, loanPayments, expenses, purchases } = data;
  const sym = settings.currencySymbol;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const startY = addDocumentHeader(doc, settings, 'Business Summary Report');

  // All business-summary totals flow through the centralized engine so the PDF
  // can never diverge from the on-screen dashboard (Bug #21).
  const totalSales = getTotalSales(sales);
  const totalPaid = getCashReceipts(sales, loanPayments);
  const outstandingLoans = getOutstandingReceivables(customers, sales, loanPayments);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  autoTable(doc, {
    startY,
    head: [['Metric', 'Value']],
    body: [
      ['Total Sales Records', String(sales.length)],
      ['Gross Sales', `${sym}${totalSales.toFixed(2)}`],
      ['Cash Collected', `${sym}${totalPaid.toFixed(2)}`],
      ['Products in Inventory', String(products.length)],
      ['Active Customers', String(customers.length)],
      ['Outstanding Loans', `${sym}${outstandingLoans.toFixed(2)}`],
      ['Loan Payments Recorded', String(loanPayments.length)],
      ['Total Expenses', `${sym}${totalExpenses.toFixed(2)}`],
      ['Purchase Orders', String(purchases.length)],
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    margin: { left: 14, right: 14 },
  });

  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 40;

  autoTable(doc, {
    startY: tableEnd + 8,
    head: [['Invoice', 'Customer', 'Total', 'Date']],
    body: sales.slice(-15).reverse().map((s) => [
      s.invoiceNo,
      customers.find((c) => c.id === s.customerId)?.name ?? 'Walk-in',
      `${sym}${s.grandTotal.toFixed(2)}`,
      new Date(s.saleDate).toLocaleDateString(),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    margin: { left: 14, right: 14 },
  });

  addPageFooters(doc, settings);
  doc.save(`smart_shop_report_${Date.now()}.pdf`);
}
