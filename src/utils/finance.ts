/**
 * Centralized Financial Calculation Engine
 * =========================================
 * Single source of truth for every money figure in the app.
 *
 * Business rules enforced here (see audit spec):
 *  - Total Sales (Gross)   = Σ every invoice grandTotal
 *  - Cash Receipts         = Σ every payment actually received
 *                            (checkout paid + all loan recoveries / installments)
 *  - Outstanding Receivables = Σ remaining customer balances (never includes paid loans)
 *  - Loan Recovery          = Σ payments made toward outstanding balances
 *  - Profit                 = Sales − Product Cost (COGS) − Expenses
 *                             (credit affects cash flow, NOT sales revenue)
 *  - Invoice status         = Paid / Partial / Credit (derived from COMPLETE payment history)
 *
 * All public helpers round to 2dp via `round2` to kill floating-point drift.
 * Customer balances are NEVER clipped with Math.max(0) — a negative balance
 * represents legitimate store credit (overpayment).
 */

import { Sale, Loan, LoanPayment, Customer, Expense } from '../types';

/** Round to 2 decimal places, neutralizing binary floating-point error. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Epsilon used to treat near-zero balances as fully settled. */
const TOLERANCE = 0.001;

/** Canonical invoice payment status (spec naming). */
export type InvoiceStatus = 'Paid' | 'Partial' | 'Credit';

/**
 * Derive invoice status from a total-paid vs total-due pair.
 * Used as the universal status derivation everywhere.
 */
export function getInvoiceStatus(totalPaid: number, totalDue: number): InvoiceStatus {
  const remaining = round2(totalDue - totalPaid);
  if (remaining <= TOLERANCE) return 'Paid';
  return totalPaid > TOLERANCE ? 'Partial' : 'Credit';
}

// ---------------------------------------------------------------------------
// SALE-LEVEL HELPERS
// ---------------------------------------------------------------------------

/**
 * The amount actually attributable to a sale's own items.
 * Equals subtotal − discount + tax. This EXCLUDES any "previous loan"
 * that the POS folds into grandTotal at checkout — folding the old balance
 * into the receipt total must NOT be treated as new purchases, otherwise
 * ledgers and customer balances double-count the old debt.
 */
export function getSaleCurrentBill(sale: Sale): number {
  return round2(sale.subtotal - sale.discount + sale.tax);
}

/**
 * Live remaining balance for a specific invoice.
 * Reads from the linked Loan record (kept up to date by every recovery),
 * falling back to the sale snapshot only when no loan exists (fully paid
 * at checkout, or a walk-in cash sale).
 */
export function getSaleRemaining(sale: Sale, loans: Loan[]): number {
  const loan = loans.find((l) => l.invoiceNumber === sale.invoiceNo);
  if (!loan) return 0; // no loan => nothing outstanding on this invoice
  return round2(Math.max(0, loan.remainingBalance));
}

/** Live status of a sale, derived from its (possibly recovered) loan. */
export function getSaleStatus(sale: Sale, loans: Loan[]): InvoiceStatus {
  const loan = loans.find((l) => l.invoiceNumber === sale.invoiceNo);
  if (!loan) {
    // No loan => fully settled at checkout.
    return getInvoiceStatus(sale.paidAmount, sale.grandTotal);
  }
  return getInvoiceStatus(loan.paidAmount, loan.billAmount);
}

// ---------------------------------------------------------------------------
// CUSTOMER-LEVEL HELPERS
// ---------------------------------------------------------------------------

/** Σ of a customer's real purchases (sum of current bills, NOT folded grandTotals). */
export function getCustomerTotalPurchases(customerId: number, sales: Sale[]): number {
  return round2(
    sales
      .filter((s) => s.customerId === customerId)
      .reduce((sum, s) => sum + getSaleCurrentBill(s), 0)
  );
}

/**
 * Complete payment history for a customer = checkout payments + ALL recovery
 * payments / installments. Never uses only the first payment.
 */
export function getCustomerTotalPaid(
  customerId: number,
  sales: Sale[],
  loanPayments: LoanPayment[]
): number {
  const checkoutPaid = sales
    .filter((s) => s.customerId === customerId)
    .reduce((sum, s) => sum + s.paidAmount, 0);
  const recoveries = loanPayments
    .filter((p) => p.customerId === customerId)
    .reduce((sum, p) => sum + p.amount, 0);
  return round2(checkoutPaid + recoveries);
}

/**
 * Authoritative outstanding balance for a customer, recomputed from raw data:
 *   openingBalance + totalPurchases − totalPaid
 * Allocation-agnostic and never clipped (negative => store credit).
 */
export function getCustomerOutstanding(
  customer: Customer,
  sales: Sale[],
  loanPayments: LoanPayment[]
): number {
  const purchases = getCustomerTotalPurchases(customer.id, sales);
  const paid = getCustomerTotalPaid(customer.id, sales, loanPayments);
  return round2((customer.openingBalance || 0) + purchases - paid);
}

