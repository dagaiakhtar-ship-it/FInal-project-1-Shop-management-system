import React, { useState } from 'react';
import { Product, StockHistory } from '../types';
import { Search, Plus, Minus, FileText, AlertCircle, RefreshCw } from 'lucide-react';

interface InventoryViewProps {
  products: Product[];
  stockHistory: StockHistory[];
  onAdjustStock: (productId: number, changeType: 'Add' | 'Reduce' | 'Adjustment', qty: number, note: string) => boolean;
  userRole: 'Admin' | 'Manager' | 'Cashier';
}

export default function InventoryView({
  products,
  stockHistory,
  onAdjustStock,
  userRole,
}: InventoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'status' | 'logs'>('status');

  // Adjustment states
  const [selectedProductId, setSelectedProductId] = useState<number>(products[0]?.id || 0);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'Add' | 'Reduce'>('Add');
  const [adjustNote, setAdjustNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (selectedProductId === 0) {
      setError('Please select a valid product.');
      return;
    }
    if (adjustQty <= 0) {
      setError('Adjustment quantity must be greater than zero.');
      return;
    }
    if (!adjustNote.trim()) {
      setError('An adjustment note is required.');
      return;
    }

    const prod = products.find((p) => p.id === Number(selectedProductId));
    if (!prod) {
      setError('Product not found.');
      return;
    }

    if (adjustType === 'Reduce' && prod.quantity < adjustQty) {
      setError(`Cannot reduce quantity by ${adjustQty}. Only ${prod.quantity} items are available in stock.`);
      return;
    }

    const result = onAdjustStock(
      Number(selectedProductId),
      adjustType === 'Add' ? 'Add' : 'Reduce',
      Number(adjustQty),
      adjustNote.trim()
    );

    if (result) {
      setSuccess('Inventory stock adjusted successfully.');
      setAdjustQty(0);
      setAdjustNote('');
    } else {
      setError('Failed to adjust stock. Please review inputs.');
    }
  };

  const filteredProducts = products.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery)
  );

  const lowStockThreshold = 10;

  const isRestricted = userRole === 'Cashier';

  return (
    <div className="space-y-6" id="inventory-panel">
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200">
        <button
          id="inventory-tab-status"
          onClick={() => setActiveTab('status')}
          className={`px-5 py-3 text-sm font-semibold cursor-pointer border-b-2 transition-all ${
            activeTab === 'status' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Stock Status & Alerts
        </button>
        <button
          id="inventory-tab-logs"
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-3 text-sm font-semibold cursor-pointer border-b-2 transition-all ${
            activeTab === 'logs' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Stock History & Logs
        </button>
      </div>

      {activeTab === 'status' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Status Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs flex items-center justify-between">
              <div className="relative w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="inventory-search"
                  type="text"
                  placeholder="Filter stock status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl pl-8 pr-4 py-2 text-slate-800 placeholder-slate-400 focus:outline-none text-sm"
                />
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Total Products Monitored: <span className="font-semibold text-slate-700">{products.length}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
              <table className="w-full text-left text-sm border-collapse" id="inventory-table">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-medium text-xs uppercase tracking-wider">
                    <th className="py-3 px-5">Product Details</th>
                    <th className="py-3 px-5">Current Qty</th>
                    <th className="py-3 px-5">Min Level</th>
                    <th className="py-3 px-5">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600 text-xs">
                  {filteredProducts.map((p) => {
                    const isOut = p.quantity === 0;
                    const isLow = p.quantity > 0 && p.quantity <= lowStockThreshold;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-5">
                          <div>
                            <span className="font-semibold text-slate-800 block text-sm">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Barcode: {p.barcode}</span>
                          </div>
                        </td>
                        <td className="py-3 px-5 font-mono font-semibold text-slate-800">
                          {p.quantity} {p.unit}s
                        </td>
                        <td className="py-3 px-5 font-mono text-slate-400">{lowStockThreshold} {p.unit}s</td>
                        <td className="py-3 px-5">
                          <span
                            className={`px-2 py-0.5 rounded-full font-medium text-[9px] ${
                              isOut
                                ? 'bg-red-50 text-red-600 border border-red-100'
                                : isLow
                                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            }`}
                          >
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side: Adjust Stock Form */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs h-fit space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <RefreshCw size={16} className="text-blue-600" />
              Adjust Stock Manually
            </h3>

            {isRestricted ? (
              <div className="p-4 bg-slate-50 text-center rounded-xl border border-slate-100 text-slate-400 text-xs">
                Only Administrators or Managers have permissions to adjust stock manually.
              </div>
            ) : (
              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs rounded-xl flex items-center gap-2">
                    <FileText size={14} />
                    {success}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Select Product</label>
                  <select
                    id="inventory-form-product"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.quantity} left)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Action</label>
                    <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden p-0.5">
                      <button
                        type="button"
                        id="inventory-form-action-add"
                        onClick={() => setAdjustType('Add')}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          adjustType === 'Add' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Plus size={10} /> Add
                      </button>
                      <button
                        type="button"
                        id="inventory-form-action-reduce"
                        onClick={() => setAdjustType('Reduce')}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          adjustType === 'Reduce' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Minus size={10} /> Reduce
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Quantity</label>
                    <input
                      id="inventory-form-qty"
                      type="number"
                      required
                      min="1"
                      value={adjustQty || ''}
                      onChange={(e) => setAdjustQty(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-blue-500 font-mono font-bold"
                      placeholder="Qty"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Adjustment Note / Log Reason *</label>
                  <textarea
                    id="inventory-form-note"
                    required
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-blue-500 h-20"
                    placeholder="e.g. Received new shipment from Unilever, or manually reduced damaged products"
                  />
                </div>

                <button
                  type="submit"
                  id="inventory-form-submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-xl text-xs shadow-md shadow-blue-600/10 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Apply Stock Update
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
          <table className="w-full text-left text-sm border-collapse" id="inventory-history-table">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-medium text-xs uppercase tracking-wider">
                <th className="py-3 px-5">Log Timestamp</th>
                <th className="py-3 px-5">Product Name</th>
                <th className="py-3 px-5">Change Type</th>
                <th className="py-3 px-5">Delta Qty</th>
                <th className="py-3 px-5">Stock Transition</th>
                <th className="py-3 px-5">Note/Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-600 text-xs">
              {[...stockHistory].sort((a, b) => b.id - a.id).map((log) => {
                const prod = products.find((p) => p.id === log.productId);
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-5 font-mono text-slate-400">
                      {new Date(log.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-5 font-semibold text-slate-800">
                      {prod ? prod.name : 'Unknown Product'}
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`px-2 py-0.5 rounded font-medium text-[9px] ${
                          log.changeType === 'Add'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : log.changeType === 'Reduce'
                            ? 'bg-red-50 text-red-600 border border-red-100'
                            : log.changeType === 'Sale'
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {log.changeType}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-mono font-semibold text-slate-800">
                      {log.quantityChanged > 0 ? `+${log.quantityChanged}` : log.quantityChanged}
                    </td>
                    <td className="py-3 px-5 font-mono text-slate-400 text-[10px]">
                      {log.oldQuantity} → {log.newQuantity}
                    </td>
                    <td className="py-3 px-5 text-slate-500 italic max-w-sm truncate" title={log.note}>
                      {log.note}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
