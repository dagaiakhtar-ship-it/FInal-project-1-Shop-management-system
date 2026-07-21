import React, { useState } from 'react';
import { Sale, Product, Customer, Supplier, Settings, Loan, LoanPayment } from '../types';
import {
  Calendar,
  BarChart2,
  TrendingUp,
  DollarSign,
  Trophy,
  ArrowRight,
  Truck,
  Printer,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  Users,
  AlertCircle
} from 'lucide-react';
import { generateReportTabPdf, ReportTab } from '../utils/pdfDocument';
import { triggerPrint, safePdfExport } from '../utils/printUtils';
import {
  getSaleStatus,
  getSaleRemaining,
  getCashReceipts,
  getLoansGranted,
  round2,
} from '../utils/finance';

interface ReportsViewProps {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  settings: Settings;
}

export default function ReportsView({
  sales,
  products,
  customers,
  suppliers,
  loans,
  loanPayments,
  settings,
}: ReportsViewProps) {
  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'customers' | 'loans' | 'daily' | 'monthly'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Outstanding' | 'Partial'>('all');

  // Helper date filters
  const filterByDateRange = (dateStr: string) => {
    if (!dateStr) return true;
    const dateObj = new Date(dateStr);
    if (!dateFrom && !dateTo) return true;
    
    if (dateFrom) {
      const fromObj = new Date(dateFrom);
      fromObj.setHours(0, 0, 0, 0);
      if (dateObj < fromObj) return false;
    }
    if (dateTo) {
      const toObj = new Date(dateTo);
      toObj.setHours(23, 59, 59, 999);
      if (dateObj > toObj) return false;
    }
    return true;
  };

  // ==================== 1. SALES REPORT ====================
  const getFilteredSalesReport = () => {
    return sales.filter(s => {
      const cust = customers.find(c => c.id === s.customerId);
      const custName = cust ? cust.name : 'Walk-in Customer';
      
      const matchSearch = s.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          custName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchDate = filterByDateRange(s.saleDate);
      
      const rem = getSaleRemaining(s, loans);
      const status = getSaleStatus(s, loans);
      // The shared statusFilter token is 'Outstanding' (used by customer & loan
      // reports too). For sales, the engine returns 'Credit' for the unpaid
      // state, so map the filter token here. Without this, "Outstanding Loan"
      // would silently drop every credit sale (Bug #7).
      const matchStatus = statusFilter === 'all' ||
        (statusFilter === 'Outstanding' && status === 'Credit') ||
        status === statusFilter;

      return matchSearch && matchDate && matchStatus;
    });
  };
  const filteredSales = getFilteredSalesReport();

  // ==================== 2. CUSTOMER REPORT ====================
  const getFilteredCustomerReport = () => {
    return customers.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.phone.includes(searchQuery);
      
      const hasLoan = c.balance > 0;
      const matchStatus = statusFilter === 'all' || 
                          (statusFilter === 'Outstanding' && hasLoan) || 
                          (statusFilter === 'Paid' && !hasLoan);
      
      return matchSearch && matchStatus;
    });
  };
  const filteredCustomers = getFilteredCustomerReport();

  // ==================== 3. LOAN REPORT ====================
  const getFilteredLoanReport = () => {
    return loans.filter(l => {
      const cust = customers.find(c => c.id === l.customerId);
      const custName = cust ? cust.name : 'Unknown';
      
      const matchSearch = l.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          custName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchDate = filterByDateRange(l.loanDate);
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;

      return matchSearch && matchDate && matchStatus;
    });
  };
  const filteredLoans = getFilteredLoanReport();

  // ==================== 4. DAILY REPORT ====================
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.saleDate.startsWith(todayStr));
  const todayRecoveries = loanPayments.filter(p => p.paymentDate.startsWith(todayStr));
  
  const todayGross = todaySales.reduce((sum, s) => sum + s.grandTotal, 0);
  const todayCashCollected = round2(todaySales.reduce((sum, s) => sum + s.paidAmount, 0) + todayRecoveries.reduce((sum, p) => sum + p.amount, 0));
  // Loans GRANTED today = credit EXTENDED at checkout on loans created today
  // (billAmount − checkout payment). NOT current outstanding receivables, which
  // would conflate historical credit with today's unpaid balances.
  const todayLoansGranted = getLoansGranted(loans, sales, todayStr);
  const todayLoansRecovered = todayRecoveries.reduce((sum, p) => sum + p.amount, 0);

  // ==================== 5. MONTHLY REPORT ====================
  const curMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const monthlySales = sales.filter(s => s.saleDate.startsWith(curMonthStr));
  const monthlyRecoveries = loanPayments.filter(p => p.paymentDate.startsWith(curMonthStr));

  const monthlyGross = monthlySales.reduce((sum, s) => sum + s.grandTotal, 0);
  const monthlyCashCollected = round2(monthlySales.reduce((sum, s) => sum + s.paidAmount, 0) + monthlyRecoveries.reduce((sum, p) => sum + p.amount, 0));
  const monthlyLoansGranted = getLoansGranted(loans, sales, curMonthStr);
  const monthlyLoansRecovered = monthlyRecoveries.reduce((sum, p) => sum + p.amount, 0);

  // ==================== EXPORTS GENERATION ====================
  
  // A. CSV Export Handler
  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (activeReportTab === 'sales') {
      csvContent += "Invoice No,Customer,Date,Grand Total,Amount Paid,Loan Outstanding,Payment Status\n";
      filteredSales.forEach(s => {
        const custName = customers.find(c => c.id === s.customerId)?.name || 'Walk-in Customer';
        const rem = getSaleRemaining(s, loans);
        const status = getSaleStatus(s, loans);
        csvContent += `"${s.invoiceNo}","${custName}","${s.saleDate}",${s.grandTotal},${s.paidAmount},${rem},"${status}"\n`;
      });
    } else if (activeReportTab === 'customers') {
      csvContent += "Customer Name,Phone,Email,Opening Balance,Outstanding Loan Balance\n";
      filteredCustomers.forEach(c => {
        csvContent += `"${c.name}","${c.phone}","${c.email || 'N/A'}",${c.openingBalance},${c.balance}\n`;
      });
    } else if (activeReportTab === 'loans') {
      csvContent += "Invoice No,Customer,Loan Date,Bill Amount,Settled Amount,Outstanding Balance,Status\n";
      filteredLoans.forEach(l => {
        const custName = customers.find(c => c.id === l.customerId)?.name || 'Unknown';
        csvContent += `"${l.invoiceNumber}","${custName}","${l.loanDate}",${l.billAmount},${l.paidAmount},${l.remainingBalance},"${l.status}"\n`;
      });
    } else if (activeReportTab === 'daily') {
      csvContent += "Daily Summary Metric,Value\n";
      csvContent += `Gross Sales,${todayGross}\n`;
      csvContent += `Cash Collected,${todayCashCollected}\n`;
      csvContent += `Loans Granted,${todayLoansGranted}\n`;
      csvContent += `Loans Recovered,${todayLoansRecovered}\n`;
    } else if (activeReportTab === 'monthly') {
      csvContent += "Monthly Summary Metric,Value\n";
      csvContent += `Gross Monthly Sales,${monthlyGross}\n`;
      csvContent += `Cash Collected,${monthlyCashCollected}\n`;
      csvContent += `Loans Granted,${monthlyLoansGranted}\n`;
      csvContent += `Loans Recovered,${monthlyLoansRecovered}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${activeReportTab}_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // B. PDF Report Export Handler
  const exportToPDF = () => {
    safePdfExport(() =>
      generateReportTabPdf({
        settings,
        tab: activeReportTab as ReportTab,
        sales: filteredSales,
        customers: filteredCustomers,
        loans: filteredLoans,
        sym: settings.currencySymbol,
        todayGross,
        todayCashCollected,
        todayLoansGranted,
        todayLoansRecovered,
        monthlyGross,
        monthlyCashCollected,
        monthlyLoansGranted,
        monthlyLoansRecovered,
      })
    );
  };

  return (
    <div className="space-y-6" id="reports-panel">
      {/* Tab Select Header Row */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-3xs overflow-x-auto max-w-2xl gap-1">
        <button
          id="report-tab-sales"
          onClick={() => { setActiveReportTab('sales'); setSearchQuery(''); }}
          className={`px-4 py-2 text-xs font-bold cursor-pointer rounded-xl transition-all whitespace-nowrap ${
            activeReportTab === 'sales' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Sales Report
        </button>
        <button
          id="report-tab-customers"
          onClick={() => { setActiveReportTab('customers'); setSearchQuery(''); }}
          className={`px-4 py-2 text-xs font-bold cursor-pointer rounded-xl transition-all whitespace-nowrap ${
            activeReportTab === 'customers' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Customer Report
        </button>
        <button
          id="report-tab-loans"
          onClick={() => { setActiveReportTab('loans'); setSearchQuery(''); }}
          className={`px-4 py-2 text-xs font-bold cursor-pointer rounded-xl transition-all whitespace-nowrap ${
            activeReportTab === 'loans' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Loan Report
        </button>
        <button
          id="report-tab-daily"
          onClick={() => { setActiveReportTab('daily'); setSearchQuery(''); }}
          className={`px-4 py-2 text-xs font-bold cursor-pointer rounded-xl transition-all whitespace-nowrap ${
            activeReportTab === 'daily' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Daily Report
        </button>
        <button
          id="report-tab-monthly"
          onClick={() => { setActiveReportTab('monthly'); setSearchQuery(''); }}
          className={`px-4 py-2 text-xs font-bold cursor-pointer rounded-xl transition-all whitespace-nowrap ${
            activeReportTab === 'monthly' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Monthly Report
        </button>
      </div>

      {/* SEARCH, DATE & FILTER CONTROLS (REQUIREMENT 5) */}
      {['sales', 'customers', 'loans'].includes(activeReportTab) && (
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-3xs grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search query input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeReportTab === 'customers' ? "Search Name/Phone..." : "Search Invoice/Customer..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl pl-8.5 pr-3 py-1.5 text-slate-800 focus:outline-none text-xs"
            />
          </div>

          {/* Date range picker FROM */}
          {activeReportTab !== 'customers' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none"
              />
            </div>
          )}

          {/* Date range picker TO */}
          {activeReportTab !== 'customers' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none"
              />
            </div>
          )}

          {/* Outstanding Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Loan Statuses</option>
              <option value="Paid">Paid / Settled</option>
              <option value="Outstanding">Outstanding Loan</option>
              <option value="Partial">Partially Paid</option>
            </select>
          </div>
        </div>
      )}

      {/* UTILITY EXPORT BUTTONS ROW (REQUIREMENT 5) */}
      <div className="flex justify-end gap-2 text-xs no-print">
        <button
          type="button"
          onClick={() => triggerPrint('printable-reports')}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl cursor-pointer"
        >
          <Printer size={13} /> Print Report
        </button>
        <button
          type="button"
          onClick={exportToCSV}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl cursor-pointer"
        >
          <FileSpreadsheet size={13} /> Export CSV
        </button>
        <button
          type="button"
          onClick={exportToPDF}
          className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl cursor-pointer"
        >
          <FileText size={13} /> Export PDF
        </button>
      </div>

      {/* REPORT CONTENT CANVAS */}
      <div id="printable-reports" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="print-only-header">
          <strong>{settings.shopName}</strong>
          <div>{settings.shopAddress} | Tel: {settings.phone}</div>
          <div>{activeReportTab.toUpperCase()} REPORT | Generated: {new Date().toLocaleString()}</div>
        </div>
        
        {/* TAB 1: SALES REPORT VIEW */}
        {activeReportTab === 'sales' && (
          <div className="space-y-4 animate-fade-in">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-blue-600" />
              Comprehensive Sales & Invoicing Ledger
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                    <th className="py-2 px-3">Invoice No</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3 text-right">Bill Amt</th>
                    <th className="py-2 px-3 text-right">Paid Amt</th>
                    <th className="py-2 px-3 text-right">Loan Bal</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-mono text-[11px]">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-sans">No matching sales records.</td>
                    </tr>
                  ) : (
                    filteredSales.map(s => {
                      const rem = getSaleRemaining(s, loans);
                      const status = getSaleStatus(s, loans);
                      const custName = customers.find(c => c.id === s.customerId)?.name || 'Walk-in Customer';
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-bold text-slate-800">{s.invoiceNo}</td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-700">{custName}</td>
                          <td className="py-2 px-3 text-slate-400">{new Date(s.saleDate).toLocaleDateString()}</td>
                          <td className="py-2 px-3 text-right text-slate-800">{settings.currencySymbol}{s.grandTotal.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-emerald-600">{settings.currencySymbol}{s.paidAmount.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-red-600 font-bold">{settings.currencySymbol}{rem.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.2 rounded font-bold text-[9px] ${
                              status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>{status}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: CUSTOMER REPORT VIEW */}
        {activeReportTab === 'customers' && (
          <div className="space-y-4 animate-fade-in">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Users size={14} className="text-blue-600" />
              Customer Credit Balances Ledger
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                    <th className="py-2 px-3">Customer ID</th>
                    <th className="py-2 px-3">Customer Name</th>
                    <th className="py-2 px-3">Phone</th>
                    <th className="py-2 px-3">Email Address</th>
                    <th className="py-2 px-3 text-right">Outstanding Credit Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-mono text-[11px]">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 font-sans">No customers match search.</td>
                    </tr>
                  ) : (
                    filteredCustomers.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-bold text-slate-800">#{c.id}</td>
                        <td className="py-2 px-3 font-sans font-medium text-slate-700">{c.name}</td>
                        <td className="py-2 px-3 font-sans text-slate-600">{c.phone}</td>
                        <td className="py-2 px-3 font-sans text-slate-400">{c.email || '—'}</td>
                        <td className="py-2 px-3 text-right text-red-600 font-bold">{settings.currencySymbol}{c.balance.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LOAN REPORT VIEW */}
        {activeReportTab === 'loans' && (
          <div className="space-y-4 animate-fade-in">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <BarChart2 size={14} className="text-blue-600" />
              Store Credit Loans & Recovery Analysis
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                    <th className="py-2 px-3">Invoice No</th>
                    <th className="py-2 px-3">Customer Profile</th>
                    <th className="py-2 px-3">Loan Date</th>
                    <th className="py-2 px-3 text-right">Bill Amount</th>
                    <th className="py-2 px-3 text-right">Settled Amount</th>
                    <th className="py-2 px-3 text-right">Outstanding Balance</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-mono text-[11px]">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-sans">No active loan records match filter.</td>
                    </tr>
                  ) : (
                    filteredLoans.map(l => {
                      const custName = customers.find(c => c.id === l.customerId)?.name || 'Unknown';
                      return (
                        <tr key={l.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-bold text-slate-800">{l.invoiceNumber}</td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-700">{custName}</td>
                          <td className="py-2 px-3 text-slate-400">{new Date(l.loanDate).toLocaleDateString()}</td>
                          <td className="py-2 px-3 text-right">{settings.currencySymbol}{l.billAmount.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-emerald-600">{settings.currencySymbol}{l.paidAmount.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-red-600 font-bold">{settings.currencySymbol}{l.remainingBalance.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.2 rounded font-bold text-[9px] uppercase ${
                              l.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 animate-pulse-once'
                            }`}>{l.status}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DAILY REPORT VIEW */}
        {activeReportTab === 'daily' && (
          <div className="space-y-6 animate-fade-in text-slate-750">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-850 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" />
              Daily Sales & Credit Performance
            </h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                <span className="block text-[8px] text-slate-400 font-bold uppercase">Gross Invoiced today</span>
                <span className="font-mono text-sm font-black text-slate-800">{settings.currencySymbol}{todayGross.toFixed(2)}</span>
              </div>
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                <span className="block text-[8px] text-slate-400 font-bold uppercase">Cash collected today</span>
                <span className="font-mono text-sm font-black text-emerald-600">{settings.currencySymbol}{todayCashCollected.toFixed(2)}</span>
              </div>
              <div className="bg-red-50/30 border border-red-100 p-3 rounded-xl">
                <span className="block text-[8px] text-red-500 font-bold uppercase">Credit Loans granted</span>
                <span className="font-mono text-sm font-black text-red-600">{settings.currencySymbol}{todayLoansGranted.toFixed(2)}</span>
              </div>
              <div className="bg-emerald-50/30 border border-emerald-100 p-3 rounded-xl">
                <span className="block text-[8px] text-emerald-600 font-bold uppercase">Credit Loans Recovered</span>
                <span className="font-mono text-sm font-black text-emerald-700">{settings.currencySymbol}{todayLoansRecovered.toFixed(2)}</span>
              </div>
            </div>

            <div className="border border-slate-150 p-4 rounded-xl space-y-2">
              <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 block">Today's Transactions Summary</span>
              <div className="flex justify-between text-xs">
                <span>Invoiced Checkout Transactions Count:</span>
                <span className="font-bold font-mono text-slate-800">{todaySales.length} checkouts</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Loan Recoveries Count:</span>
                <span className="font-bold font-mono text-slate-800">{todayRecoveries.length} received</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MONTHLY REPORT VIEW */}
        {activeReportTab === 'monthly' && (
          <div className="space-y-6 animate-fade-in text-slate-750">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-850 border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" />
              Monthly Sales & Credit Performance
            </h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                <span className="block text-[8px] text-slate-400 font-bold uppercase">Gross Monthly sales</span>
                <span className="font-mono text-sm font-black text-slate-800">{settings.currencySymbol}{monthlyGross.toFixed(2)}</span>
              </div>
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
                <span className="block text-[8px] text-slate-400 font-bold uppercase">Monthly Cash Collected</span>
                <span className="font-mono text-sm font-black text-emerald-600">{settings.currencySymbol}{monthlyCashCollected.toFixed(2)}</span>
              </div>
              <div className="bg-red-50/30 border border-red-100 p-3 rounded-xl">
                <span className="block text-[8px] text-red-500 font-bold uppercase">Monthly Loans granted</span>
                <span className="font-mono text-sm font-black text-red-600">{settings.currencySymbol}{monthlyLoansGranted.toFixed(2)}</span>
              </div>
              <div className="bg-emerald-50/30 border border-emerald-100 p-3 rounded-xl">
                <span className="block text-[8px] text-emerald-600 font-bold uppercase">Monthly Loans Recovered</span>
                <span className="font-mono text-sm font-black text-emerald-700">{settings.currencySymbol}{monthlyLoansRecovered.toFixed(2)}</span>
              </div>
            </div>

            <div className="border border-slate-150 p-4 rounded-xl space-y-2">
              <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400 block">Current Month Transactions Summary</span>
              <div className="flex justify-between text-xs">
                <span>Monthly Checkout Transactions Count:</span>
                <span className="font-bold font-mono text-slate-800">{monthlySales.length} checkouts</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Monthly Loan Recoveries Count:</span>
                <span className="font-bold font-mono text-slate-800">{monthlyRecoveries.length} received</span>
              </div>
            </div>
          </div>
        )}
        <div className="print-only-footer">
          {settings.receiptFooter} — Powered by Smart Shop Management System
        </div>
      </div>
    </div>
  );
}