// ---------------------------------------------------------------------------
// STORE-WIDE AGGREGATES (dashboard / reports)
// ---------------------------------------------------------------------------

/** Total Sales (Gross) = Σ every invoice grandTotal, regardless of payment. */
export function getTotalSales(sales: Sale[]): number {
  return round2(sales.reduce((sum, s) => sum + s.grandTotal, 0));
}

/** Cash Receipts = every payment actually received (checkout + recoveries). */
export function getCashReceipts(sales: Sale[], loanPayments: LoanPayment[]): number {
  const checkoutPaid = sales.reduce((sum, s) => sum + s.paidAmount, 0);
  const recoveries = loanPayments.reduce((sum, p) => sum + p.amount, 0);
  return round2(checkoutPaid + recoveries);
}

/**
 * Outstanding Loans = Σ of all remaining customer balances (receivables).
 * Walk-in customer (id 1) is excluded. Store credit (negative) is ignored.
 * Recomputed from raw data so it stays consistent with the ledger engine.
 */
export function getOutstandingReceivables(
  customers: Customer[],
  sales: Sale[],
  loanPayments: LoanPayment[]
): number {
  return round2(
    customers
      .filter((c) => c.id !== 1)
      .reduce((sum, c) => sum + Math.max(0, getCustomerOutstanding(c, sales, loanPayments)), 0)
  );
}

/** Loan Recovery = Σ of recovery payments, optionally within a date range. */
export function getLoanRecovery(loanPayments: LoanPayment[], startDateStr?: string): number {
  return round2(
    loanPayments
      .filter((p) => !startDateStr || p.paymentDate >= startDateStr)
      .reduce((sum, p) => sum + p.amount, 0)
  );
}

// ---------------------------------------------------------------------------
// PROFIT & LOSS
// ---------------------------------------------------------------------------

