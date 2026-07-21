import React, { useState } from 'react';
import { Product, Category, Supplier, Settings } from '../types';
import { Search, Plus, Edit2, Trash2, ArrowUpDown, Filter, Download, X, Eye } from 'lucide-react';

interface ProductViewProps {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  settings: Settings;
  onAddProduct: (product: Omit<Product, 'id' | 'createdAt'>) => boolean;
  onUpdateProduct: (product: Product) => boolean;
  onDeleteProduct: (id: number) => void;
  userRole: 'Admin' | 'Manager' | 'Cashier';
}

export default function ProductView({
  products,
  categories,
  suppliers,
  settings,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  userRole,
}: ProductViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState<number>(0);
  const [formSupplier, setFormSupplier] = useState<number>(0);
  const [formCostPrice, setFormCostPrice] = useState(0);
  const [formSalePrice, setFormSalePrice] = useState(0);
  const [formQuantity, setFormQuantity] = useState(0);
  const [formUnit, setFormUnit] = useState('Piece');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [validationError, setValidationError] = useState('');

  // Handle open modal for create
  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormBarcode('');
    setFormCategory(categories[0]?.id || 0);
    setFormSupplier(suppliers[0]?.id || 0);
    setFormCostPrice(0);
    setFormSalePrice(0);
    setFormQuantity(0);
    setFormUnit('Piece');
    setFormExpiryDate('');
    setFormDescription('');
    setFormBrand('');
    setValidationError('');
    setIsModalOpen(true);
  };

  // Handle open modal for update
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormBarcode(p.barcode);
    setFormCategory(p.categoryId);
    setFormSupplier(p.supplierId);
    setFormCostPrice(p.costPrice);
    setFormSalePrice(p.salePrice);
    setFormQuantity(p.quantity);
    setFormUnit(p.unit);
    setFormExpiryDate(p.expiryDate || '');
    setFormDescription(p.description);
    setFormBrand('Brand'); // Default or fallback
    setValidationError('');
    setIsModalOpen(true);
  };

  // Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    // Validations
    if (!formName.trim()) {
      setValidationError('Product Name is required.');
      return;
    }
    if (!formBarcode.trim()) {
      setValidationError('Barcode is required.');
      return;
    }
    if (formCostPrice < 0) {
      setValidationError('Cost Price cannot be negative.');
      return;
    }
    if (formSalePrice < 0) {
      setValidationError('Sale Price cannot be negative.');
      return;
    }
    if (formQuantity < 0) {
      setValidationError('Quantity cannot be negative.');
      return;
    }

    // Check duplicate barcode (excluding ourselves)
    const duplicate = products.find(
      (p) => p.barcode === formBarcode.trim() && (!editingProduct || p.id !== editingProduct.id)
    );
    if (duplicate) {
      setValidationError(`Barcode '${formBarcode}' is already assigned to product '${duplicate.name}'.`);
      return;
    }

    const pData = {
      name: formName.trim(),
      barcode: formBarcode.trim(),
      categoryId: Number(formCategory),
      supplierId: Number(formSupplier),
      costPrice: Number(formCostPrice),
      salePrice: Number(formSalePrice),
      quantity: Number(formQuantity),
      unit: formUnit,
      expiryDate: formExpiryDate ? formExpiryDate : undefined,
      description: formDescription.trim(),
    };

    let success = false;
    if (editingProduct) {
      success = onUpdateProduct({
        ...editingProduct,
        ...pData,
      });
    } else {
      success = onAddProduct(pData);
    }

    if (success) {
      setIsModalOpen(false);
    } else {
      setValidationError('An unexpected error occurred. Please verify inputs.');
    }
  };

  // Toggle Sorting
  const toggleSort = (type: 'name' | 'price' | 'stock') => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('asc');
    }
  };

  // Filters and Searching
  const filteredProducts = products
    .filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.includes(searchQuery);
      const matchCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      return matchSearch && matchCategory;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'price') {
        comparison = a.salePrice - b.salePrice;
      } else if (sortBy === 'stock') {
        comparison = a.quantity - b.quantity;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Export CSV representation
  const exportProductsCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Product ID,Barcode,Product Name,Category,Cost Price,SalePrice,Quantity,Unit,Expiry Date\n';

    filteredProducts.forEach((p) => {
      const catName = categories.find((c) => c.id === p.categoryId)?.name || 'N/A';
      csvContent += `${p.id},"${p.barcode}","${p.name}","${catName}",${p.costPrice},${p.salePrice},${p.quantity},"${p.unit}","${p.expiryDate || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'smart_shop_products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isRestricted = userRole === 'Cashier';

  return (
    <div className="space-y-4" id="product-panel">
      {/* Search and control bar */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
          {/* Search field */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="product-search"
              type="text"
              placeholder="Search by name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg pl-8.5 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none text-xs transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              id="product-category-filter"
              value={selectedCategory}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCategory(val === 'all' ? 'all' : Number(val));
              }}
              className="w-full sm:w-44 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 w-full md:w-auto justify-end">
          <button
            id="product-export-btn"
            onClick={exportProductsCSV}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
          >
            <Download size={12} />
            Export List
          </button>
          {!isRestricted && (
            <button
              id="product-add-btn"
              onClick={openAddModal}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all cursor-pointer"
            >
              <Plus size={12} />
              Add Product
            </button>
          )}
        </div>
      </div>

      {/* Product JTable equivalent */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse" id="products-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                <th className="py-2 px-4">ID</th>
                <th className="py-2 px-4 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('name')}>
                  <span className="flex items-center gap-1">
                    Product Name <ArrowUpDown size={11} />
                  </span>
                </th>
                <th className="py-2 px-4">Barcode</th>
                <th className="py-2 px-4">Category</th>
                <th className="py-2 px-4 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('price')}>
                  <span className="flex items-center gap-1">
                    Sale Price <ArrowUpDown size={11} />
                  </span>
                </th>
                <th className="py-2 px-4 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('stock')}>
                  <span className="flex items-center gap-1">
                    Quantity / Stock <ArrowUpDown size={11} />
                  </span>
                </th>
                <th className="py-2 px-4">Expiry</th>
                <th className="py-2 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No products found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  const isLow = p.quantity > 0 && p.quantity <= 10;
                  const isOut = p.quantity === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-1.5 px-4 font-mono text-slate-400 text-[10px]">#{p.id}</td>
                      <td className="py-1.5 px-4">
                        <div>
                          <span className="font-semibold text-slate-800 text-xs block">{p.name}</span>
                          <span className="text-[9px] text-slate-400 italic block leading-none">{p.description || 'No description'}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-4 font-mono tracking-wider text-[10px]">{p.barcode}</td>
                      <td className="py-1.5 px-4">
                        <span className="bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
                          {cat ? cat.name : 'Uncategorized'}
                        </span>
                      </td>
                      <td className="py-1.5 px-4 font-mono font-medium text-slate-800 text-xs">
                        <span className="text-[9px] text-slate-400 mr-0.5">Cost: {p.costPrice} •</span> {settings.currencySymbol}{p.salePrice}
                      </td>
                      <td className="py-1.5 px-4">
                        <span
                          className={`font-mono font-bold px-2 py-1 rounded text-[10px] inline-flex items-center gap-1 ${
                            isOut
                              ? 'bg-red-50 text-red-600 border border-red-100'
                              : isLow
                              ? 'bg-amber-50 text-amber-600 border border-amber-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}
                        >
                          {p.quantity} {p.unit}
                          {isOut && ' (Out)'}
                          {isLow && ' (Low)'}
                        </span>
                      </td>
                      <td className="py-1.5 px-4 text-slate-400 font-mono text-[10px]">{p.expiryDate || '—'}</td>
                      <td className="py-1.5 px-4 text-right">
                        {isRestricted ? (
                          <span className="text-[10px] text-slate-400 font-medium">Read Only</span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button
                              id={`product-edit-${p.id}`}
                              onClick={() => openEditModal(p)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              id={`product-delete-${p.id}`}
                              onClick={() => onDeleteProduct(p.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Create Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-scale-up" id="product-modal">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold font-display text-slate-800">
                {editingProduct ? 'Edit Product Parameters' : 'Register New Product'}
              </h3>
              <button
                id="product-modal-close"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {validationError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <X size={14} />
                {validationError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Product Name *</label>
                  <input
                    id="product-form-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Nestle Milkpak 1L"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Barcode *</label>
                  <input
                    id="product-form-barcode"
                    type="text"
                    required
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Barcode string / SKU"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Unit Type</label>
                  <select
                    id="product-form-unit"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-700 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="Piece">Piece</option>
                    <option value="Litre">Litre</option>
                    <option value="Pack">Pack</option>
                    <option value="Bottle">Bottle</option>
                    <option value="Pouch">Pouch</option>
                    <option value="Kg">Kg</option>
                    <option value="Rim">Rim</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
                  <select
                    id="product-form-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-700 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Supplier</label>
                  <select
                    id="product-form-supplier"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-700 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Cost Price ({settings.currencySymbol}) *</label>
                  <input
                    id="product-form-cost"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Sale Price ({settings.currencySymbol}) *</label>
                  <input
                    id="product-form-sale"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formSalePrice}
                    onChange={(e) => setFormSalePrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Quantity in Stock *</label>
                  <input
                    id="product-form-quantity"
                    type="number"
                    required
                    min="0"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Expiry Date (Optional)</label>
                  <input
                    id="product-form-expiry"
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-700 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Product Description</label>
                  <textarea
                    id="product-form-desc"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 h-16"
                    placeholder="Enter short description or brand details"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  id="product-form-cancel"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="product-form-submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-blue-600/10 cursor-pointer"
                >
                  {editingProduct ? 'Update Changes' : 'Register Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
