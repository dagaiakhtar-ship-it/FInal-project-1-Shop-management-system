import React, { useState } from 'react';
import { Purchase, Supplier, Product, Settings } from '../types';
import { Search, Plus, Calendar, AlertCircle, ShoppingCart, Truck, Tag, ChevronRight, X, DollarSign, Printer, ArrowUpRight } from 'lucide-react';

interface PurchaseViewProps {
  purchases: Purchase[];
  suppliers: Supplier[];
  products: Product[];
  settings: Settings;
  onAddPurchase: (purchase: Omit<Purchase, 'id'>, itemUpdates: { productId: number; addQuantity: number; newCostPrice: number; newSalePrice: number }[]) => void;
  onPaySupplier: (supplierId: number, amount: number) => void;
  userRole: 'Admin' | 'Manager' | 'Cashier';
}

export default function PurchaseView({
  purchases,
  suppliers,
  products,
  settings,
  onAddPurchase,
  onPaySupplier,
  userRole,
}: PurchaseViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  // Supplier Credit Payment states
  const [selectedSupplierIdForPayment, setSelectedSupplierIdForPayment] = useState<number | null>(null);
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState('');
  const [supplierPaymentError, setSupplierPaymentError] = useState('');

  // Purchase Form States
  const [invoiceNo, setInvoiceNo] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState('');

  // Cart of products being purchased
  const [purchaseCart, setPurchaseCart] = useState<{
    product: Product;
    quantity: number;
    purchasePrice: number;
    sellingPrice: number;
  }[]>([]);

  // Search product to add to cart
  const [productSearch, setProductSearch] = useState('');
  const [paidAmount, setPaidAmount] = useState('');

  const isRestricted = userRole === 'Cashier';

  // Calculations for dashboard
  const totalPurchaseValue = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalOutstandingToSuppliers = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);

  const filteredPurchases = purchases
    .filter((p) => {
      const supplierName = suppliers.find((s) => s.id === p.supplierId)?.name || 'Unknown Supplier';
      const matchesSearch =
        p.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplierName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSupplier = supplierFilter === 'all' || p.supplierId === parseInt(supplierFilter);
      return matchesSearch && matchesSupplier;
    })
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());

  // Handle adding product to purchase cart
  const addProductToPurchaseCart = (prod: Product) => {
    setFormError('');
    const exists = purchaseCart.find((item) => item.product.id === prod.id);
    if (exists) {
      setFormError(`Product '${prod.name}' is already in the purchase list.`);
      return;
    }
    setPurchaseCart([
      ...purchaseCart,
      {
        product: prod,
        quantity: 10, // default wholesale starting qty
        purchasePrice: prod.costPrice,
        sellingPrice: prod.salePrice,
      },
    ]);
    setProductSearch('');
  };

  const removeProductFromPurchaseCart = (prodId: number) => {
    setPurchaseCart(purchaseCart.filter((item) => item.product.id !== prodId));
  };

  const updateCartItem = (
    prodId: number,
    field: 'quantity' | 'purchasePrice' | 'sellingPrice',
    val: number
  ) => {
    setPurchaseCart(
      purchaseCart.map((item) => {
        if (item.product.id === prodId) {
          return { ...item, [field]: val };
        }
        return item;
      })
    );
  };

  const calculateCartTotal = () => {
    return purchaseCart.reduce((sum, item) => sum + item.purchasePrice * item.quantity, 0);
  };

  const handleOpenPurchaseModal = () => {
    const nextId = purchases.length > 0 ? Math.max(...purchases.map((p) => p.id)) + 1 : 1;
    setInvoiceNo(`PINV-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(nextId).padStart(3, '0')}`);
    setSupplierId('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setPurchaseCart([]);
    setPaidAmount('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleProcessPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!supplierId) {
      setFormError('Please select a Supplier.');
      return;
    }
    if (purchaseCart.length === 0) {
      setFormError('Please add at least one product to the purchase invoice.');
      return;
    }

    const total = calculateCartTotal();
    const paid = parseFloat(paidAmount);
    if (isNaN(paid) || paid < 0) {
      setFormError('Paid amount must be a positive number or zero.');
      return;
    }
    if (paid > total) {
      setFormError('Paid amount cannot exceed the total invoice value.');
      return;
    }

    // Build items payload
    const items = purchaseCart.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
    }));

    const status: Purchase['status'] = paid === total ? 'Paid' : paid === 0 ? 'Outstanding' : 'Partial';

    const newPurchase: Omit<Purchase, 'id'> = {
      invoiceNo,
      supplierId: parseInt(supplierId),
      purchaseDate,
      items,
      totalAmount: total,
      paidAmount: paid,
      status,
      createdAt: new Date().toISOString(),
    };

    // Build product/inventory updates payload
    const itemUpdates = purchaseCart.map((item) => ({
      productId: item.product.id,
      addQuantity: item.quantity,
      newCostPrice: item.purchasePrice,
      newSalePrice: item.sellingPrice,
    }));

    onAddPurchase(newPurchase, itemUpdates);
    setIsModalOpen(false);
  };

  const handlePaySupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierPaymentError('');

    if (!selectedSupplierIdForPayment) return;
    const s = suppliers.find((supplier) => supplier.id === selectedSupplierIdForPayment);
    if (!s) return;

    const amt = parseFloat(supplierPaymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setSupplierPaymentError('Please enter a positive amount.');
      return;
    }

    const outstanding = s.balance || 0;
    if (amt > outstanding) {
      setSupplierPaymentError(`Payment cannot exceed outstanding balance of ${settings.currencySymbol}${outstanding.toFixed(2)}.`);
      return;
    }

    onPaySupplier(selectedSupplierIdForPayment, amt);
    setSelectedSupplierIdForPayment(null);
    setSupplierPaymentAmount('');
  };

  // Autocomplete products
  const productSuggestions = productSearch.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.barcode.includes(productSearch)
      )
    : [];

  return (
    <div className="space-y-6" id="purchases-panel">
      {/* Quick Stats Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Truck size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Procurement</span>
            <span className="text-lg font-bold font-mono text-slate-800">
              {settings.currencySymbol} {totalPurchaseValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">We Owe Suppliers</span>
            <span className="text-lg font-bold font-mono text-red-600 animate-pulse-once">
              {settings.currencySymbol} {totalOutstandingToSuppliers.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShoppingCart size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Invoices</span>
            <span className="text-lg font-bold font-mono text-slate-800">
              {purchases.length} invoices
            </span>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-xs flex flex-col lg:flex-row gap-3.5 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3.5 w-full lg:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice # or supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl pl-8.5 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none text-xs"
            />
          </div>

          {/* Supplier Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Supplier:</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.companyName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isRestricted && (
          <button
            onClick={handleOpenPurchaseModal}
            className="w-full lg:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Record Purchase Invoice
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Purchases history list */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden xl:col-span-2">
          <div className="px-4 py-3 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Procurement Ledgers</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Supplier</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Total Value</th>
                  <th className="py-2.5 px-4">Paid</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right w-16">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                      No purchase invoices recorded.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p) => {
                    const supp = suppliers.find((s) => s.id === p.supplierId);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2 px-4 font-mono font-bold text-slate-800">{p.invoiceNo}</td>
                        <td className="py-2 px-4">
                          <span className="font-semibold text-slate-800 block">{supp?.name || 'Unknown'}</span>
                          <span className="text-[9px] text-slate-400 leading-none">{supp?.companyName}</span>
                        </td>
                        <td className="py-2 px-4 font-mono text-slate-500">{p.purchaseDate}</td>
                        <td className="py-2 px-4 font-mono font-bold text-slate-800">
                          {settings.currencySymbol} {p.totalAmount.toFixed(2)}
                        </td>
                        <td className="py-2 px-4 font-mono text-slate-500">
                          {settings.currencySymbol} {p.paidAmount.toFixed(2)}
                        </td>
                        <td className="py-2 px-4 text-center">
                          <span
                            className={`inline-block text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                              p.status === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'Partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right">
                          <button
                            onClick={() => setSelectedPurchase(p)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Purchase invoice sidebar inspector OR Supplier balance paydowns */}
        <div className="space-y-4">
          {/* Supplier balances paydown cards */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Supplier Credit Recovery</h3>
              <p className="text-[10px] text-slate-400">Record cash paydowns for credit invoices</p>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {suppliers.filter((s) => (s.balance || 0) > 0).length === 0 ? (
                <div className="text-center py-6 text-slate-400 italic text-[11px]">
                  Excellent! Zero outstanding supplier balances.
                </div>
              ) : (
                suppliers
                  .filter((s) => (s.balance || 0) > 0)
                  .map((s) => (
                    <div key={s.id} className="border border-slate-100 p-2.5 rounded-xl bg-slate-50/50 flex justify-between items-center text-[11px]">
                      <div>
                        <span className="font-bold text-slate-800 block">{s.companyName}</span>
                        <span className="text-[9px] text-slate-400">Outstanding: <strong className="font-mono text-red-600">{settings.currencySymbol} {s.balance?.toFixed(2)}</strong></span>
                      </div>
                      {!isRestricted && (
                        <button
                          onClick={() => {
                            setSelectedSupplierIdForPayment(s.id);
                            setSupplierPaymentAmount('');
                            setSupplierPaymentError('');
                          }}
                          className="bg-red-600 hover:bg-red-500 text-white font-bold px-2 py-1 rounded text-[9px] cursor-pointer"
                        >
                          Record Payment
                        </button>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Detailed Invoice Inspector sidebar panel */}
          {selectedPurchase && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4 animate-slide-left">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 font-mono">{selectedPurchase.invoiceNo}</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Procurement Detail</p>
                </div>
                <button
                  onClick={() => setSelectedPurchase(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-[10px] space-y-2 font-mono">
                <div className="flex justify-between">
                  <span>Supplier:</span>
                  <span className="font-bold text-slate-800">
                    {suppliers.find((s) => s.id === selectedPurchase.supplierId)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Purchased on:</span>
                  <span>{selectedPurchase.purchaseDate}</span>
                </div>
                <div className="border-t border-dashed border-slate-250 my-1.5"></div>
                
                {/* Items loop */}
                <div className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-500 text-[9px]">
                    <span>Item Name</span>
                    <span>Qty</span>
                    <span>Cost</span>
                    <span className="text-right">Total</span>
                  </div>
                  {selectedPurchase.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-[9px] text-slate-600">
                      <span className="truncate max-w-[120px]">{item.name}</span>
                      <span>{item.quantity}</span>
                      <span>{settings.currencySymbol}{item.purchasePrice}</span>
                      <span className="text-right">{settings.currencySymbol}{(item.purchasePrice * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-250 my-1.5 pt-1.5 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Invoice Value:</span>
                    <span>{settings.currencySymbol} {selectedPurchase.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Cash Settled:</span>
                    <span>{settings.currencySymbol} {selectedPurchase.paidAmount.toFixed(2)}</span>
                  </div>
                  {selectedPurchase.totalAmount > selectedPurchase.paidAmount && (
                    <div className="flex justify-between text-red-600 font-bold">
                      <span>Supplier Credit:</span>
                      <span>{settings.currencySymbol} {(selectedPurchase.totalAmount - selectedPurchase.paidAmount).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Supplier Payment Modal Dialog */}
      {selectedSupplierIdForPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-slate-150">
              <h3 className="text-xs font-bold uppercase text-slate-800">
                Record Payment to Supplier
              </h3>
              <button
                onClick={() => setSelectedSupplierIdForPayment(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                &times;
              </button>
            </div>

            {supplierPaymentError && (
              <div className="text-[10px] text-red-600 font-bold flex items-center gap-1 bg-red-50 p-2 rounded-lg border border-red-150">
                <AlertCircle size={12} /> {supplierPaymentError}
              </div>
            )}

            <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p>Supplier: <strong>{suppliers.find((sup) => sup.id === selectedSupplierIdForPayment)?.companyName}</strong></p>
              <p>Max Payable Credit: <strong className="font-mono text-red-600">{settings.currencySymbol} {(suppliers.find((sup) => sup.id === selectedSupplierIdForPayment)?.balance || 0).toFixed(2)}</strong></p>
            </div>

            <form onSubmit={handlePaySupplierSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Payment Amount ({settings.currencySymbol}) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={supplierPaymentAmount}
                  onChange={(e) => setSupplierPaymentAmount(e.target.value)}
                  placeholder="Enter paid amount"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 font-mono focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSupplierIdForPayment(null)}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl cursor-pointer text-center"
                >
                  Post Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Purchase Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-150 rounded-3xl shadow-2xl max-w-4xl w-full p-6 space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-150">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="text-blue-600" size={18} />
                Record Procurement Invoice
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={14} />
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Left Form Settings */}
              <div className="space-y-4 bg-slate-50/50 p-4 border border-slate-150 rounded-2xl h-fit">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Supplier *</label>
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Invoice Number</label>
                    <input
                      type="text"
                      disabled
                      value={invoiceNo}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-500 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1 text-slate-800 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Search products to purchase */}
                <div className="relative">
                  <label className="block font-semibold text-slate-500 mb-1">Search Product to Add *</label>
                  <input
                    type="text"
                    placeholder="Search name or scan barcode..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                  />

                  {productSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-[160px] overflow-y-auto z-50 divide-y divide-slate-100">
                      {productSuggestions.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => addProductToPurchaseCart(prod)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex justify-between items-center text-[11px]"
                        >
                          <div>
                            <span className="font-semibold text-slate-800 block">{prod.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">Barcode: {prod.barcode}</span>
                          </div>
                          <span className="font-bold text-slate-500">Current Qty: {prod.quantity}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200/60 pt-3 space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>Total Procurement Value:</span>
                    <span className="font-mono text-blue-600">{settings.currencySymbol} {calculateCartTotal().toFixed(2)}</span>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Amount Cash Settled ({settings.currencySymbol}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  {calculateCartTotal() > parseFloat(paidAmount || '0') && (
                    <div className="flex justify-between text-red-600 font-semibold text-[10px] bg-red-50 p-2 rounded-lg">
                      <span>Supplier Credit:</span>
                      <span>{settings.currencySymbol} {(calculateCartTotal() - parseFloat(paidAmount || '0')).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleProcessPurchase}
                  className="w-full flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow"
                >
                  <ShoppingCart size={14} /> Commit Procurement
                </button>
              </div>

              {/* Right cart items */}
              <div className="md:col-span-2 border border-slate-150 rounded-2xl overflow-hidden h-[400px] flex flex-col bg-white">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-150 flex justify-between items-center">
                  <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Purchase Itemized Details</span>
                  <span className="bg-white px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 font-mono">
                    {purchaseCart.length} lines
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {purchaseCart.length === 0 ? (
                    <div className="text-center py-24 text-slate-400 italic">
                      No products added to the procurement list. Search above to populate.
                    </div>
                  ) : (
                    purchaseCart.map((item, index) => {
                      const cost = item.purchasePrice || 0;
                      const sale = item.sellingPrice || 0;
                      const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0;

                      return (
                        <div key={item.product.id} className="border border-slate-150 p-3 rounded-xl flex flex-col md:flex-row gap-3.5 items-center justify-between text-[11px] bg-slate-50/20">
                          <div className="w-full md:w-1/3">
                            <span className="font-bold text-slate-800 block text-xs">{item.product.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">Barcode: {item.product.barcode}</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 w-full md:w-2/3">
                            <div>
                              <label className="block text-[8px] font-bold text-slate-400 uppercase">Quantity</label>
                              <input
                                type="number"
                                required
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateCartItem(item.product.id, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-center font-mono font-bold text-slate-800"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-400 uppercase">Cost Price</label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={item.purchasePrice}
                                onChange={(e) => updateCartItem(item.product.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-center font-mono text-blue-600 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-400 uppercase">Selling Price</label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={item.sellingPrice}
                                onChange={(e) => updateCartItem(item.product.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-center font-mono text-emerald-600 font-bold"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0">
                            <div className="text-right">
                              <span className="block text-[8px] text-slate-400 font-bold uppercase">Margin</span>
                              <span className={`font-mono text-[10px] font-extrabold ${margin >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {margin.toFixed(0)}%
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProductFromPurchaseCart(item.product.id)}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg cursor-pointer"
                            >
                              &times;
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
