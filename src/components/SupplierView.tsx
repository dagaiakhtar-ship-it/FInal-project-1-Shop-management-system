import React, { useState } from 'react';
import { Supplier, Product } from '../types';
import { Search, Plus, Edit2, Trash2, X, AlertCircle, ShoppingCart } from 'lucide-react';

interface SupplierViewProps {
  suppliers: Supplier[];
  products: Product[];
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  onUpdateSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: number) => void;
  userRole: 'Admin' | 'Manager' | 'Cashier';
}

export default function SupplierView({
  suppliers,
  products,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  userRole,
}: SupplierViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [productType, setProductType] = useState('');
  const [error, setError] = useState('');

  // viewing supplier products side panels
  const [viewingSupplierProductsId, setViewingSupplierProductsId] = useState<number | null>(null);

  const openAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setCompanyName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setProductType('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name);
    setCompanyName(s.companyName);
    setPhone(s.phone);
    setEmail(s.email);
    setAddress(s.address);
    setProductType(s.productType);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Supplier Name is required.');
      return;
    }
    if (!companyName.trim()) {
      setError('Company Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone Number is required.');
      return;
    }

    if (editingSupplier) {
      onUpdateSupplier({
        ...editingSupplier,
        name: name.trim(),
        companyName: companyName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        productType: productType.trim(),
      });
    } else {
      onAddSupplier({
        name: name.trim(),
        companyName: companyName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        productType: productType.trim(),
      });
    }

    setIsModalOpen(false);
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.productType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isRestricted = userRole === 'Cashier';

  // Products from selected supplier
  const supplierProductsList = viewingSupplierProductsId
    ? products.filter((p) => p.supplierId === viewingSupplierProductsId)
    : [];

  const activeSupplierDetails = suppliers.find((s) => s.id === viewingSupplierProductsId);

  return (
    <div className="space-y-4" id="supplier-panel">
      {/* Top Filter Bar */}
      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="supplier-search"
            type="text"
            placeholder="Search suppliers by name/company/type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg pl-8.5 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none text-xs"
          />
        </div>

        {!isRestricted && (
          <button
            id="supplier-add-btn"
            onClick={openAddModal}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm cursor-pointer"
          >
            <Plus size={12} />
            Register Supplier
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Suppliers List Table */}
        <div className={`${viewingSupplierProductsId ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden`}>
          <table className="w-full text-left text-xs border-collapse" id="suppliers-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                <th className="py-2 px-4">Supplier & Company</th>
                <th className="py-2 px-4">Contact Info</th>
                <th className="py-2 px-4">Product Type</th>
                <th className="py-2 px-4">Address</th>
                <th className="py-2 px-4 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No registered suppliers found.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => (
                  <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors ${viewingSupplierProductsId === s.id ? 'bg-blue-50/30' : ''}`}>
                    <td className="py-1.5 px-4">
                      <div>
                        <span className="font-semibold text-slate-800 text-xs block">{s.name}</span>
                        <span className="text-[9px] text-slate-500 font-bold">{s.companyName}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-4">
                      <div className="space-y-0.5 font-mono">
                        <span className="block font-bold text-slate-700">{s.phone}</span>
                        <span className="block text-[9px] text-slate-400 leading-none">{s.email || '—'}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-4">
                      <span className="bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded px-1.5 py-0.5 text-[9px] uppercase">
                        {s.productType || 'Various'}
                      </span>
                    </td>
                    <td className="py-1.5 px-4 text-slate-400 italic max-w-[130px] truncate">{s.address || '—'}</td>
                    <td className="py-1.5 px-4 text-right">
                      <div className="flex justify-end items-center gap-0.5">
                        <button
                          id={`supplier-products-${s.id}`}
                          onClick={() => setViewingSupplierProductsId(viewingSupplierProductsId === s.id ? null : s.id)}
                          className="p-1 text-slate-600 hover:bg-slate-50 rounded cursor-pointer"
                          title="View Supplied Products"
                        >
                          <ShoppingCart size={12} />
                        </button>
                        {!isRestricted && (
                          <>
                            <button
                              id={`supplier-edit-${s.id}`}
                              onClick={() => openEditModal(s)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                              title="Edit Supplier"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              id={`supplier-delete-${s.id}`}
                              onClick={() => onDeleteSupplier(s.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              title="Delete Supplier"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Supplied Products Sidebar */}
        {viewingSupplierProductsId && activeSupplierDetails && (
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3 animate-slide-left">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-xs font-bold text-slate-800">Supplied Products</h3>
                <p className="text-[10px] text-slate-400">By {activeSupplierDetails.companyName}</p>
              </div>
              <button
                id="supplier-products-close"
                onClick={() => setViewingSupplierProductsId(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
              {supplierProductsList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No products registered under this supplier.
                </div>
              ) : (
                supplierProductsList.map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-lg p-2 bg-slate-50/50 flex justify-between items-center text-[11px]">
                    <div>
                      <span className="font-semibold text-slate-800 block">{p.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono">Barcode: {p.barcode}</span>
                    </div>
                    <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[9px] font-bold text-blue-600">
                      Qty: {p.quantity}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Register/Edit Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-scale-up" id="supplier-modal">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold font-display text-slate-800">
                {editingSupplier ? 'Modify Supplier Profile' : 'Register New Supplier'}
              </h3>
              <button
                id="supplier-modal-close"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Name *</label>
                <input
                  id="supplier-form-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Imran Khan"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Company Name *</label>
                  <input
                    id="supplier-form-company"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Nestle Pakistan"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number *</label>
                  <input
                    id="supplier-form-phone"
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="e.g. 03001234567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
                  <input
                    id="supplier-form-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. supply@company.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Supplied Products Category</label>
                  <input
                    id="supplier-form-type"
                    type="text"
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Beverages, Grocery"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Company Address</label>
                <textarea
                  id="supplier-form-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 h-16"
                  placeholder="Enter complete office/warehouse address"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  id="supplier-form-cancel"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="supplier-form-submit"
                  className="bg-blue-600 hover:bg-blue-50 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-blue-600/10 cursor-pointer"
                >
                  {editingSupplier ? 'Save Changes' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
