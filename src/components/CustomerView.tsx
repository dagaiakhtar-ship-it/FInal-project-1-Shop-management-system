import React, { useState, useMemo } from 'react';
import { Customer, Sale, Settings, Loan, LoanPayment } from '../types';
import { Search, Plus, Edit2, Trash2, X, CreditCard, ShoppingBag, AlertCircle, Landmark, Receipt, Calendar, DollarSign, Printer, Download, Share2 } from 'lucide-react';
import { triggerPrint, safePdfExport } from '../utils/printUtils';
import { generateCustomerStatementPdf, generateCustomPaymentReceiptPdf } from '../utils/pdfDocument';
import {
  buildCustomerLedger,
  getCustomerTotalPurchases,
  getCustomerTotalPaid,
  getCustomerOutstanding,
  replayPaymentAllocations,
  round2,
} from '../utils/finance';

interface CustomerViewProps {
  customers: Customer[];
  sales: Sale[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  settings: Settings;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'balance'>) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: number) => void;
  onProcessLoanPayment: (customerId: number, amount: number, method: 'Cash' | 'Bank' | 'Other') => void;
  userRole: 'Admin' | 'Manager' | 'Cashier';
}

export default function CustomerView({
  customers,
  sales,
  loans,
  loanPayments,
  settings,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onProcessLoanPayment,
  userRole,
}: CustomerViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Selected customer for profile dashboard viewing
  const [viewingHistoryCustomerId, setViewingHistoryCustomerId] = useState<number | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<'stats' | 'sales' | 'loans' | 'statement'>('stats');

  // Direct Loan Payment Form states
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'Other'>('Cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentError, setPaymentError] = useState('');

  // Payment receipt state
  const [lastPaymentReceipt, setLastPaymentReceipt] = useState<{
    customerName: string;
    phone: string;
    paymentAmount: number;
    outstandingBefore: number;
    outstandingAfter: number;
    paymentDate: string;
    paymentMethod: string;
    remarks: string;
    receiptNo: string;
  } | null>(null);

  const getCustomerLedger = (cust: Customer) => {
    // Delegates to the centralized engine so the customer statement ledger uses
    // the SAME business rules as the dashboard / reports. Purchases debit the
    // CURRENT BILL (subtotal − discount + tax), NOT the folded grandTotal, so an
    // outstanding previous loan is never counted twice in the running balance.
    return buildCustomerLedger(cust, sales, loanPayments);
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setWhatsappNumber('');
    setEmail('');
    setAddress('');
    setOpeningBalance('0');
    setNotes('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone);
    setWhatsappNumber(c.whatsappNumber || '');
    setEmail(c.email || '');
    setAddress(c.address || '');
    setOpeningBalance(String(c.openingBalance));
    setNotes(c.notes || '');
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Customer Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone Number is required.');
      return;
    }

    // Phone duplication check
    const dup = customers.find(
      (c) => c.phone === phone.trim() && (!editingCustomer || c.id !== editingCustomer.id)
    );
    if (dup && phone.trim() !== '0000-0000000') {
      setError(`A customer with phone number '${phone}' is already registered.`);
      return;
    }

    if (editingCustomer) {
      onUpdateCustomer({
        ...editingCustomer,
        name: name.trim(),
        phone: phone.trim(),
        whatsappNumber: whatsappNumber.trim() || undefined,
        email: email.trim(),
        address: address.trim(),
        openingBalance: parseFloat(openingBalance) || 0,
        notes: notes.trim() || undefined,
      });
    } else {
      onAddCustomer({
        name: name.trim(),
        phone: phone.trim(),
        whatsappNumber: whatsappNumber.trim() || undefined,
        email: email.trim(),
        address: address.trim(),
        openingBalance: parseFloat(openingBalance) || 0,
        notes: notes.trim() || undefined,
      });
    }

    setIsModalOpen(false);
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isRestricted = userRole === 'Cashier';

  // Get selected customer context
  const activeHistoryCustomer = customers.find((c) => c.id === viewingHistoryCustomerId);

  // Compile calculations for selected customer
  const customerHistorySales = activeHistoryCustomer
    ? sales.filter((s) => s.customerId === activeHistoryCustomer.id)
    : [];

  const customerHistoryLoans = activeHistoryCustomer
    ? loans.filter((l) => l.customerId === activeHistoryCustomer.id)
    : [];

  const customerHistoryPayments = activeHistoryCustomer
    ? loanPayments.filter((lp) => lp.customerId === activeHistoryCustomer.id)
    : [];

  // Replay the customer's recovery payments FIFO to compute which invoices
  // each payment actually reduced. A composite payment can span multiple loans,
  // so matching by `lp.invoiceNumber` alone only ever showed the FIFO-first one.
  const paymentAllocation = useMemo(
    () => replayPaymentAllocations(customerHistoryLoans, customerHistoryPayments),
    [customerHistoryLoans, customerHistoryPayments]
  );

  // Metrics — derived from the centralized engine so the customer profile stats
  // match the dashboard and statements exactly.
  const totalPurchases = activeHistoryCustomer
    ? getCustomerTotalPurchases(activeHistoryCustomer.id, sales)
    : 0;
  const totalPaidAtCheckout = customerHistorySales.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalDirectPayments = customerHistoryPayments.reduce((sum, p) => sum + p.amount, 0);
  // Complete payment history = checkout payments + ALL recoveries/installments.
  const totalPaidTotal = activeHistoryCustomer
    ? getCustomerTotalPaid(activeHistoryCustomer.id, sales, loanPayments)
    : 0;

  const currentOutstanding = activeHistoryCustomer
    ? getCustomerOutstanding(activeHistoryCustomer, sales, loanPayments)
    : 0;
  // Total Loan Given = total credit EXTENDED at checkout across all invoices
  // (purchases not covered by the checkout payment). Previously this summed
  // each loan's gross billAmount, which overstated credit by the paid-at-
  // checkout portion (Bug: mislabeled "loan given").
  const totalLoanGiven = round2(Math.max(0, totalPurchases - totalPaidAtCheckout));
  // Loan recovery = every payment that reduced the customer's balance, including
  // checkout payments applied to outstanding debt — not just direct payments.
  const totalLoanRecovered = round2(totalPaidTotal - totalPaidAtCheckout);

  const creditPurchasesCount = customerHistorySales.filter((s) => s.paidAmount < s.grandTotal).length;

  const lastPurchaseDate = customerHistorySales.length > 0
    ? new Date(Math.max(...customerHistorySales.map(s => new Date(s.saleDate).getTime()))).toLocaleDateString()
    : 'No purchases';

  const lastPaymentDate = customerHistoryPayments.length > 0
    ? new Date(Math.max(...customerHistoryPayments.map(p => new Date(p.paymentDate).getTime()))).toLocaleDateString()
    : totalPaidAtCheckout > 0 ? 'At last checkout' : 'No payments';

  // Process a direct loan payment
  const handlePayLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');

    if (!activeHistoryCustomer) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError('Please enter a valid payment amount greater than 0.');
      return;
    }

    if (amount > activeHistoryCustomer.balance) {
      setPaymentError(`Payment amount cannot exceed outstanding balance of ${settings.currencySymbol} ${activeHistoryCustomer.balance.toFixed(2)}.`);
      return;
    }

    // Process payment in main App state
    onProcessLoanPayment(activeHistoryCustomer.id, amount, paymentMethod);

    // Save receipt context for printable receipt
    const outstandingBefore = activeHistoryCustomer.balance;
    const outstandingAfter = outstandingBefore - amount;
    const randomReceiptNo = `REC-${Date.now().toString().slice(-6)}`;

    setLastPaymentReceipt({
      customerName: activeHistoryCustomer.name,
      phone: activeHistoryCustomer.phone,
      paymentAmount: amount,
      outstandingBefore,
      outstandingAfter,
      paymentDate: new Date().toISOString(),
      paymentMethod,
      remarks: paymentRemarks.trim() || 'Direct loan recovery paydown',
      receiptNo: randomReceiptNo,
    });

    // Reset payment fields
    setPaymentAmount('');
    setPaymentRemarks('');
  };

  const printPaymentReceipt = () => {
    triggerPrint('printable-payment-receipt');
  };

  return (
    <div className="space-y-4" id="customer-panel">
      {/* Top Filter and Add Bar */}
      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="customer-search"
            type="text"
            placeholder="Search customers by name/phone/email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg pl-8.5 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none text-xs"
          />
        </div>

        <button
          id="customer-add-btn"
          onClick={openAddModal}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm cursor-pointer"
        >
          <Plus size={12} />
          Register Customer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer Directory List */}
        <div className={`${viewingHistoryCustomerId ? 'lg:col-span-1' : 'lg:col-span-3'} bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden`}>
          <table className="w-full text-left text-xs border-collapse" id="customers-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                <th className="py-2 px-4">Customer Name</th>
                <th className="py-2 px-4">Contact Details</th>
                {!viewingHistoryCustomerId && <th className="py-2 px-4">Address</th>}
                <th className="py-2 px-4 text-right">Outstanding Loan</th>
                <th className="py-2 px-4 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No customers found matching search term.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const hasDebit = c.balance > 0;
                  return (
                    <tr key={c.id} className={`hover:bg-slate-50/50 transition-colors ${viewingHistoryCustomerId === c.id ? 'bg-blue-50/40 border-l-2 border-blue-600' : ''}`}>
                      <td className="py-2 px-4">
                        <span className="font-semibold text-slate-800 text-xs block">{c.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">ID: #{c.id}</span>
                      </td>
                      <td className="py-2 px-4">
                        <div className="space-y-0.5">
                          <span className="block font-mono font-bold text-slate-700">{c.phone}</span>
                          {!viewingHistoryCustomerId && <span className="block text-[9px] text-slate-400 leading-none">{c.email || '—'}</span>}
                        </div>
                      </td>
                      {!viewingHistoryCustomerId && (
                        <td className="py-2 px-4 text-slate-500 italic max-w-[130px] truncate">{c.address || '—'}</td>
                      )}
                      <td className="py-2 px-4 text-right font-mono font-semibold">
                        {c.id === 1 ? (
                          <span className="text-slate-400 font-medium">—</span>
                        ) : (
                          <span className={hasDebit ? 'text-red-600 font-bold' : 'text-slate-500'}>
                            {settings.currencySymbol}{Math.abs(c.balance).toFixed(2)}
                            {hasDebit ? ' (Loan)' : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <button
                            id={`customer-history-${c.id}`}
                            onClick={() => {
                              setViewingHistoryCustomerId(viewingHistoryCustomerId === c.id ? null : c.id);
                              setActiveProfileTab('stats');
                            }}
                            className={`p-1.5 rounded cursor-pointer transition-colors ${
                              viewingHistoryCustomerId === c.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                            title="View Customer Profile Dashboard"
                          >
                            <CreditCard size={13} />
                          </button>
                          {c.id !== 1 && (
                            <>
                              <button
                                id={`customer-edit-${c.id}`}
                                onClick={() => openEditModal(c)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Edit Customer"
                              >
                                <Edit2 size={13} />
                              </button>
                              {!isRestricted && (
                                <button
                                  id={`customer-delete-${c.id}`}
                                  onClick={() => onDeleteCustomer(c.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                  title="Delete Customer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* INTEGRATED CUSTOMER PROFILE & STATEMENT DASHBOARD DRAWER */}
        {viewingHistoryCustomerId && activeHistoryCustomer && (
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 animate-slide-left h-fit">
            <div className="flex justify-between items-start pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Landmark size={15} className="text-blue-600" />
                  {activeHistoryCustomer.name} Profile
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">ID: #{activeHistoryCustomer.id} | WhatsApp: {activeHistoryCustomer.whatsappNumber || 'None'}</p>
              </div>
              <button
                id="customer-history-close"
                onClick={() => setViewingHistoryCustomerId(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-full hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Tab Switcher */}
            <div className="flex border-b border-slate-150 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setActiveProfileTab('stats')}
                className={`flex-1 py-1.5 text-center border-b-2 cursor-pointer transition-colors ${
                  activeProfileTab === 'stats' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Stats & Pay
              </button>
              <button
                type="button"
                onClick={() => setActiveProfileTab('sales')}
                className={`flex-1 py-1.5 text-center border-b-2 cursor-pointer transition-colors ${
                  activeProfileTab === 'sales' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Purchases ({customerHistorySales.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveProfileTab('loans')}
                className={`flex-1 py-1.5 text-center border-b-2 cursor-pointer transition-colors ${
                  activeProfileTab === 'loans' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Loan History ({customerHistoryLoans.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveProfileTab('statement')}
                className={`flex-1 py-1.5 text-center border-b-2 cursor-pointer transition-colors ${
                  activeProfileTab === 'statement' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Statement Generator
              </button>
            </div>

            {/* Tab content 1: Stats & Direct Loan Recovery form */}
            {activeProfileTab === 'stats' && (
              <div className="space-y-4 animate-fade-in">
                {/* Statistics Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Total Purchases</span>
                    <span className="font-mono text-xs font-bold text-slate-800">{settings.currencySymbol} {totalPurchases.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Total Paid</span>
                    <span className="font-mono text-xs font-bold text-emerald-600">{settings.currencySymbol} {totalPaidTotal.toFixed(2)}</span>
                  </div>
                  <div className="bg-red-50/40 border border-red-100 p-2.5 rounded-xl">
                    <span className="block text-[9px] text-red-500 font-bold uppercase">Outstanding Loan</span>
                    <span className="font-mono text-xs font-black text-red-600">{settings.currencySymbol} {currentOutstanding.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Total Loan Given</span>
                    <span className="font-mono text-xs font-bold text-slate-800">{settings.currencySymbol} {totalLoanGiven.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Loan Recovered</span>
                    <span className="font-mono text-xs font-bold text-emerald-600">{settings.currencySymbol} {totalLoanRecovered.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl">
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">Credit Purchases</span>
                    <span className="font-mono text-xs font-bold text-slate-800">{creditPurchasesCount} orders</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="bg-slate-50/50 border border-slate-150 p-3 rounded-xl text-[10px] space-y-1.5 text-slate-600">
                    <h4 className="font-bold text-slate-700 uppercase tracking-wider">Activity Logs</h4>
                    <div className="flex justify-between">
                      <span>Last Purchase Date:</span>
                      <strong className="text-slate-800 font-mono">{lastPurchaseDate}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Payment Date:</span>
                      <strong className="text-slate-800 font-mono">{lastPaymentDate}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Account Status:</span>
                      <span className={`px-1 rounded font-bold ${currentOutstanding > 0 ? 'bg-amber-150 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {currentOutstanding > 0 ? 'Outstanding Loan' : 'Settled / No Balance'}
                      </span>
                    </div>
                  </div>

                  {/* DIRECT LOAN PAYMENT WORKFLOW FORM (REQUIREMENT 7) */}
                  {activeHistoryCustomer.id !== 1 && currentOutstanding > 0 && (
                    <form onSubmit={handlePayLoanSubmit} className="bg-blue-50/30 border border-blue-100/60 p-3 rounded-xl space-y-2.5">
                      <h4 className="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                        <DollarSign size={12} /> Pay Outstanding Loan
                      </h4>
                      {paymentError && <div className="text-[10px] text-red-600 font-semibold">{paymentError}</div>}
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Amount to pay</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Enter amount"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Method</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Bank">Bank Transfer</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Add payment notes/remarks..."
                          value={paymentRemarks}
                          onChange={(e) => setPaymentRemarks(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 rounded-lg text-[10px] cursor-pointer text-center"
                      >
                        Process Loan Paydown Receipt
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Tab content 2: Sales Purchases List */}
            {activeProfileTab === 'sales' && (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 animate-fade-in text-[11px]">
                {customerHistorySales.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">No purchases yet.</div>
                ) : (
                  customerHistorySales.map((s) => {
                    const remaining = s.grandTotal - s.paidAmount;
                    const status = remaining <= 0 ? 'Paid' : s.paidAmount > 0 ? 'Partial' : 'Loan';
                    return (
                      <div key={s.id} className="border border-slate-100 rounded-xl p-2.5 bg-slate-50/50 flex justify-between items-center">
                        <div>
                          <span className="font-mono font-bold text-slate-850 block">{s.invoiceNo}</span>
                          <span className="text-[9px] text-slate-400 block">{new Date(s.saleDate).toLocaleString()}</span>
                        </div>
                        <div className="text-right space-y-0.5">
                          <span className="font-mono font-bold text-slate-800 block">Total: {settings.currencySymbol}{s.grandTotal.toFixed(2)}</span>
                          <div className="flex gap-1.5 justify-end items-center text-[9px]">
                            <span className="text-slate-400">Paid: {settings.currencySymbol}{s.paidAmount.toFixed(2)}</span>
                            <span className={`px-1 py-0.2 rounded font-bold ${
                              status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>{status}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab content 3: Loan History list (Requirement 3) */}
            {activeProfileTab === 'loans' && (
              <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1 animate-fade-in text-[11px]">
                {customerHistoryLoans.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">No loan records active for this customer.</div>
                ) : (
                  customerHistoryLoans.map((l) => {
                    // Derive the installments applied to THIS loan by replaying
                    // the customer's payments FIFO (composite payments can span
                    // multiple loans, so the old lp.invoiceNumber filter only ever
                    // matched the FIFO-first invoice and left every other loan
                    // showing an empty installment list).
                    const installments = customerHistoryPayments
                      .map((p) => {
                        const split = (paymentAllocation.get(p.id) || []).find(
                          (s) => s.invoiceNumber === l.invoiceNumber
                        );
                        return split ? { id: p.id, paymentDate: p.paymentDate, paymentMethod: p.paymentMethod, amount: split.amount } : null;
                      })
                      .filter((x): x is { id: number; paymentDate: string; paymentMethod: 'Cash' | 'Bank' | 'Other'; amount: number } => x !== null);
                    const isOverdue = l.remainingBalance > 0 && l.dueDate && new Date(l.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
                    return (
                      <div key={l.id} className="border border-slate-150 rounded-2xl p-3 bg-slate-50/50 space-y-2.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800">{l.invoiceNumber}</span>
                              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                l.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 animate-pulse-once'
                              }`}>{l.status}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 block mt-0.5">Assigned: {new Date(l.loanDate).toLocaleDateString()}</span>
                          </div>
                          <div className="text-right space-y-0.5 font-mono">
                            <span className="text-[9px] text-slate-500 block">Total Bill: {settings.currencySymbol}{l.billAmount.toFixed(2)}</span>
                            <span className="text-xs font-bold text-red-600 block">Outstanding: {settings.currencySymbol}{l.remainingBalance.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Due Date & Installment status */}
                        <div className="bg-white border border-slate-100 p-2 rounded-xl flex justify-between items-center text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Next Due Date:</span>
                            <span className={`font-mono font-black ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                              {l.dueDate ? new Date(l.dueDate).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          {isOverdue && (
                            <span className="bg-red-100 text-red-800 text-[8px] font-black px-1.5 py-0.2 rounded-sm uppercase">Overdue</span>
                          )}
                        </div>

                        {/* Payment Installment Schedule / History */}
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Installment History</span>
                          {installments.length === 0 ? (
                            <div className="text-[9px] text-slate-400 italic bg-white/40 p-1.5 rounded-lg border border-slate-100">No installments settled yet. Only opening deposit.</div>
                          ) : (
                            <div className="bg-white border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden font-mono text-[9px]">
                              {installments.map((inst, idx) => (
                                <div key={inst.id} className="p-1.5 flex justify-between items-center">
                                  <div className="flex items-center gap-1.5 text-slate-500">
                                    <span>#{idx + 1}</span>
                                    <span>{new Date(inst.paymentDate).toLocaleDateString()}</span>
                                    <span className="bg-slate-100 text-slate-600 px-1 rounded-sm text-[8px]">{inst.paymentMethod}</span>
                                  </div>
                                  <span className="font-bold text-emerald-600">+{settings.currencySymbol}{inst.amount.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab content 4: Customer Printable Statement Generator (Requirement 6) */}
            {activeProfileTab === 'statement' && (() => {
              const ledgerData = getCustomerLedger(activeHistoryCustomer);
              return (
                <div className="space-y-3.5 animate-fade-in">
                  <div className="flex justify-end gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => triggerPrint('printable-customer-statement')}
                      className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      <Printer size={12} /> Print Statement
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        safePdfExport(() =>
                          generateCustomerStatementPdf(settings, activeHistoryCustomer, ledgerData, {
                            totalPurchases,
                            totalPaid: totalPaidTotal,
                            totalLoanGiven,
                            currentOutstanding,
                          })
                        );
                      }}
                      className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      <Download size={12} /> Export PDF
                    </button>
                  </div>

                  {/* Printable Statement Canvas */}
                  <div
                    id="printable-customer-statement"
                    className="bg-slate-50 border border-slate-200 p-4 rounded-xl font-mono text-[10px] text-slate-800 space-y-3 leading-relaxed"
                  >
                    <div className="print-only-header">
                      <strong>{settings.shopName}</strong>
                      <div>{settings.shopAddress} | Tel: {settings.phone}</div>
                      <div>Customer Statement | {new Date().toLocaleString()}</div>
                    </div>
                    <div className="text-center pb-1 border-b border-dashed border-slate-300">
                      <h4 className="text-xs font-bold uppercase">{settings.shopName}</h4>
                      <p className="text-[8px] text-slate-500">Statement of Customer Account Activity</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-600">
                      <div>
                        <p><strong>Customer Name:</strong> {activeHistoryCustomer.name}</p>
                        <p><strong>Phone Number:</strong> {activeHistoryCustomer.phone}</p>
                        <p><strong>WhatsApp:</strong> {activeHistoryCustomer.whatsappNumber || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p><strong>Statement Date:</strong> {new Date().toLocaleDateString()}</p>
                        <p><strong>Opening Balance:</strong> {settings.currencySymbol}{activeHistoryCustomer.openingBalance.toFixed(2)}</p>
                        <p className="text-red-600 font-bold"><strong>Closing Balance:</strong> {settings.currencySymbol}{currentOutstanding.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Summary aggregate info */}
                    <div className="border-t border-b border-dashed border-slate-300 py-1.5 grid grid-cols-4 gap-1 text-[9px] text-center font-bold">
                      <div>
                        <span className="block text-[8px] text-slate-400 font-medium">TOTAL BILLS</span>
                        <span>{settings.currencySymbol}{totalPurchases.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-slate-400 font-medium">TOTAL PAID</span>
                        <span>{settings.currencySymbol}{totalPaidTotal.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-slate-400 font-medium">LOANS GRANTED</span>
                        <span>{settings.currencySymbol}{totalLoanGiven.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-slate-400 font-medium font-bold text-red-600">OUTSTANDING</span>
                        <span>{settings.currencySymbol}{currentOutstanding.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Activity History Ledger */}
                    <div className="space-y-1">
                      <span className="font-bold text-[9px] block text-slate-600 uppercase border-b border-dashed border-slate-200 pb-0.5">Activity Ledger Statement</span>
                      <div className="overflow-x-auto max-h-[160px] overflow-y-auto pr-0.5">
                        <table className="w-full text-left text-[9px] border-collapse font-mono">
                          <thead>
                            <tr className="border-b border-dashed border-slate-300 font-bold uppercase text-slate-400">
                              <th className="py-1">Date</th>
                              <th className="py-1">Description</th>
                              <th className="py-1 text-right">Debit (+)</th>
                              <th className="py-1 text-right">Credit (-)</th>
                              <th className="py-1 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dashed divide-slate-150">
                            {activeHistoryCustomer.openingBalance > 0 && (
                              <tr>
                                <td className="py-1 text-slate-400">Opening</td>
                                <td className="py-1 text-slate-400">Opening Balance</td>
                                <td className="py-1 text-right">—</td>
                                <td className="py-1 text-right">—</td>
                                <td className="py-1 text-right font-bold text-slate-600">
                                  {settings.currencySymbol}{activeHistoryCustomer.openingBalance.toFixed(2)}
                                </td>
                              </tr>
                            )}
                            {ledgerData.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-100">
                                <td className="py-1 text-slate-500 font-mono">{new Date(row.date).toLocaleDateString()}</td>
                                <td className="py-1 text-slate-700 font-sans max-w-[120px] truncate">{row.description}</td>
                                <td className="py-1 text-right text-red-600">
                                  {row.debit > 0 ? `${settings.currencySymbol}${row.debit.toFixed(2)}` : '—'}
                                </td>
                                <td className="py-1 text-right text-emerald-600 font-bold">
                                  {row.credit > 0 ? `${settings.currencySymbol}${row.credit.toFixed(2)}` : '—'}
                                </td>
                                <td className="py-1 text-right font-bold text-slate-800">
                                  {settings.currencySymbol}{row.runningBalance.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="print-only-footer">
                      {settings.receiptFooter} — Powered by Smart Shop Management System
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Direct Loan Payment Printable Thermal Receipt Popup Modal (Requirement 7) */}
      {lastPaymentReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-slate-150">
              <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                <Receipt size={14} className="text-blue-600" />
                Loan Payment Receipt
              </h3>
              <button
                type="button"
                onClick={() => setLastPaymentReceipt(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Receipt Content */}
            <div
              id="printable-payment-receipt"
              className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl font-mono text-slate-800 text-[11px] leading-relaxed max-h-[300px] overflow-y-auto"
            >
              <div className="print-only-header">
                <strong>{settings.shopName}</strong>
                <div>{settings.shopAddress} | Tel: {settings.phone}</div>
                <div>Printed: {new Date().toLocaleString()}</div>
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold uppercase tracking-wider">{settings.shopName}</h4>
                <p className="text-[10px] text-slate-500">{settings.shopAddress}</p>
                <p className="text-[10px] text-slate-500">Tel: {settings.phone}</p>
                <div className="border-t border-dashed border-slate-300 my-2"></div>
              </div>

              <div className="space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>RECEIPT NO:</span>
                  <span className="font-bold">{lastPaymentReceipt.receiptNo}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE/TIME:</span>
                  <span>{new Date(lastPaymentReceipt.paymentDate).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span className="font-bold">{lastPaymentReceipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>CONTACT:</span>
                  <span>{lastPaymentReceipt.phone}</span>
                </div>
                <div className="border-t border-dashed border-slate-300 my-2"></div>
              </div>

              <div className="space-y-1.5 text-right font-bold text-slate-800">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>OUTSTANDING BEFORE:</span>
                  <span>{settings.currencySymbol} {lastPaymentReceipt.outstandingBefore.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>RECOVERED AMOUNT:</span>
                  <span>{settings.currencySymbol} {lastPaymentReceipt.paymentAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-900 border-t border-dashed border-slate-300 pt-1">
                  <span>OUTSTANDING AFTER:</span>
                  <span>{settings.currencySymbol} {lastPaymentReceipt.outstandingAfter.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-dashed border-slate-200">
                <p><strong>Remarks:</strong> {lastPaymentReceipt.remarks}</p>
                <p><strong>Payment Method:</strong> {lastPaymentReceipt.paymentMethod}</p>
              </div>

              <div className="text-center mt-4 pt-2 border-t border-dashed border-slate-300">
                <p className="text-[9px] text-slate-500 uppercase">{settings.receiptFooter}</p>
                <p className="text-[8px] text-slate-400 mt-1">RETAIN FOR ACCOUNT RECORDS</p>
              </div>
              <div className="print-only-footer">{settings.receiptFooter} — Powered by Smart Retailer</div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLastPaymentReceipt(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer text-center"
              >
                Close
              </button>
              <button
                type="button"
                onClick={printPaymentReceipt}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer text-center flex items-center justify-center gap-1"
              >
                <Printer size={13} />
                Print
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!lastPaymentReceipt) return;
                  safePdfExport(() =>
                    generateCustomPaymentReceiptPdf(settings, {
                      receiptNo: lastPaymentReceipt.receiptNo,
                      customerName: lastPaymentReceipt.customerName,
                      phone: lastPaymentReceipt.phone,
                      paymentAmount: lastPaymentReceipt.paymentAmount,
                      outstandingBefore: lastPaymentReceipt.outstandingBefore,
                      outstandingAfter: lastPaymentReceipt.outstandingAfter,
                      paymentDate: lastPaymentReceipt.paymentDate,
                      paymentMethod: lastPaymentReceipt.paymentMethod,
                      remarks: lastPaymentReceipt.remarks,
                    })
                  );
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer text-center flex items-center justify-center gap-1"
              >
                <Download size={13} />
                PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-scale-up" id="customer-modal">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold font-display text-slate-800">
                {editingCustomer ? 'Update Customer Record' : 'Register New Customer'}
              </h3>
              <button
                id="customer-modal-close"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 border border-red-100 p-3 rounded-2xl flex items-start gap-2 text-xs">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Customer Name *</label>
                <input
                  id="customer-form-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Muhammad Ali"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Mobile Phone Number *</label>
                <input
                  id="customer-form-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="e.g. 0300-1234567"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">WhatsApp Number (Optional)</label>
                <input
                  id="customer-form-whatsapp"
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="e.g. 03001234567"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Opening Balance</label>
                <input
                  id="customer-form-opening-balance"
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
                <input
                  id="customer-form-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. customer@domain.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Residential/Business Address</label>
                <textarea
                  id="customer-form-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 h-20"
                  placeholder="Enter full address"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
                <textarea
                  id="customer-form-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 h-20"
                  placeholder="Customer notes"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  id="customer-form-cancel"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="customer-form-submit"
                  className="bg-blue-600 hover:bg-blue-50 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-blue-600/10 cursor-pointer"
                >
                  {editingCustomer ? 'Update Profile' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
