import React, { useState } from 'react';
import { Sale, Customer, Settings, Loan, LoanPayment, User } from '../types';
import { Search, Calendar, ChevronRight, Printer, X, Download, AlertCircle, RefreshCw, Landmark, CreditCard, DollarSign } from 'lucide-react';
import { generateSaleReceiptPDF, generateLoanPaymentReceiptPDF } from '../utils/receiptPdf';
import { triggerPrint, safePdfExport } from '../utils/printUtils';
import { getSaleStatus, getSaleRemaining, getCustomerOutstanding } from '../utils/finance';

interface SalesHistoryViewProps {
  sales: Sale[];
  customers: Customer[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  settings: Settings;
  users?: User[];
}

export default function SalesHistoryView({ sales, customers, loans, loanPayments, settings, users = [] }: SalesHistoryViewProps) {
  const [historyMode, setHistoryMode] = useState<'sales' | 'payments'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Partial' | 'Credit'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'weekly' | 'monthly'>('all');

  // Selected sale for viewing details
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  // Selected loan payment for viewing details
  const [selectedPayment, setSelectedPayment] = useState<LoanPayment | null>(null);

  // Filters calculation for Sales
  const getFilteredSales = () => {
    return sales
      .filter((s) => {
        const custName = customers.find((c) => c.id === s.customerId)?.name || 'Walk-in Customer';
        const isMatch =
          s.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase());

        if (!isMatch) return false;

        // Payment status filtration — derived from the COMPLETE payment history
        // via the engine so a recovered loan shows as Paid/Partial, not stale.
        const derivedStatus = getSaleStatus(s, loans);

        if (statusFilter !== 'all' && derivedStatus !== statusFilter) {
          return false;
        }

        // Date filtration
        if (dateFilter === 'all') return true;

        const saleDate = new Date(s.saleDate);
        const now = new Date();
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));

        if (dateFilter === 'today') {
          return saleDate >= startOfToday;
        }

        if (dateFilter === 'weekly') {
          const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
          return saleDate >= startOfWeek;
        }

        if (dateFilter === 'monthly') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return saleDate >= startOfMonth;
        }

