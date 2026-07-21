import { jsPDF } from 'jspdf';
import { Sale, Settings, LoanPayment, Customer } from '../types';
import { getInvoiceStatus } from './finance';

const RECEIPT_WIDTH_MM = 80;
const MARGIN_MM = 4;
const CONTENT_WIDTH_MM = RECEIPT_WIDTH_MM - MARGIN_MM * 2;

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SaleReceiptOptions {
  sale: Pick<
    Sale,
    | 'invoiceNo'
    | 'saleDate'
    | 'subtotal'
    | 'discount'
    | 'tax'
    | 'grandTotal'
    | 'paidAmount'
    | 'returnAmount'
    | 'paymentMethod'
    | 'customerId'
  >;
  items: ReceiptLineItem[];
  settings: Settings;
  customer: { name: string; phone?: string };
  cashierName: string;
  customerBalance?: number;
  previousLoan?: number;
  currentBill?: number;
}

export interface LoanPaymentReceiptOptions {
  payment: LoanPayment;
  customer: Customer | null;
  settings: Settings;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

function getPaymentStatus(sale: SaleReceiptOptions['sale']): 'PAID' | 'PARTIAL' | 'LOAN' {
  // Derive from the centralized engine (single source of truth), then map the
  // canonical status to the receipt's uppercase display labels (Bug #7).
  const status = getInvoiceStatus(sale.paidAmount, sale.grandTotal);
  switch (status) {
    case 'Paid':
      return 'PAID';
    case 'Partial':
      return 'PARTIAL';
    default:
      return 'LOAN';
  }
}

function drawDashedLine(doc: jsPDF, y: number): number {
  doc.setLineWidth(0.2);
  doc.setDrawColor(120);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(MARGIN_MM, y, RECEIPT_WIDTH_MM - MARGIN_MM, y);
  doc.setLineDashPattern([], 0);
  return y + 2;
}

function createReceiptDoc(): { doc: jsPDF; y: number } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [RECEIPT_WIDTH_MM, 200],
  });
  return { doc, y: MARGIN_MM };
}

function ensurePageSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - MARGIN_MM) {
    doc.addPage([RECEIPT_WIDTH_MM, 200]);
    return MARGIN_MM;
  }
  return y;
}

function addCenteredText(doc: jsPDF, text: string, y: number, fontSize: number, bold = false): number {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH_MM);
  for (const line of lines) {
    const textWidth = doc.getTextWidth(line);
    const x = (RECEIPT_WIDTH_MM - textWidth) / 2;
    doc.text(line, x, y);
    y += fontSize * 0.45;
  }
  return y;
}

function addRow(doc: jsPDF, label: string, value: string, y: number, fontSize = 8): number {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'normal');
  doc.text(label, MARGIN_MM, y);
  doc.text(value, RECEIPT_WIDTH_MM - MARGIN_MM, y, { align: 'right' });
  return y + fontSize * 0.5;
}