export interface ProfitResult {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

/**
 * Profit & Loss for a date range (undefined startDateStr => all time).
 *  - revenue  = Σ grandTotal (full invoice total — credit does NOT reduce revenue)
 *  - cogs     = Σ item.costPrice × quantity  (NEVER fabricated/estimated)
 *  - expenses = Σ logged expenses
 * Sales with no item breakdown contribute revenue but 0 COGS (honest, not guessed).
 */
export function getProfit(sales: Sale[], expenses: Expense[], startDateStr?: string): ProfitResult {
  const inRange = (dateStr: string) => !startDateStr || dateStr >= startDateStr;

  const rangeSales = sales.filter((s) => inRange(s.saleDate));
  const rangeExpenses = expenses.filter((e) => inRange(e.expenseDate));

  const revenue = round2(rangeSales.reduce((sum, s) => sum + s.grandTotal, 0));

  let cogs = 0;
  rangeSales.forEach((s) => {
    if (s.items && s.items.length > 0) {
      s.items.forEach((item) => {
        cogs += item.costPrice * item.quantity;
      });
    }
    // No fallback estimate: missing items => 0 COGS.
  });
  cogs = round2(cogs);

  const grossProfit = round2(revenue - cogs);
  const totalExpenses = round2(rangeExpenses.reduce((sum, e) => sum + e.amount, 0));
  const netProfit = round2(grossProfit - totalExpenses);

  return { revenue, cogs, grossProfit, expenses: totalExpenses, netProfit };
}

// ---------------------------------------------------------------------------
// CUSTOMER LEDGER
// ---------------------------------------------------------------------------

export interface LedgerRow {
  date: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

/**
 * Build a customer's running-balance ledger from raw events.
 * Purchases DEBIT the CURRENT BILL (not the folded grandTotal) so old debt
 * is never counted twice. Payments (checkout + recoveries) CREDIT the account.
 */
export function buildCustomerLedger(
  customer: Customer,
  sales: Sale[],
  loanPayments: LoanPayment[]
): LedgerRow[] {
  const customerSales = sales.filter((s) => s.customerId === customer.id);
  const customerPayments = loanPayments.filter((p) => p.customerId === customer.id);

  const events: Omit<LedgerRow, 'runningBalance'>[] = [];

  customerSales.forEach((s) => {
    const currentBill = getSaleCurrentBill(s);
    events.push({
      date: s.saleDate,
      description: `Invoice ${s.invoiceNo} (Purchase)`,
      debit: currentBill,
      credit: 0,
    });
    if (s.paidAmount > 0) {
      events.push({
        date: s.saleDate,
        description: `Checkout Payment (${s.invoiceNo})`,
        debit: 0,
        credit: s.paidAmount,
      });
    }
  });

  customerPayments.forEach((p) => {
    events.push({
      date: p.paymentDate,
      description: `Recovery Payment (${p.paymentMethod})`,
      debit: 0,
      credit: p.amount,
    });
  });

  // Chronological order so the running balance is correct.
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let balance = customer.openingBalance || 0;
  const ledger: LedgerRow[] = [];
  events.forEach((ev) => {
    balance = round2(balance + ev.debit - ev.credit);
    ledger.push({ ...ev, runningBalance: balance });
  });

  return ledger;
}

// ---------------------------------------------------------------------------
// LOAN PAYMENT ALLOCATION
// ---------------------------------------------------------------------------

export interface LoanAllocationResult {
  updatedLoans: Loan[];
  /** Invoice number of the first loan the payment was applied to (for receipt linkage). */
  allocatedInvoiceNumber?: string;
  /** Total amount absorbed by existing loans. */
  appliedAmount: number;
  /** Leftover not absorbed by any loan (overpayment => becomes store credit). */
  remainder: number;
}

/**
 * Allocate a payment across a customer's outstanding loans, oldest first (FIFO).
 * PURE function — computes a new loans array without mutating input or relying
 * on setState, so it is safe under React StrictMode double-invocation.
 */
export function allocatePaymentToLoans(
  loans: Loan[],
  customerId: number,
  amount: number
): LoanAllocationResult {
  let remaining = round2(amount);
  let applied = 0;
  let allocatedInvoiceNumber: string | undefined;

  const updatedLoans = loans.map((l) => {
    if (l.customerId !== customerId || l.remainingBalance <= TOLERANCE || remaining <= TOLERANCE) {
      return l;
    }
    const allocation = Math.min(l.remainingBalance, remaining);
    remaining = round2(remaining - allocation);
    applied = round2(applied + allocation);
    if (!allocatedInvoiceNumber) allocatedInvoiceNumber = l.invoiceNumber;

    const newPaid = round2(l.paidAmount + allocation);
    const newRemaining = round2(l.billAmount - newPaid);
    return {
      ...l,
      paidAmount: newPaid,
      remainingBalance: newRemaining,
      status: (newRemaining <= TOLERANCE ? 'Paid' : 'Partial') as Loan['status'],
      updatedAt: new Date().toISOString(),
    };
  });

  return { updatedLoans, allocatedInvoiceNumber, appliedAmount: applied, remainder: remaining };
}

/**
 * Replays a customer's recovery payments in chronological order, allocating
 * each one FIFO across the customer's loans (oldest first), exactly mirroring
 * `allocatePaymentToLoans`. Returns, for every payment, the breakdown of which
 * invoices it actually reduced — so the per-loan "Installment History" panel
 * can show a payment against EVERY loan it touched, not just the FIFO-first one.
 *
 * PURE function (no mutation of inputs).
 */
export function replayPaymentAllocations(
  loans: Loan[],
  payments: LoanPayment[]
): Map<number, { invoiceNumber: string; amount: number }[]> {
  // Seed each loan at its CREATION state (fully unpaid = billAmount) and walk
  // recovery payments forward in chronological order, FIFO by loan id.
  // This reproduces exactly how allocatePaymentToLoans distributed each payment
  // at the time it was processed, so a composite payment is attributed to every
  // loan it touched (not just the FIFO-first one).
  const balances = new Map<number, number>(); // loanId -> remaining balance
  loans.forEach((l) => balances.set(l.id, l.billAmount));

  const result = new Map<number, { invoiceNumber: string; amount: number }[]>();
  const orderedLoans = [...loans].sort((a, b) => a.id - b.id);
  payments
    .filter((p) => p.amount > 0)
    .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime())
    .forEach((p) => {
      let remaining = round2(p.amount);
      const splits: { invoiceNumber: string; amount: number }[] = [];
      for (const l of orderedLoans) {
        if (remaining <= TOLERANCE) break;
        const bal = balances.get(l.id) ?? 0;
        if (bal <= TOLERANCE) continue;
        const allocation = Math.min(bal, remaining);
        balances.set(l.id, round2(bal - allocation));
        remaining = round2(remaining - allocation);
        splits.push({ invoiceNumber: l.invoiceNumber, amount: allocation });
      }
      result.set(p.id, splits);
    });
  return result;
}

/**
 * Total credit EXTENDED (loans granted) within a date range.
 * = Σ over loans created in [range] of the unpaid-at-creation portion
 *   (billAmount − the checkout payment that created the loan's initial paidAmount).
 *
 * Because recovery payments mutate loan.paidAmount over time, the
 * unpaid-at-creation figure is recovered from the linked sale's own checkout
 * payment rather than the loan's current paidAmount.
 */
export function getLoansGranted(loans: Loan[], sales: Sale[], startDateStr?: string, endDateStr?: string): number {
  const inRange = (dateStr: string) =>
    (!startDateStr || dateStr >= startDateStr) && (!endDateStr || dateStr < endDateStr);
  return round2(
    loans
      .filter((l) => inRange(l.loanDate))
      .reduce((sum, l) => {
        const sale = sales.find((s) => s.invoiceNo === l.invoiceNumber);
        const initialPaid = sale ? Math.min(sale.paidAmount, l.billAmount) : l.paidAmount;
        return sum + Math.max(0, l.billAmount - initialPaid);
      }, 0)
  );
}