        return true;
      })
      .sort((a, b) => b.id - a.id);
  };

  // Filters calculation for Loan Payments
  const getFilteredPayments = () => {
    return loanPayments
      .filter((p) => {
        const custName = customers.find((c) => c.id === p.customerId)?.name || 'Unknown Customer';
        const paymentIdStr = `PAY-${p.id}`;
        const isMatch =
          paymentIdStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
          custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase());

        if (!isMatch) return false;

        // Date filtration
        if (dateFilter === 'all') return true;

        const pDate = new Date(p.paymentDate);
        const now = new Date();
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));

        if (dateFilter === 'today') {
          return pDate >= startOfToday;
        }

        if (dateFilter === 'weekly') {
          const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
          return pDate >= startOfWeek;
        }

        if (dateFilter === 'monthly') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return pDate >= startOfMonth;
        }

        return true;
      })
      .sort((a, b) => b.id - a.id);
  };

  const filteredSales = getFilteredSales();
  const filteredPayments = getFilteredPayments();

  const triggerReprint = (sale: Sale) => {
    setSelectedSale(sale);
    setSelectedPayment(null);
    setTimeout(() => triggerPrint('printable-sale-inspect'), 300);
  };

  const triggerReprintPayment = (pay: LoanPayment) => {
    setSelectedPayment(pay);
    setSelectedSale(null);
    setTimeout(() => triggerPrint('printable-payment-inspect'), 300);
  };

  // Helper to get loan details for a sale
  const getSaleLoanDetails = (sale: Sale) => {
    const billAmount = sale.grandTotal;
    const paidAmount = sale.paidAmount;

    // Live remaining balance for THIS invoice, read from its loan record so it
    // reflects every recovery payment — not a frozen checkout-time snapshot.
    const remainingLoan = getSaleRemaining(sale, loans);

    // Live status via the engine (Paid / Partial / Credit).
    const status = getSaleStatus(sale, loans);

    // Previous loan = the customer's outstanding balance AT THE TIME of this sale.
    // Reconstructed with the SAME definition the engine uses for the live balance
    // (openingBalance + purchases − payments), but scoped to transactions that
    // happened strictly BEFORE this sale. This avoids using each old loan's
    // CURRENT remainingBalance (which includes recoveries that happened AFTER
    // this sale and would inflate the historical figure).
    let previousLoan = 0;
    if (sale.customerId && sale.customerId !== 1) {
      const cust = customers.find((c) => c.id === sale.customerId);
      const saleTime = new Date(sale.saleDate).getTime();
      const priorSales = sales.filter(
        (s) => s.customerId === sale.customerId && new Date(s.saleDate).getTime() < saleTime
      );
      const priorPurchases = priorSales.reduce(
        (sum, s) => sum + (s.subtotal - s.discount + s.tax),
        0
      );
      const priorCheckoutPaid = priorSales.reduce((sum, s) => sum + s.paidAmount, 0);
      const priorRecoveries = loanPayments
        .filter((lp) => lp.customerId === sale.customerId && new Date(lp.paymentDate).getTime() < saleTime)
        .reduce((sum, lp) => sum + lp.amount, 0);
      previousLoan = Math.max(
        0,
        (cust?.openingBalance || 0) + priorPurchases - priorCheckoutPaid - priorRecoveries
      );
    }

    return {
      previousLoan,
      billAmount,
      paidAmount,
      remainingLoan,
      status,
    };
  };

  return (
    <div className="space-y-6" id="sales-history-panel">
      {/* Sub-tab Selection */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit border border-slate-200/40">
        <button
          onClick={() => {
            setHistoryMode('sales');
            setSelectedSale(null);
            setSelectedPayment(null);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
            historyMode === 'sales'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Sales Transactions
        </button>
        <button
          onClick={() => {
            setHistoryMode('payments');
            setSelectedSale(null);
            setSelectedPayment(null);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
            historyMode === 'payments'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Loan Recovery Payments
        </button>
      </div>

      {/* Control panel */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search bar */}
            <div className="relative w-full sm:w-60">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="sales-search"
                type="text"
                placeholder={historyMode === 'sales' ? "Search Invoice # or Customer..." : "Search Payment ID or Customer..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl pl-9 pr-4 py-2 text-slate-800 placeholder-slate-400 focus:outline-none text-xs"
              />
            </div>

            {/* Payment Status Dropdown Filter (Only shown for Sales) */}
            {historyMode === 'sales' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                <select
                  id="sales-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="all">All Payments</option>
                  <option value="Paid">Fully Paid</option>
                  <option value="Partial">Partially Paid</option>
                  <option value="Credit">Outstanding Loan</option>
                </select>
              </div>
            )}

            {/* Date range quick toggles */}
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden p-0.5">
              <button
                id="sales-filter-all"
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                  dateFilter === 'all' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                All Time
              </button>
              <button
                id="sales-filter-today"
                onClick={() => setDateFilter('today')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                  dateFilter === 'today' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Today
              </button>
              <button
                id="sales-filter-weekly"
                onClick={() => setDateFilter('weekly')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                  dateFilter === 'weekly' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Weekly
              </button>
              <button
                id="sales-filter-monthly"
                onClick={() => setDateFilter('monthly')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                  dateFilter === 'monthly' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            {historyMode === 'sales' ? (
              <>
                Filtered Orders: <span className="font-bold text-slate-700 font-mono">{filteredSales.length}</span> / {sales.length}
              </>
            ) : (
              <>
                Filtered Payments: <span className="font-bold text-slate-700 font-mono">{filteredPayments.length}</span> / {loanPayments.length}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Log Table */}
        <div className={`${(historyMode === 'sales' ? selectedSale : selectedPayment) ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden`}>
          <div className="overflow-x-auto">
            {historyMode === 'sales' ? (
              <table className="w-full text-left text-xs border-collapse" id="sales-history-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-4">Invoice No</th>
                    <th className="py-2.5 px-4">Date & Time</th>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4 text-right">Prev Loan</th>
                    <th className="py-2.5 px-4 text-right">Bill Amount</th>
                    <th className="py-2.5 px-4 text-right">Total Paid</th>
                    <th className="py-2.5 px-4 text-right">Rem. Loan</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No matching transactions found.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((s) => {
                      const cust = customers.find((c) => c.id === s.customerId);
                      const isViewing = selectedSale?.id === s.id;
                      const lDetails = getSaleLoanDetails(s);
                      
                      return (
                        <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors ${isViewing ? 'bg-blue-50/40 font-semibold' : ''}`}>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{s.invoiceNo}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-400 text-[10px]">
                            {new Date(s.saleDate).toLocaleDateString()} {new Date(s.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="text-slate-800 font-medium block truncate max-w-[100px]">{cust ? cust.name : 'Walk-in Customer'}</span>
                            {cust && cust.phone !== '0000-0000000' && (
                              <span className="block text-[9px] text-slate-400 font-mono">{cust.phone}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                            {settings.currencySymbol}{lDetails.previousLoan.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-800">
                            {settings.currencySymbol}{s.grandTotal.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-emerald-600 font-semibold">
                            {settings.currencySymbol}{s.paidAmount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-red-600 font-bold">
                            {settings.currencySymbol}{lDetails.remainingLoan.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                              lDetails.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                              lDetails.status === 'Partial' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {lDetails.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                id={`sale-inspect-${s.id}`}
                                onClick={() => {
                                  setSelectedSale(isViewing ? null : s);
                                  setSelectedPayment(null);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Inspect Receipt & Credit Info"
                              >
                                <ChevronRight size={13} />
                              </button>
                              <button
                                id={`sale-reprint-${s.id}`}
                                onClick={() => triggerReprint(s)}
                                className="p-1 text-slate-600 hover:bg-slate-50 rounded cursor-pointer"
                                title="Reprint Invoice"
                              >
                                <Printer size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs border-collapse" id="loan-payments-history-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-4">Payment ID</th>
                    <th className="py-2.5 px-4">Date & Time</th>
                    <th className="py-2.5 px-4">Customer Name</th>
                    <th className="py-2.5 px-4">Payment Method</th>
                    <th className="py-2.5 px-4 text-right">Amount Recovered</th>
                    <th className="py-2.5 px-4 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No matching loan payments found.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const cust = customers.find((c) => c.id === p.customerId);
                      const isViewing = selectedPayment?.id === p.id;
                      
                      return (
                        <tr key={p.id} className={`hover:bg-slate-50/50 transition-colors ${isViewing ? 'bg-blue-50/40 font-semibold' : ''}`}>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-850">PAY-{p.id}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-400 text-[10px]">
                            {new Date(p.paymentDate).toLocaleDateString()} {new Date(p.paymentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="text-slate-800 font-medium block truncate max-w-[140px]">{cust ? cust.name : 'Unknown Customer'}</span>
                            {cust && cust.phone !== '0000-0000000' && (
                              <span className="block text-[9px] text-slate-400 font-mono">{cust.phone}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded-md font-bold text-[9px] uppercase bg-slate-100 text-slate-600">
                              {p.paymentMethod}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-emerald-600 font-bold text-sm">
                            {settings.currencySymbol}{p.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                id={`payment-inspect-${p.id}`}
                                onClick={() => {
                                  setSelectedPayment(isViewing ? null : p);
                                  setSelectedSale(null);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Inspect Payment Receipt"
                              >
                                <ChevronRight size={13} />
                              </button>
                              <button
                                id={`payment-reprint-${p.id}`}
                                onClick={() => triggerReprintPayment(p)}
                                className="p-1 text-slate-600 hover:bg-slate-50 rounded cursor-pointer"
                                title="Reprint Payment Receipt"
                              >
                                <Printer size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Selected Invoice Details */}
        {historyMode === 'sales' && selectedSale && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm h-fit space-y-4 animate-slide-left">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-800 font-mono">{selectedSale.invoiceNo}</h3>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Credit Inspection Ledger</p>
              </div>
              <button
                id="sale-inspect-close"
                onClick={() => setSelectedSale(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-full hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Credit info header block */}
            {selectedSale.customerId && selectedSale.customerId !== 1 && (
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-2.5 text-[10px] text-amber-800 space-y-1">
                <span className="font-bold block uppercase text-[9px] tracking-wider text-amber-900">⚠ Outstanding Loan Details</span>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{customers.find(c => c.id === selectedSale.customerId)?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span>Previous Balance:</span>
                  <span>{settings.currencySymbol}{getSaleLoanDetails(selectedSale).previousLoan.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-mono font-bold text-red-700">
                  <span>Remaining Loan for this invoice:</span>
                  <span>{settings.currencySymbol}{getSaleLoanDetails(selectedSale).remainingLoan.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl font-mono text-[10px] text-slate-700 leading-relaxed space-y-2" id="printable-sale-inspect">
              <div className="print-only-header">
                <strong>{settings.shopName}</strong>
                <div>{settings.shopAddress} | Tel: {settings.phone}</div>
                <div>Invoice: {selectedSale.invoiceNo} | {new Date(selectedSale.saleDate).toLocaleString()}</div>
                <div>Printed: {new Date().toLocaleString()}</div>
              </div>
              {/* Item breakdown */}
              <div className="space-y-1 pb-2 border-b border-dashed border-slate-200">
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>Item Description</span>
                  <span className="w-12 text-center">Qty</span>
                  <span className="w-16 text-right">Total</span>
                </div>
                {selectedSale.items && selectedSale.items.length > 0 ? (
                  selectedSale.items.map((item) => (
                    <div key={item.productId} className="flex justify-between text-slate-600 text-[9px]">
                      <span className="truncate pr-2 max-w-[120px]">{item.name}</span>
                      <span className="w-12 text-center">{item.quantity}</span>
                      <span className="w-16 text-right">
                        {settings.currencySymbol}{(item.salePrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 italic text-[9px] text-center py-2">No item details recorded.</div>
                )}
              </div>

              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>{settings.currencySymbol} {selectedSale.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-500">
                <span>DISCOUNTS:</span>
                <span>- {settings.currencySymbol} {selectedSale.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>TAX ({settings.taxPercentage}%):</span>
                <span>{settings.currencySymbol} {selectedSale.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 text-xs pt-1 border-t border-dashed border-slate-200">
                <span>GRAND TOTAL:</span>
                <span>{settings.currencySymbol} {selectedSale.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>PAID:</span>
                <span>{settings.currencySymbol} {selectedSale.paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>RETURN:</span>
                <span>{settings.currencySymbol} {selectedSale.returnAmount.toFixed(2)}</span>
              </div>
              {selectedSale.customerId && selectedSale.customerId !== 1 && (
                <div className="flex justify-between text-red-600 font-bold border-t border-dashed border-slate-200 pt-1">
                  <span>REMAINING LOAN:</span>
                  <span>{settings.currencySymbol} {Math.max(0, selectedSale.grandTotal - selectedSale.paidAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="print-only-footer">{settings.receiptFooter} — Powered by Smart Retailer</div>
            </div>

            <div className="grid grid-cols-2 gap-2 no-print">
              <button
                id="inspect-reprint-btn"
                onClick={() => triggerReprint(selectedSale)}
                className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-xl text-[10px] cursor-pointer"
              >
                <Printer size={12} />
                Reprint
              </button>
              <button
                id="inspect-download-btn"
                onClick={() => {
                  const cust = customers.find((c) => c.id === selectedSale.customerId);
                  const cashier = users.find((u) => u.id === selectedSale.userId);
                  const currentBill = selectedSale.subtotal - selectedSale.discount + selectedSale.tax;
                  const loanDetails = getSaleLoanDetails(selectedSale);
                  safePdfExport(() =>
                    generateSaleReceiptPDF({
                      sale: selectedSale,
                      items: (selectedSale.items ?? []).map((item) => ({
                        name: item.name,
                        quantity: item.quantity,
                        unitPrice: item.salePrice,
                        total: item.salePrice * item.quantity,
                      })),
                      settings,
                      customer: {
                        name: cust?.name ?? 'Walk-in Customer',
                        phone: cust?.phone,
                      },
                      cashierName: cashier?.fullName ?? 'Unknown',
                      customerBalance: cust?.balance,
                      previousLoan: loanDetails.previousLoan > 0 ? loanDetails.previousLoan : undefined,
                      currentBill: selectedSale.customerId && selectedSale.customerId !== 1 ? currentBill : undefined,
                    })
                  );
                }}
                className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-xl text-[10px] cursor-pointer"
              >
                <Download size={12} />
                Download PDF
              </button>
            </div>
          </div>
        )}

        {/* Selected Loan Payment Details */}
        {historyMode === 'payments' && selectedPayment && (() => {
          const cust = customers.find((c) => c.id === selectedPayment.customerId);
          return (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm h-fit space-y-4 animate-slide-left">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 font-mono">PAY-{selectedPayment.id}</h3>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Loan Recovery Receipt</p>
                </div>
                <button
                  id="payment-inspect-close"
                  onClick={() => setSelectedPayment(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-full hover:bg-slate-50"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Customer Account Summary */}
              {cust && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-xl p-2.5 text-[10px] text-emerald-800 dark:text-emerald-300 space-y-1">
                  <span className="font-bold block uppercase text-[9px] tracking-wider text-emerald-900 dark:text-emerald-200">✓ Customer Account Status</span>
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-bold">{cust.name}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Phone:</span>
                    <span>{cust.phone}</span>
                  </div>
                  <div className="flex justify-between font-mono font-bold text-red-600 dark:text-red-400">
                    <span>Current Outstanding:</span>
                    <span>{settings.currencySymbol}{cust.balance.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl font-mono text-[10px] text-slate-700 leading-relaxed space-y-3" id="printable-payment-inspect">
                <div className="print-only-header">
                  <strong>{settings.shopName}</strong>
                  <div>{settings.shopAddress} | Tel: {settings.phone}</div>
                  <div>Payment: PAY-{selectedPayment.id} | {new Date(selectedPayment.paymentDate).toLocaleString()}</div>
                  <div>Printed: {new Date().toLocaleString()}</div>
                </div>
                <div className="text-center pb-1.5 border-b border-dashed border-slate-200">
                  <h4 className="font-bold text-slate-800 uppercase">{settings.shopName}</h4>
                  <span className="text-[8px] text-slate-400">LOAN PAYMENT TRANSACTION RECORD</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment ID:</span>
                    <span className="font-bold">PAY-{selectedPayment.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date/Time:</span>
                    <span>{new Date(selectedPayment.paymentDate).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Method:</span>
                    <span className="font-bold bg-slate-200 text-slate-800 px-1 rounded-sm text-[8px]">{selectedPayment.paymentMethod}</span>
                  </div>
                  {selectedPayment.invoiceNumber && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Allocated Invoice:</span>
                      <span className="font-bold font-mono">{selectedPayment.invoiceNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-slate-800 text-xs pt-1.5 border-t border-dashed border-slate-200">
                    <span>AMOUNT PAID:</span>
                    <span className="text-emerald-600">{settings.currencySymbol}{selectedPayment.amount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="print-only-footer">{settings.receiptFooter} — Powered by Smart Retailer</div>
              </div>

              <div className="grid grid-cols-2 gap-2 no-print">
                <button
                  id="inspect-reprint-payment-btn"
                  onClick={() => triggerReprintPayment(selectedPayment)}
                  className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-xl text-[10px] cursor-pointer"
                >
                  <Printer size={12} />
                  Reprint
                </button>
                <button
                  id="inspect-download-payment-btn"
                  onClick={() => {
                    safePdfExport(() =>
                      generateLoanPaymentReceiptPDF({
                        payment: selectedPayment,
                        customer: cust ?? null,
                        settings,
                      })
                    );
                  }}
                  className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-xl text-[10px] cursor-pointer"
                >
                  <Download size={12} />
                  Download PDF
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