export function generateSaleReceiptPDF(options: SaleReceiptOptions): void {
  const { sale, items, settings, customer, cashierName, customerBalance, previousLoan, currentBill } = options;
  const { doc, y: startY } = createReceiptDoc();
  let y = startY;
  const sym = settings.currencySymbol;

  y = addCenteredText(doc, settings.shopName.toUpperCase(), y, 10, true);
  y = addCenteredText(doc, settings.shopAddress, y, 7);
  y = addCenteredText(doc, `Tel: ${settings.phone}`, y, 7);
  y = drawDashedLine(doc, y + 1);

  y = addRow(doc, 'Invoice No:', sale.invoiceNo, y);
  y = addRow(doc, 'Date/Time:', new Date(sale.saleDate).toLocaleString(), y);
  y = addRow(doc, 'Cashier:', cashierName, y);
  y = addRow(doc, 'Customer:', customer.name, y);
  if (customer.phone) {
    y = addRow(doc, 'Phone:', customer.phone, y);
  }
  y = drawDashedLine(doc, y + 1);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Item', MARGIN_MM, y);
  doc.text('Qty', MARGIN_MM + 28, y);
  doc.text('Price', MARGIN_MM + 38, y);
  doc.text('Total', RECEIPT_WIDTH_MM - MARGIN_MM, y, { align: 'right' });
  y += 3;
  y = drawDashedLine(doc, y);

  doc.setFont('helvetica', 'normal');
  for (const item of items) {
    y = ensurePageSpace(doc, y, 8);
    doc.setFontSize(7);
    doc.text(truncateText(item.name, 18), MARGIN_MM, y);
    doc.text(String(item.quantity), MARGIN_MM + 28, y);
    doc.text(`${sym}${item.unitPrice.toFixed(2)}`, MARGIN_MM + 38, y);
    doc.text(`${sym}${item.total.toFixed(2)}`, RECEIPT_WIDTH_MM - MARGIN_MM, y, { align: 'right' });
    y += 3.5;
    y = drawDashedLine(doc, y);
  }

  if (items.length === 0) {
    y = addCenteredText(doc, 'No items recorded', y, 7);
    y = drawDashedLine(doc, y);
  }

  y += 1;
  if (previousLoan !== undefined && previousLoan > 0 && sale.customerId && sale.customerId !== 1) {
    y = addRow(doc, 'Previous Loan:', `${sym}${previousLoan.toFixed(2)}`, y);
  }
  if (currentBill !== undefined && sale.customerId && sale.customerId !== 1) {
    y = addRow(doc, 'Current Bill:', `${sym}${currentBill.toFixed(2)}`, y);
  }
  y = addRow(doc, 'Subtotal:', `${sym}${sale.subtotal.toFixed(2)}`, y);
  y = addRow(doc, 'Discount:', `${sym}${sale.discount.toFixed(2)}`, y);
  y = addRow(doc, `Tax (${settings.taxPercentage}%):`, `${sym}${sale.tax.toFixed(2)}`, y);
  doc.setFont('helvetica', 'bold');
  y = addRow(doc, 'Grand Total:', `${sym}${sale.grandTotal.toFixed(2)}`, y, 9);
  doc.setFont('helvetica', 'normal');
  y = addRow(doc, 'Paid:', `${sym}${sale.paidAmount.toFixed(2)}`, y);

  if (sale.returnAmount > 0) {
    y = addRow(doc, 'Change Return:', `${sym}${sale.returnAmount.toFixed(2)}`, y);
  } else if (sale.grandTotal > sale.paidAmount) {
    doc.setFont('helvetica', 'bold');
    y = addRow(doc, 'Remaining Loan:', `${sym}${(sale.grandTotal - sale.paidAmount).toFixed(2)}`, y);
    doc.setFont('helvetica', 'normal');
  }

  y = addRow(doc, 'Payment Method:', sale.paymentMethod, y);
  const status = getPaymentStatus(sale);
  doc.setFont('helvetica', 'bold');
  y = addRow(doc, 'Status:', status, y);
  doc.setFont('helvetica', 'normal');

  if (customerBalance !== undefined && sale.customerId && sale.customerId !== 1) {
    y = addRow(doc, 'Outstanding Balance:', `${sym}${customerBalance.toFixed(2)}`, y);
  }

  y = drawDashedLine(doc, y + 1);
  y = addCenteredText(doc, settings.receiptFooter, y, 7);
  y += 2;
  y = addCenteredText(doc, 'Powered by Smart Retailer', y, 6);

  doc.save(`receipt_${sale.invoiceNo}.pdf`);
}

export function generateLoanPaymentReceiptPDF(options: LoanPaymentReceiptOptions): void {
  const { payment, customer, settings } = options;
  const { doc, y: startY } = createReceiptDoc();
  let y = startY;
  const sym = settings.currencySymbol;

  y = addCenteredText(doc, settings.shopName.toUpperCase(), y, 10, true);
  y = addCenteredText(doc, 'LOAN PAYMENT RECEIPT', y, 8, true);
  y = drawDashedLine(doc, y + 1);

  y = addRow(doc, 'Receipt No:', `PAY-${payment.id}`, y);
  y = addRow(doc, 'Date/Time:', new Date(payment.paymentDate).toLocaleString(), y);
  y = addRow(doc, 'Customer:', customer?.name ?? 'Unknown', y);
  y = addRow(doc, 'Phone:', customer?.phone ?? 'N/A', y);
  y = drawDashedLine(doc, y + 1);

  y = addRow(doc, 'Transaction:', 'LOAN PAYMENT / RECOVERY', y);
  y = addRow(doc, 'Method:', payment.paymentMethod, y);
  if (payment.invoiceNumber) {
    y = addRow(doc, 'Allocated Invoice:', payment.invoiceNumber, y);
  }
  y = drawDashedLine(doc, y + 1);

  doc.setFont('helvetica', 'bold');
  y = addRow(doc, 'Amount Received:', `${sym}${payment.amount.toFixed(2)}`, y, 9);
  doc.setFont('helvetica', 'normal');
  y = drawDashedLine(doc, y + 1);

  y = addRow(doc, 'Remaining Outstanding:', `${sym}${(customer?.balance ?? 0).toFixed(2)}`, y);
  y = drawDashedLine(doc, y + 1);
  y = addCenteredText(doc, settings.receiptFooter, y, 7);
  y += 2;
  y = addCenteredText(doc, 'Powered by Smart Retailer', y, 6);

  doc.save(`payment_receipt_PAY_${payment.id}.pdf`);
}
