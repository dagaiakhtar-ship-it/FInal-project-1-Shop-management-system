import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Product, Category, Customer, Sale, Settings, User, Loan, LoanPayment } from '../types';
import { Search, Plus, Minus, Trash2, ShoppingCart, UserPlus, DollarSign, Printer, Download, Share2, Receipt, Percent, Landmark } from 'lucide-react';
import { generateSaleReceiptPDF } from '../utils/receiptPdf';
import { triggerPrint, safePdfExport } from '../utils/printUtils';

interface BillingViewProps {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  settings: Settings;
  currentUser: User;
  onCheckout: (
    cartItems: { product: Product; quantity: number }[],
    customerId: number,
    subtotal: number,
    discount: number,
    tax: number,
    grandTotal: number,
    paidAmount: number,
    returnAmount: number,
    paymentMethod: Sale['paymentMethod']
  ) => Sale | null;
  loans: Loan[];
  loanPayments: LoanPayment[];
  onProcessLoanPayment: (customerId: number, amount: number) => void;
}

export default function BillingView({
  products,
  categories,
  customers,
  settings,
  currentUser,
  onCheckout,
  loans,
  loanPayments,
  onProcessLoanPayment,
 }: BillingViewProps) {
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(1); // Defaults to Walk-in Customer (id: 1)

  // Cart State
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);

  // Billing calculation states
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod']>('Cash');
  const [cashPaid, setCashPaid] = useState<number>(0);

  // Completed Invoice receipt popup
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptItems, setReceiptItems] = useState<{ product: Product; quantity: number }[]>([]);

  // Error/alert handlers
  const [billingError, setBillingError] = useState('');

  // Tracks whether the cashier has manually edited the cashPaid field so the
  // auto-fill effect does not silently clobber a partial-payment amount (BUG #11).
  const cashPaidManuallyEdited = useRef(false);

  // Loan Confirmation Modal State
  const [showConfirmLoanModal, setShowConfirmLoanModal] = useState(false);
  const [confirmLoanDetails, setConfirmLoanDetails] = useState<{
    cart: { product: Product; quantity: number }[];
    customerId: number;
    subtotal: number;
    discount: number;
    tax: number;
    grand: number;
    finalPaid: number;
    change: number;
    paymentMethod: Sale['paymentMethod'];
    loanAmount: number;
  } | null>(null);

  // Automatically update cashPaid when grandTotal changes for standard Cash checkout
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.product.salePrice * item.quantity, 0);
  };

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    if (discountType === 'percentage') {
      return (subtotal * discountValue) / 100;
    }
    return discountValue;
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    return ((subtotal - discount) * settings.taxPercentage) / 100;
  };

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    const tax = calculateTax();
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const loan = (customer && customer.balance > 0) ? customer.balance : 0;
    return Math.max(0, subtotal - discount + tax + loan);
  };

  const grandTotal = calculateGrandTotal();

  // Re-arm the cash-paid auto-fill whenever the underlying drivers of grandTotal
  // change (cart contents, discount, or selected customer). This prevents the
  // ref from freezing cashPaid at a stale manual value after the cashier edits
  // it once and then adds/removes items or switches customers. The manual-edit
  // guard still protects an in-progress partial entry within a single cart state.
  useEffect(() => {
    cashPaidManuallyEdited.current = false;
  }, [cart, discountType, discountValue, selectedCustomerId]);

  // Automatically update cashPaid when grandTotal changes to default to full payment.
  // Guarded so it does NOT clobber a manually-entered partial amount (Bug #11):
  // once the cashier types into the cashPaid field, the auto-fill is disabled
  // until an explicit reset action (new cart, customer change, reset, etc.).
  useEffect(() => {
    if (cashPaidManuallyEdited.current) return;
    setCashPaid(parseFloat(grandTotal.toFixed(2)));
  }, [grandTotal]);

  // Helper to add product to cart
  const addToCart = (prod: Product) => {
    setBillingError('');
    if (prod.quantity <= 0) {
      setBillingError(`'${prod.name}' is out of stock!`);
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === prod.id);
    if (existingIndex > -1) {
      const currentQtyInCart = cart[existingIndex].quantity;
      if (currentQtyInCart >= prod.quantity) {
        setBillingError(`Cannot exceed available stock (${prod.quantity} ${prod.unit}s) for '${prod.name}'.`);
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, { product: prod, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setBillingError('');
    const index = cart.findIndex((item) => item.product.id === productId);
    if (index === -1) return;

    const prod = cart[index].product;
    const currentQty = cart[index].quantity;
    const newQty = currentQty + delta;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQty > prod.quantity) {
      setBillingError(`Cannot add more. Only ${prod.quantity} ${prod.unit}s of '${prod.name}' are in stock.`);
      return;
    }

    const updatedCart = [...cart];
    updatedCart[index].quantity = newQty;
    setCart(updatedCart);
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  // Filtered product listings (Left side)
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.barcode.includes(productSearch);
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Hotkey simulation & Barcode Fast Search Enter Key
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const match = products.find((p) => p.barcode === productSearch.trim());
    if (match) {
      addToCart(match);
      setProductSearch('');
    } else {
      setBillingError(`No product found with barcode: ${productSearch}`);
    }
  };

  // Checkout Execution
  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setBillingError('');

    if (cart.length === 0) {
      setBillingError('Your cart is empty.');
      return;
    }

    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    const tax = calculateTax();
    const grand = calculateGrandTotal();

    const finalPaid = (paymentMethod === 'Cash' || selectedCustomerId !== 1) ? cashPaid : grand;

    if (selectedCustomerId === 1 && finalPaid < grand) {
      setBillingError(`Insufficient cash paid for Walk-in Customer. Grand total is ${settings.currencySymbol} ${grand.toFixed(2)}.`);
      return;
    }

    const change = finalPaid > grand ? finalPaid - grand : 0;
    const loanAmount = grand > finalPaid ? grand - finalPaid : 0;

    if (selectedCustomerId !== 1 && loanAmount > 0) {
      setConfirmLoanDetails({
        cart: [...cart],
        customerId: selectedCustomerId,
        subtotal,
        discount,
        tax,
        grand,
        finalPaid,
        change,
        paymentMethod,
        loanAmount,
      });
      setShowConfirmLoanModal(true);
      return;
    }

    executeCheckout([...cart], selectedCustomerId, subtotal, discount, tax, grand, finalPaid, change, paymentMethod);
  };

  const executeCheckout = (
    cartItems: { product: Product; quantity: number }[],
    custId: number,
    sub: number,
    disc: number,
    tx: number,
    gd: number,
    paid: number,
    chg: number,
    pm: Sale['paymentMethod']
  ) => {
    const sale = onCheckout(cartItems, custId, sub, disc, tx, gd, paid, chg, pm);

    if (sale) {
      setCompletedSale(sale);
      setReceiptItems([...cartItems]);
      setShowReceipt(true);
      // Reset Billing Panel State
      setCart([]);
      setDiscountValue(0);
      setCashPaid(0);
      // Re-arm the auto-fill now that the cashier has started a fresh invoice.
      cashPaidManuallyEdited.current = false;
      setProductSearch('');
    } else {
      setBillingError('Checkout failed due to system database error.');
    }
  };

  // Print simulation
  const triggerPrintReceipt = () => {
    triggerPrint('printable-receipt');
  };

  // WhatsApp simulation
  const shareReceiptWhatsApp = () => {
    if (!completedSale) return;
    const customer = customers.find((c) => c.id === completedSale.customerId);
    const phoneNum = customer && customer.phone !== '0000-0000000' ? customer.phone : '03001234567';
    const loanText = completedSale.grandTotal > completedSale.paidAmount
      ? ` Remaining Loan: ${settings.currencySymbol}${(completedSale.grandTotal - completedSale.paidAmount).toFixed(2)}.`
      : '';
    const textMsg = `Hello! Thank you for shopping with ${settings.shopName}. Your Invoice ${completedSale.invoiceNo} is complete. Total Amount: ${settings.currencySymbol}${completedSale.grandTotal.toFixed(2)}. Paid Amount: ${settings.currencySymbol}${completedSale.paidAmount.toFixed(2)}.${loanText} Have a great day!`;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(textMsg)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Export receipt as PDF
  const exportReceiptPDF = () => {
    if (!completedSale) return;
    const customer = customers.find((c) => c.id === completedSale.customerId);
    const currentBill = completedSale.subtotal - completedSale.discount + completedSale.tax;
    const previousLoan =
      completedSale.customerId && completedSale.customerId !== 1
        ? completedSale.grandTotal - currentBill
        : undefined;
    safePdfExport(() =>
      generateSaleReceiptPDF({
        sale: completedSale,
        items: receiptItems.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.salePrice,
          total: item.product.salePrice * item.quantity,
        })),
        settings,
        customer: {
          name: customer?.name ?? 'Walk-in',
          phone: customer?.phone,
        },
        cashierName: currentUser.fullName,
        customerBalance: customer?.balance,
        previousLoan: previousLoan && previousLoan > 0 ? previousLoan : undefined,
        currentBill: completedSale.customerId && completedSale.customerId !== 1 ? currentBill : undefined,
      })
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" id="billing-panel">
      {/* Left side: Search & Product Selection */}
      <div className="lg:col-span-7 space-y-3">
        {/* Top filter bar */}
        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs space-y-2.5">
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="billing-search"
                type="text"
                placeholder="Scan Barcode or Search Product name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg pl-8.5 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none text-xs transition-all animate-pulse-once"
              />
            </div>
            <button
              type="submit"
              id="billing-search-submit"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 rounded-lg text-xs cursor-pointer flex items-center"
            >
              Scan/Add
            </button>
          </form>

          {/* Quick Categories Bar */}
          <div className="flex gap-1 overflow-x-auto pb-1.5 pr-1 scrollbar-thin">
            <button
              type="button"
              id="billing-cat-all"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                selectedCategory === 'all' ? 'bg-blue-600 text-white font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Items
            </button>
            {categories.map((c) => (
              <button
                type="button"
                key={c.id}
                id={`billing-cat-${c.id}`}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  selectedCategory === c.id ? 'bg-blue-600 text-white font-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-3">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Product Catalog</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredProducts.length === 0 ? (
              <div className="col-span-3 text-center py-16 text-slate-400 text-xs">
                No items matching search or category selection.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isOutOfStock = p.quantity === 0;
                const isLowStock = p.quantity > 0 && p.quantity <= 10;
                return (
                  <button
                    key={p.id}
                    id={`billing-product-${p.id}`}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`border border-slate-200 rounded-lg p-2.5 text-left transition-all relative flex flex-col justify-between ${
                      isOutOfStock
                        ? 'opacity-40 bg-slate-50 cursor-not-allowed'
                        : 'hover:border-blue-400 hover:shadow-xs bg-slate-50/50 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-semibold text-slate-800 text-xs block truncate max-w-[110px]" title={p.name}>
                          {p.name}
                        </span>
                        <span
                          className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                            isOutOfStock ? 'bg-red-100 text-red-700' : isLowStock ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {p.quantity}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">{p.barcode}</span>
                    </div>

                    <div className="flex justify-between items-center mt-2.5 pt-1.5 border-t border-slate-100">
                      <span className="text-slate-400 text-[9px]">{p.unit}</span>
                      <span className="font-mono font-bold text-slate-850 text-xs">
                        {settings.currencySymbol}{p.salePrice}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right side: POS Cart Panel */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-xs p-3.5 flex flex-col h-fit space-y-3">
        <div className="flex justify-between items-center pb-1.5 border-b border-slate-150">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <ShoppingCart size={14} className="text-blue-600" />
            POS Shopping Cart
          </h3>
          <span className="text-[10px] bg-slate-100 text-slate-700 font-extrabold px-1.5 py-0.5 rounded border border-slate-200">
            {cart.length} items
          </span>
        </div>

        {billingError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
            <Percent size={14} />
            {billingError}
          </div>
        )}

        {selectedCustomerId !== 1 && (customers.find((c) => c.id === selectedCustomerId)?.balance! > 0) && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex flex-col gap-1">
            <div className="flex items-center gap-2 font-bold">
              <Landmark size={14} />
              ⚠ Customer has Outstanding Loan
            </div>
            <div className="text-xs">
              Outstanding: {settings.currencySymbol} {customers.find((c) => c.id === selectedCustomerId)?.balance.toFixed(2)}
            </div>
            <div className="flex gap-2 mt-2">
              <input 
                type="number" 
                placeholder="Amount" 
                id="loan-payment-input"
                className="w-full text-[10px] p-1 rounded border border-red-200"
              />
              <button 
                onClick={() => {
                  const input = document.getElementById('loan-payment-input') as HTMLInputElement;
                  onProcessLoanPayment(selectedCustomerId, parseFloat(input.value) || 0);
                }}
                className="bg-red-600 text-white font-bold py-1 px-2 rounded cursor-pointer text-[10px]"
              >
                Pay Partial
              </button>
            </div>
            <button 
              onClick={() => onProcessLoanPayment(selectedCustomerId, customers.find((c) => c.id === selectedCustomerId)?.balance || 0)}
              className="mt-1 bg-red-600 text-white font-bold py-1 rounded cursor-pointer text-[10px]"
            >
              Pay Full Loan
            </button>
          </div>
        )}

        {/* Cart items list */}
        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs italic">
              Your cart is empty. Click catalog products to add items.
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex justify-between items-center p-2 rounded-xl border border-slate-50 bg-slate-50/50 text-xs">
                <div className="flex-1 min-w-0 pr-2">
                  <span className="font-semibold text-slate-800 block truncate">{item.product.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {settings.currencySymbol} {item.product.salePrice} / {item.product.unit}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    id={`cart-minus-${item.product.id}`}
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-500 cursor-pointer"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="font-mono font-bold w-6 text-center text-slate-800">{item.quantity}</span>
                  <button
                    type="button"
                    id={`cart-plus-${item.product.id}`}
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-500 cursor-pointer"
                  >
                    <Plus size={12} />
                  </button>

                  <button
                    type="button"
                    id={`cart-remove-${item.product.id}`}
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1 cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Config parameters */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          {/* Customer Selection */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Customer Assignment
            </label>
            <select
              id="billing-customer-select"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 text-xs focus:outline-none focus:border-blue-500"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone !== '0000-0000000' ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Discount Parameters */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Discount Type
              </label>
              <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden p-0.5">
                <button
                  type="button"
                  id="billing-discount-flat"
                  onClick={() => {
                    setDiscountType('fixed');
                    setDiscountValue(0);
                  }}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center ${
                    discountType === 'fixed' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Flat ({settings.currencySymbol})
                </button>
                <button
                  type="button"
                  id="billing-discount-pct"
                  onClick={() => {
                    setDiscountType('percentage');
                    setDiscountValue(0);
                  }}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center ${
                    discountType === 'percentage' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Percent (%)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Discount Value
              </label>
              <input
                id="billing-discount-val"
                type="number"
                min="0"
                value={discountValue || ''}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-slate-800 text-xs focus:outline-none focus:border-blue-500 font-mono font-bold"
                placeholder="0"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Payment Channel
              </label>
              <select
                id="billing-payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as Sale['paymentMethod'])}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 text-xs focus:outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Easypaisa">Easypaisa</option>
                <option value="JazzCash">JazzCash</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            {(paymentMethod === 'Cash' || selectedCustomerId !== 1) && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {paymentMethod === 'Cash' ? 'Cash Paid' : 'Amount Paid'}
                </label>
                <input
                  id="billing-cash-paid"
                  type="number"
                  min="0"
                  value={cashPaid || ''}
                  onChange={(e) => {
                    cashPaidManuallyEdited.current = true;
                    setCashPaid(Number(e.target.value));
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-slate-800 text-xs focus:outline-none focus:border-blue-500 font-mono font-bold"
                  placeholder="0"
                />
              </div>
            )}
          </div>
        </div>

        {/* Calculations display */}
        <div className="bg-slate-50/80 rounded-lg p-3 space-y-1.5 text-xs border border-slate-200">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal:</span>
            <span className="font-mono">{settings.currencySymbol} {calculateSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Discounts Applied:</span>
            <span className="font-mono text-red-500">- {settings.currencySymbol} {calculateDiscount().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Tax ({settings.taxPercentage}%):</span>
            <span className="font-mono">{settings.currencySymbol} {calculateTax().toFixed(2)}</span>
          </div>
          
          {selectedCustomerId !== 1 && customers.find((c) => c.id === selectedCustomerId)?.balance! > 0 && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>Previous Loan:</span>
              <span className="font-mono">
                {settings.currencySymbol} {customers.find((c) => c.id === selectedCustomerId)?.balance.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between text-slate-900 font-bold text-xs pt-2 border-t border-slate-200">
            <span>Grand Total:</span>
            <span className="font-mono text-blue-600">{settings.currencySymbol} {grandTotal.toFixed(2)}</span>
          </div>

          {paymentMethod === 'Cash' && cashPaid > grandTotal && (
            <div className="flex justify-between text-slate-900 font-bold text-xs pt-1">
              <span>Change Return:</span>
              <span className="font-mono text-emerald-600">
                {settings.currencySymbol} {(cashPaid - grandTotal).toFixed(2)}
              </span>
            </div>
          )}

          {selectedCustomerId !== 1 && cashPaid < grandTotal && (
            <div className="flex justify-between text-slate-900 font-bold text-xs pt-1">
              <span className="text-red-600">Remaining Loan:</span>
              <span className="font-mono text-red-600">
                {settings.currencySymbol} {(grandTotal - cashPaid).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Checkout CTA */}
        <div className="flex gap-2">
          <button
            type="button"
            id="billing-cancel-btn"
            onClick={() => {
              setCart([]);
              setDiscountValue(0);
              setCashPaid(0);
              // Re-arm auto-fill for the next invoice.
              cashPaidManuallyEdited.current = false;
              setProductSearch('');
              setBillingError('');
            }}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 px-4 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5 border border-red-200"
          >
            <Trash2 size={13} />
            Cancel
          </button>
          <button
            type="button"
            id="billing-checkout-btn"
            onClick={handleCheckout}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-lg text-xs shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Landmark size={13} />
            Complete POS Checkout
          </button>
        </div>
      </div>

      {/* Invoice Thermal Receipt modal popup */}
      {showReceipt && completedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 no-print">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Receipt size={16} className="text-emerald-500" /> Checkout Complete
              </h3>
              <button
                id="receipt-modal-close"
                onClick={() => {
                  setShowReceipt(false);
                  setCompletedSale(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
              >
                Dismiss
              </button>
            </div>

            {/* Simulated thermal receipt body */}
            <div
              id="printable-receipt"
              className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl font-mono text-slate-800 text-[11px] leading-relaxed max-h-[380px] overflow-y-auto"
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

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>INVOICE NO:</span>
                  <span className="font-bold">{completedSale.invoiceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE/TIME:</span>
                  <span>{new Date(completedSale.saleDate).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>CASHIER:</span>
                  <span>{currentUser.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span>{customers.find((c) => c.id === completedSale.customerId)?.name || 'Walk-in'}</span>
                </div>
                <div className="border-t border-dashed border-slate-300 my-2"></div>
              </div>

              {/* Items listing */}
              <div className="space-y-1 mb-2">
                <div className="flex justify-between font-bold text-slate-600">
                  <span>Item Description</span>
                  <span className="w-12 text-center">Qty</span>
                  <span className="w-16 text-right">Total</span>
                </div>
                <div className="divide-y divide-dashed divide-slate-200">
                  {receiptItems.length === 0 ? (
                    <div className="text-center text-[10px] text-slate-400 py-2">No recent items listed.</div>
                  ) : (
                    receiptItems.map((item) => (
                      <div key={item.product.id} className="flex justify-between py-1 text-slate-700">
                        <span className="truncate pr-2 max-w-[180px]">{item.product.name}</span>
                        <span className="w-12 text-center font-mono">{item.quantity}</span>
                        <span className="w-16 text-right font-mono">
                          {settings.currencySymbol}{(item.product.salePrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-dashed border-slate-300 my-2"></div>
              </div>

              {/* Aggregates */}
              <div className="space-y-1 text-right">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>{settings.currencySymbol} {completedSale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>DISCOUNT:</span>
                  <span>- {settings.currencySymbol} {completedSale.discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>TAX ({settings.taxPercentage}%):</span>
                  <span>{settings.currencySymbol} {completedSale.tax.toFixed(2)}</span>
                </div>

                {completedSale.customerId && completedSale.customerId !== 1 && (
                  <>
                    <div className="border-t border-dashed border-slate-300 my-1"></div>
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>CURRENT BILL:</span>
                      <span>{settings.currencySymbol} {(completedSale.subtotal - completedSale.discount + completedSale.tax).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>PREVIOUS LOAN:</span>
                      <span>{settings.currencySymbol} {(completedSale.grandTotal - (completedSale.subtotal - completedSale.discount + completedSale.tax)).toFixed(2)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed border-slate-300">
                  <span>TOTAL PAYABLE:</span>
                  <span>{settings.currencySymbol} {completedSale.grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CASH PAID:</span>
                  <span>{settings.currencySymbol} {completedSale.paidAmount.toFixed(2)}</span>
                </div>
                {completedSale.returnAmount > 0 ? (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>CHANGE RETURN:</span>
                    <span>{settings.currencySymbol} {completedSale.returnAmount.toFixed(2)}</span>
                  </div>
                ) : completedSale.grandTotal > completedSale.paidAmount ? (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>REMAINING LOAN:</span>
                    <span>{settings.currencySymbol} {(completedSale.grandTotal - completedSale.paidAmount).toFixed(2)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between text-[10px]">
                  <span>PAYMENT STATUS:</span>
                  <span className="font-bold">
                    {completedSale.paidAmount >= completedSale.grandTotal
                      ? 'PAID'
                      : completedSale.paidAmount > 0
                        ? 'PARTIAL'
                        : 'LOAN'}
                  </span>
                </div>

                {completedSale.customerId && completedSale.customerId !== 1 && (
                  <div className="flex justify-between text-[10px] text-red-600 font-bold mt-1">
                    <span>OUTSTANDING BALANCE:</span>
                    <span>{settings.currencySymbol} {(customers.find(c => c.id === completedSale.customerId)?.balance || 0).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-[10px]">
                  <span>PAYMENT METHOD:</span>
                  <span>{completedSale.paymentMethod}</span>
                </div>
              </div>

              <div className="text-center mt-4 pt-2 border-t border-dashed border-slate-300">
                <p className="text-[10px] text-slate-500 uppercase">{settings.receiptFooter}</p>
                <p className="text-[9px] text-slate-400 mt-1">POWERED BY SMART RETAILER</p>
              </div>
              <div className="print-only-footer">
                {settings.receiptFooter} — Powered by Smart Retailer
              </div>
            </div>

            {/* Quick receipts action bar */}
            <div className="grid grid-cols-3 gap-2 no-print">
              <button
                type="button"
                id="receipt-print"
                onClick={triggerPrintReceipt}
                className="flex flex-col items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <Printer size={16} />
                <span>Print Rec</span>
              </button>
              <button
                type="button"
                id="receipt-download"
                onClick={exportReceiptPDF}
                className="flex flex-col items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <Download size={16} />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                id="receipt-share"
                onClick={shareReceiptWhatsApp}
                className="flex flex-col items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <Share2 size={16} />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Loan Modal */}
      {showConfirmLoanModal && confirmLoanDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-scale-up">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Landmark size={16} className="text-amber-500 animate-bounce" /> Save as Customer Loan?
              </h3>
            </div>
            <div className="space-y-3 text-xs text-slate-600">
              <p>
                The cashier is about to complete a credit checkout for{' '}
                <strong className="text-slate-800 text-sm block mt-1">
                  {customers.find((c) => c.id === confirmLoanDetails.customerId)?.name}
                </strong>
              </p>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 font-mono space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Current Bill:</span>
                  <span className="font-bold text-slate-800">
                    {settings.currencySymbol} {(confirmLoanDetails.grand - (customers.find((c) => c.id === confirmLoanDetails.customerId)?.balance || 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Previous Loan:</span>
                  <span className="font-bold text-slate-850">
                    {settings.currencySymbol} {(customers.find((c) => c.id === confirmLoanDetails.customerId)?.balance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-dashed border-slate-300 my-1"></div>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Total Payable:</span>
                  <span>{settings.currencySymbol} {confirmLoanDetails.grand.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Cash Paid:</span>
                  <span className="font-bold">{settings.currencySymbol} {confirmLoanDetails.finalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Remaining Loan:</span>
                  <span>{settings.currencySymbol} {confirmLoanDetails.loanAmount.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Confirming will log the remaining balance as an outstanding customer loan, update the dashboard statistics, and mark the invoice as Partially Paid.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 no-print">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmLoanModal(false);
                  setConfirmLoanDetails(null);
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer text-center"
              >
                No, Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  executeCheckout(
                    confirmLoanDetails.cart,
                    confirmLoanDetails.customerId,
                    confirmLoanDetails.subtotal,
                    confirmLoanDetails.discount,
                    confirmLoanDetails.tax,
                    confirmLoanDetails.grand,
                    confirmLoanDetails.finalPaid,
                    confirmLoanDetails.change,
                    confirmLoanDetails.paymentMethod
                  );
                  setShowConfirmLoanModal(false);
                  setConfirmLoanDetails(null);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer text-center"
              >
                Yes, Save as Loan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
