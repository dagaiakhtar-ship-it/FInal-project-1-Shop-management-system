import React, { useState } from 'react';
import { Expense, Settings } from '../types';
import { Search, Plus, Trash2, Calendar, AlertCircle, TrendingDown, DollarSign, Tag, ListFilter } from 'lucide-react';

interface ExpenseViewProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: number) => void;
  settings: Settings;
  userRole: 'Admin' | 'Manager' | 'Cashier';
}

export default function ExpenseView({
  expenses,
  onAddExpense,
  onDeleteExpense,
  settings,
  userRole,
}: ExpenseViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [category, setCategory] = useState('Electricity');
  const [customCategory, setCustomCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  const isRestricted = userRole === 'Cashier';

  const categories = [
    'Electricity',
    'Rent',
    'Salaries',
    'Internet',
    'Transport',
    'Maintenance',
    'Miscellaneous',
  ];

  const handleOpenModal = () => {
    setCategory('Electricity');
    setCustomCategory('');
    setAmount('');
    setDescription('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalCategory = category === 'Other' ? customCategory.trim() : category;
    const finalAmount = parseFloat(amount);

    if (!finalCategory) {
      setError('Expense category is required.');
      return;
    }
    if (isNaN(finalAmount) || finalAmount <= 0) {
      setError('Amount must be a positive number.');
      return;
    }
    if (!expenseDate) {
      setError('Expense date is required.');
      return;
    }

    onAddExpense({
      category: finalCategory,
      amount: finalAmount,
      expenseDate,
      description: description.trim() || `${finalCategory} Expense`,
    });

    setIsModalOpen(false);
  };

  // Filter & Search
  const filteredExpenses = expenses
    .filter((e) => {
      const matchesSearch =
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());

  // Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7); // 'YYYY-MM'

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const todayExpenses = expenses
    .filter((e) => e.expenseDate === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);
  const monthlyExpenses = expenses
    .filter((e) => e.expenseDate.startsWith(currentMonthStr))
    .reduce((sum, e) => sum + e.amount, 0);

  // Category summary distribution
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  return (
    <div className="space-y-6" id="expenses-panel">
      {/* Quick Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <TrendingDown size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Today's Expenses</span>
            <span className="text-lg font-bold font-mono text-slate-800">
              {settings.currencySymbol} {todayExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Calendar size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">This Month's Expenses</span>
            <span className="text-lg font-bold font-mono text-slate-800">
              {settings.currencySymbol} {monthlyExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Recorded Expenses</span>
            <span className="text-lg font-bold font-mono text-slate-800">
              {settings.currencySymbol} {totalExpenseAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-xs flex flex-col md:flex-row gap-3.5 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search description or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl pl-8.5 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none text-xs"
            />
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1.5">
            <ListFilter size={12} className="text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="all">All Categories</option>
              {Object.keys(categoryTotals).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isRestricted && (
          <button
            onClick={handleOpenModal}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-1.5 rounded-xl text-xs shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Log New Expense
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Expenses List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 border-b border-slate-150">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Expense Transaction Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  {!isRestricted && <th className="py-2.5 px-4 text-right w-20">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                      No matching expense transactions logged.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2 px-4 font-mono text-slate-500">{exp.expenseDate}</td>
                      <td className="py-2 px-4">
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded text-[9px] uppercase border border-red-100">
                          <Tag size={8} /> {exp.category}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-slate-700 font-sans">{exp.description}</td>
                      <td className="py-2 px-4 text-right font-bold font-mono text-red-600">
                        {settings.currencySymbol} {exp.amount.toFixed(2)}
                      </td>
                      {!isRestricted && (
                        <td className="py-2 px-4 text-right">
                          <button
                            onClick={() => onDeleteExpense(exp.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer transition-colors"
                            title="Delete Log"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense Category Breakdown Chart Side Widget */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Distribution by Category</h3>
            <p className="text-[10px] text-slate-400">Detailed breakdown of company expenditures</p>
          </div>

          <div className="space-y-2.5">
            {Object.keys(categoryTotals).length === 0 ? (
              <div className="text-center py-12 text-slate-400 italic text-xs">
                No expense data recorded.
              </div>
            ) : (
              Object.entries(categoryTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => {
                  const pct = totalExpenseAmount > 0 ? (amt / totalExpenseAmount) * 100 : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                          {cat}
                        </span>
                        <span className="font-mono text-slate-500">
                          {settings.currencySymbol} {amt.toFixed(2)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-red-500 h-1.5 rounded-full"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-scale-up">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold font-display text-slate-800">Log Company Expenditure</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                &times;
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider text-[9px]">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-850 focus:outline-none focus:border-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="Other">Other / Custom Category</option>
                </select>
              </div>

              {category === 'Other' && (
                <div>
                  <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider text-[9px]">Custom Category Name *</label>
                  <input
                    type="text"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider text-[9px]">Amount ({settings.currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-850 font-mono focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider text-[9px]">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-850 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1 uppercase tracking-wider text-[9px]">Brief Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="E.g. Electricity bill for main floor office"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                ></textarea>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl cursor-pointer text-center shadow-sm"
                >
                  Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
