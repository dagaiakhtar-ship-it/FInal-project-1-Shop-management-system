import React, { useMemo } from 'react';
import { Product, Category, Customer, Supplier, Sale, Settings, Loan, LoanPayment, Expense } from '../types';
import {
  Package,
  Tags,
  Users,
  Truck,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  CalendarDays,
  Receipt,
  ArrowUpRight,
  TrendingDown,
  UserCheck,
  UserMinus,
  Briefcase
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import {
  getTotalSales,
  getCashReceipts,
  getOutstandingReceivables,
  getLoanRecovery,
  getLoansGranted,
  getProfit,
} from '../utils/finance';

interface DashboardViewProps {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  settings: Settings;
  expenses: Expense[];
  onNavigate: (tab: string) => void;
}

export default function DashboardView({
  products,
  categories,
  customers,
  suppliers,
  sales,
  loans,
  loanPayments,
  settings,
  expenses,
  onNavigate,
}: DashboardViewProps) {
  // Calculations
  const totalProducts = products.length;
  const totalCategories = categories.length;
  const totalCustomers = customers.length;
  const totalSuppliers = suppliers.length;

  const lowStockThreshold = 10;
  const lowStockCount = products.filter((p) => p.quantity > 0 && p.quantity <= lowStockThreshold).length;
  const outOfStockCount = products.filter((p) => p.quantity === 0).length;

  // Sales aggregates — all derived from the centralized financial engine so
  // every dashboard card uses the SAME business rules as reports & statements.
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 1. Total Sales (Gross) = Σ every invoice grandTotal
  const totalSales = useMemo(() => getTotalSales(sales), [sales]);

  // 2. Cash Receipts = Σ checkout payments + ALL recoveries/installments
  const cashSales = useMemo(() => getCashReceipts(sales, loanPayments), [sales, loanPayments]);

  // 3. Credit / Outstanding Receivables = Σ remaining customer balances.
  //    Drives BOTH the "Credit Sales" card and the "Outstanding Loans" card so
  //    the two receivables figures can never disagree.
  const creditSales = useMemo(
    () => getOutstandingReceivables(customers, sales, loanPayments),
    [customers, sales, loanPayments]
  );

  // 4. Outstanding Loans (same authoritative receivables figure)
  const totalOutstandingLoan = creditSales;

  // 5. Loans Recovered Today (Direct payments processed today)
  const loansRecoveredToday = useMemo(
    () => getLoanRecovery(loanPayments, todayStr),
    [loanPayments, todayStr]
  );

  // 6. Active Credit Customers
  const activeCreditCustomers = customers.filter((c) => c.balance > 0).length;

  // 7. Customers with No Loan (Excluding Walk-in)
  const customersWithNoLoan = customers.filter((c) => c.id !== 1 && c.balance <= 0).length;

  // 8. Largest Outstanding Loan
  const largestOutstandingLoan = customers.reduce((max, c) => (c.id !== 1 && c.balance > max ? c.balance : max), 0);

  // 9. Total Pending Amount
  const totalPendingAmount = totalOutstandingLoan;

  // Revenue = Σ grandTotal (full invoice total; credit does NOT reduce revenue).
  // COGS = Σ item.costPrice × quantity — NEVER a fabricated estimate.
  const calculatePL = (startDateStr?: string) => getProfit(sales, expenses, startDateStr);

  const getStartDateStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const getStartOfYearStr = () => {
    return `${new Date().getFullYear()}-01-01`;
  };

  const todayPL = useMemo(() => calculatePL(todayStr), [sales, expenses, todayStr]);
  const weeklyPL = useMemo(() => calculatePL(getStartDateStr(7)), [sales, expenses]);
  const monthlyPL = useMemo(() => calculatePL(getStartDateStr(30)), [sales, expenses]);
  const yearlyPL = useMemo(() => calculatePL(getStartOfYearStr()), [sales, expenses]);
  const allTimePL = useMemo(() => calculatePL(), [sales, expenses]);

  const totalProfit = allTimePL.netProfit;

  // Recent 5 Sales
  const recentSales = [...sales].sort((a, b) => b.id - a.id).slice(0, 5);

  // CHARTS DATA CALCULATIONS (REQUIREMENT 4)

  // 1. Cash vs Credit Sales Split
  const cashVsCreditData = [
    { name: 'Cash Sales', value: cashSales },
    { name: 'Credit Sales', value: creditSales }
  ];
  const COLORS = ['#3b82f6', '#ef4444'];

  // 2. Outstanding Loan by Customer
  const outstandingByCustomerData = customers
    .filter(c => c.id !== 1 && c.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5)
    .map(c => ({
      name: c.name.length > 12 ? `${c.name.slice(0, 10)}..` : c.name,
      amount: c.balance
    }));

  // 3. Monthly Loan Trend & Monthly Loan Recovery (Requirement 4)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();

  const monthlyTrendsData = months.map((month, index) => {
    // Loans granted in this month — uses getLoansGranted for consistency
    // with ReportsView (credit extended = billAmount minus checkout payment).
    const monthStart = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
    const monthEnd = `${currentYear}-${String(index + 2).padStart(2, '0')}`;
    const monthlyLoansGranted = getLoansGranted(loans, sales, monthStart, monthEnd);
    // Loan recoveries received in this month
    const monthlyRecoveries = loanPayments.filter(lp => {
      const d = new Date(lp.paymentDate);
      return d.getMonth() === index && d.getFullYear() === currentYear;
    });

    return {
      month,
      loansGranted: monthlyLoansGranted,
      loansRecovered: monthlyRecoveries.reduce((sum, lp) => sum + lp.amount, 0)
    };
  });

  return (
    <div className="space-y-6" id="dashboard-panel">
      {/* 1. Core Retail Directory Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-150 p-3.5 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Package size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Total Products</p>
            <h3 className="text-base font-black text-slate-800 leading-none mt-0.5">{totalProducts}</h3>
          </div>
        </div>

        <div className="bg-white border border-slate-150 p-3.5 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Tags size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Categories</p>
            <h3 className="text-base font-black text-slate-800 leading-none mt-0.5">{totalCategories}</h3>
          </div>
        </div>

        <div className="bg-white border border-slate-150 p-3.5 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Users size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Registered Customers</p>
            <h3 className="text-base font-black text-slate-800 leading-none mt-0.5">{totalCustomers}</h3>
          </div>
        </div>

        <div className="bg-white border border-slate-150 p-3.5 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-xl shrink-0">
            <Truck size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">Suppliers</p>
            <h3 className="text-base font-black text-slate-800 leading-none mt-0.5">{totalSuppliers}</h3>
          </div>
        </div>
      </div>

      {/* 2. Customer Credit & Outstanding Loan Management Cards (Requirement 4) */}
      <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-3xl space-y-3.5">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Credit & Outstanding Loans Summary</h4>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Outstanding Loans */}
          <div className="bg-white border border-slate-150 p-3.5 rounded-2xl shadow-2xs">
            <span className="block text-[8px] text-slate-400 font-extrabold uppercase">Outstanding Loans</span>
            <span className="font-mono text-base font-black text-red-600 block mt-1">
              {settings.currencySymbol}{totalOutstandingLoan.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Recovered Today */}
          <div className="bg-white border border-slate-150 p-3.5 rounded-2xl shadow-2xs">
            <span className="block text-[8px] text-slate-400 font-extrabold uppercase">Recovered Today</span>
            <span className="font-mono text-base font-black text-emerald-600 block mt-1">
              {settings.currencySymbol}{loansRecoveredToday.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Active Credit Customers */}
          <div className="bg-white border border-slate-150 p-3.5 rounded-2xl shadow-2xs">
            <span className="block text-[8px] text-slate-400 font-extrabold uppercase">Credit Customers</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-mono text-base font-black text-slate-800">{activeCreditCustomers}</span>
              <span className="text-[9px] text-slate-400 font-bold">active</span>
            </div>
          </div>

          {/* Customers with No Loan */}
          <div className="bg-white border border-slate-150 p-3.5 rounded-2xl shadow-2xs">
            <span className="block text-[8px] text-slate-400 font-extrabold uppercase">Zero Loan Members</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-mono text-base font-black text-slate-800">{customersWithNoLoan}</span>
              <span className="text-[9px] text-slate-400 font-bold">clean</span>
            </div>
          </div>

          {/* Largest Outstanding Loan */}
          <div className="bg-white border border-slate-150 p-3.5 rounded-2xl shadow-2xs col-span-2 lg:col-span-1">
            <span className="block text-[8px] text-slate-400 font-extrabold uppercase">Largest Loan Size</span>
            <span className="font-mono text-base font-black text-red-700 block mt-1 truncate">
              {settings.currencySymbol}{largestOutstandingLoan.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Core Store Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Sales */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col justify-between shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-300 text-[9px] font-bold uppercase tracking-wider">Total Sales (Gross)</p>
              <h3 className="text-lg font-black font-mono mt-1">
                {settings.currencySymbol} {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="mt-4 flex justify-between text-[9px] text-slate-400">
            <span>Cumulative Sales History</span>
            <span className="font-bold text-white">100% Inflow</span>
          </div>
        </div>

        {/* Cash Sales */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Cash Receipts Paid</p>
              <h3 className="text-lg font-black font-mono text-slate-800 mt-1">
                {settings.currencySymbol} {cashSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <UserCheck size={15} />
            </div>
          </div>
          <div className="mt-4 flex justify-between text-[9px] text-slate-400">
            <span>In-Hand Cash Drawer</span>
            <span className="text-emerald-600 font-bold font-mono">
              {totalSales > 0 ? ((cashSales / totalSales) * 100).toFixed(0) : 0}% of sales
            </span>
          </div>
        </div>

        {/* Credit Sales */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Credit Sales Granted</p>
              <h3 className="text-lg font-black font-mono text-red-600 mt-1">
                {settings.currencySymbol} {creditSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">
              <UserMinus size={15} />
            </div>
          </div>
          <div className="mt-4 flex justify-between text-[9px] text-slate-400">
            <span>Receivables Ledger</span>
            <span className="text-red-500 font-bold font-mono">
              {totalSales > 0 ? ((creditSales / totalSales) * 100).toFixed(0) : 0}% on-credit
            </span>
          </div>
        </div>
      </div>

      {/* 2.5 Real-time Profit & Loss Dashboard ⭐⭐⭐⭐⭐ */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Profit & Loss Real-time Dashboard</h4>
            <p className="text-[10px] text-slate-400 font-medium">Accurate gross & net profit metrics subtracting cost of goods sold (COGS) and logged company expenses</p>
          </div>
          <button
            onClick={() => onNavigate('expenses')}
            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg cursor-pointer"
          >
            Manage Expenses &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Today */}
          <div className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-2xl flex flex-col justify-between font-sans">
            <div>
              <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Today's Profit</span>
              <span className={`text-base font-black font-mono block mt-1 ${todayPL.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {settings.currencySymbol}{todayPL.netProfit.toFixed(2)}
              </span>
            </div>
            <div className="mt-3.5 space-y-0.5 text-[9px] text-slate-400 font-mono">
              <div className="flex justify-between"><span>Sales:</span><span className="font-bold text-slate-700">{settings.currencySymbol}{todayPL.revenue.toFixed(0)}</span></div>
              <div className="flex justify-between"><span>Expenses:</span><span className="font-bold text-slate-700">{settings.currencySymbol}{todayPL.expenses.toFixed(0)}</span></div>
            </div>
          </div>

          {/* Weekly */}
          <div className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-2xl flex flex-col justify-between font-sans">
            <div>
              <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Weekly Profit (7d)</span>
              <span className={`text-base font-black font-mono block mt-1 ${weeklyPL.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {settings.currencySymbol}{weeklyPL.netProfit.toFixed(2)}
              </span>
            </div>
            <div className="mt-3.5 space-y-0.5 text-[9px] text-slate-400 font-mono">
              <div className="flex justify-between"><span>Sales:</span><span className="font-bold text-slate-700">{settings.currencySymbol}{weeklyPL.revenue.toFixed(0)}</span></div>
              <div className="flex justify-between"><span>Expenses:</span><span className="font-bold text-slate-700">{settings.currencySymbol}{weeklyPL.expenses.toFixed(0)}</span></div>
            </div>
          </div>

          {/* Monthly */}
          <div className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-2xl flex flex-col justify-between font-sans">
            <div>
              <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Monthly Profit (30d)</span>
              <span className={`text-base font-black font-mono block mt-1 ${monthlyPL.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {settings.currencySymbol}{monthlyPL.netProfit.toFixed(2)}
              </span>
            </div>
            <div className="mt-3.5 space-y-0.5 text-[9px] text-slate-400 font-mono">
              <div className="flex justify-between"><span>Sales:</span><span className="font-bold text-slate-700">{settings.currencySymbol}{monthlyPL.revenue.toFixed(0)}</span></div>
              <div className="flex justify-between"><span>Expenses:</span><span className="font-bold text-slate-700">{settings.currencySymbol}{monthlyPL.expenses.toFixed(0)}</span></div>
            </div>
          </div>

          {/* Yearly */}
          <div className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-2xl flex flex-col justify-between font-sans">
            <div>
              <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Yearly Profit</span>
              <span className={`text-base font-black font-mono block mt-1 ${yearlyPL.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {settings.currencySymbol}{yearlyPL.netProfit.toFixed(2)}
              </span>
            </div>
            <div className="mt-3.5 space-y-0.5 text-[9px] text-slate-400 font-mono">
              <div className="flex justify-between"><span>Sales:</span><span className="font-bold text-slate-700">{settings.currencySymbol}{yearlyPL.revenue.toFixed(0)}</span></div>
              <div className="flex justify-between"><span>Expenses:</span><span className="font-bold text-slate-700">{settings.currencySymbol}{yearlyPL.expenses.toFixed(0)}</span></div>
            </div>
          </div>

          {/* Cumulative All-Time */}
          <div className="bg-slate-900 border border-slate-950 p-3.5 rounded-2xl flex flex-col justify-between text-slate-300 font-sans">
            <div>
              <span className="text-[8px] text-slate-400 font-extrabold uppercase block">Cumulative Net Profit</span>
              <span className={`text-base font-black font-mono block mt-1 ${allTimePL.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                {settings.currencySymbol}{allTimePL.netProfit.toFixed(2)}
              </span>
            </div>
            <div className="mt-3.5 space-y-0.5 text-[9px] text-slate-500 font-mono">
              <div className="flex justify-between"><span>Gross Profit:</span><span className="font-bold text-slate-300">{settings.currencySymbol}{allTimePL.grossProfit.toFixed(0)}</span></div>
              <div className="flex justify-between"><span>Total Exp:</span><span className="font-bold text-rose-400">{settings.currencySymbol}{allTimePL.expenses.toFixed(0)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. INTEGRATED INTERACTIVE CHARTS PANELS (REQUIREMENT 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Monthly Loan Granting & Recovery Trend */}
        <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-2xs space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Monthly Loan Granting & Recovery Trend</h4>
            <span className="text-[9px] font-mono font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{currentYear} Calendar</span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendsData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLoans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="colorRecoveries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: 9, fontFamily: 'monospace' }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fontFamily: 'monospace' }} />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" name="Loans Granted" dataKey="loansGranted" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorLoans)" />
                <Area type="monotone" name="Loans Recovered" dataKey="loansRecovered" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRecoveries)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: Outstanding Loan by Top Customers */}
        <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-2xs space-y-3">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Outstanding Loan by Top Customers</h4>
          <div className="h-56 w-full">
            {outstandingByCustomerData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                No active outstanding loans to graph.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outstandingByCustomerData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                  <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fontFamily: 'monospace' }} />
                  <Tooltip formatter={(value) => [`${settings.currencySymbol}${value}`, 'Outstanding']} contentStyle={{ fontSize: 10, borderRadius: 12 }} />
                  <Bar dataKey="amount" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={32}>
                    {outstandingByCustomerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#991b1b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart C: Cash vs Credit Sales Volume */}
        <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-2xs space-y-3">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Cash vs Credit Sales Volume</h4>
          <div className="h-52 flex items-center justify-center">
            {totalSales === 0 ? (
              <div className="text-slate-400 text-xs">No sales volume registered.</div>
            ) : (
              <div className="w-full h-full flex flex-col sm:flex-row items-center justify-around">
                <div className="w-44 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cashVsCreditData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {cashVsCreditData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${settings.currencySymbol}${value}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500 block"></span>
                    <span className="text-slate-600">Cash Received:</span>
                    <strong className="text-slate-800 font-mono">{settings.currencySymbol}{cashSales.toFixed(2)}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 block"></span>
                    <span className="text-slate-600">Credit Loan Granted:</span>
                    <strong className="text-slate-800 font-mono">{settings.currencySymbol}{creditSales.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stock Status Tracking Widget */}
        <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-2xs space-y-3.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" />
            Stock Alerts & Critical Items
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-amber-50 border border-amber-100 p-2 text-center rounded-xl">
              <span className="text-amber-800 font-extrabold text-base block leading-none">{lowStockCount}</span>
              <span className="text-[8px] text-amber-600 font-bold uppercase tracking-wider mt-1 block">Low Stock</span>
            </div>
            <div className="bg-red-50 border border-red-100 p-2 text-center rounded-xl">
              <span className="text-red-800 font-extrabold text-base block leading-none">{outOfStockCount}</span>
              <span className="text-[8px] text-red-600 font-bold uppercase tracking-wider mt-1 block">Out of Stock</span>
            </div>
          </div>

          <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
            {products.filter((p) => p.quantity <= lowStockThreshold).length === 0 ? (
              <p className="text-[9px] text-slate-400 py-1 text-center">All inventory stock is healthy.</p>
            ) : (
              products
                .filter((p) => p.quantity <= lowStockThreshold)
                .slice(0, 3)
                .map((p) => (
                  <div key={p.id} className="flex justify-between items-center p-1 border border-slate-100 bg-slate-50/50 text-[11px] rounded-lg">
                    <span className="font-semibold text-slate-700 truncate max-w-[150px]">{p.name}</span>
                    <span className={`px-1 rounded text-[9px] font-bold ${p.quantity === 0 ? 'bg-red-150 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      {p.quantity} {p.unit}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Recent sales history logs */}
      <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-xs">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Receipt size={14} className="text-slate-400" />
            Recent Store Activity Ledger
          </h3>
          <button
            id="dashboard-view-history"
            onClick={() => onNavigate('sales_history')}
            className="text-[9px] text-blue-600 hover:text-blue-500 font-bold uppercase tracking-widest cursor-pointer"
          >
            View All Sales Log &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse" id="dashboard-recent-sales">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                <th className="py-2">Invoice No</th>
                <th className="py-2">Customer</th>
                <th className="py-2">Date</th>
                <th className="py-2">Outstanding Loan Generated</th>
                <th className="py-2 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No transactions registered.
                  </td>
                </tr>
              ) : (
                recentSales.map((s) => {
                  const cust = customers.find((c) => c.id === s.customerId);
                  const rem = Math.max(0, s.grandTotal - s.paidAmount);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 font-mono font-bold text-slate-800">{s.invoiceNo}</td>
                      <td className="py-2 font-medium">{cust ? cust.name : 'Walk-in Customer'}</td>
                      <td className="py-2 text-slate-400">{new Date(s.saleDate).toLocaleDateString()}</td>
                      <td className="py-2">
                        {rem > 0 ? (
                          <span className="text-red-600 font-bold font-mono">
                            {settings.currencySymbol}{rem.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">None (Fully Paid)</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono font-bold text-slate-900">
                        {settings.currencySymbol}{s.grandTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
