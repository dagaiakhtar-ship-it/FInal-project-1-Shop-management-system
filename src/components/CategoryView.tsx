import React, { useState } from 'react';
import { Category } from '../types';
import { Search, Plus, Edit2, Trash2, X } from 'lucide-react';

interface CategoryViewProps {
  categories: Category[];
  onAddCategory: (category: Omit<Category, 'id'>) => void;
  onUpdateCategory: (category: Category) => void;
  onDeleteCategory: (id: number) => void;
  userRole: 'Admin' | 'Manager' | 'Cashier';
}

export default function CategoryView({
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  userRole,
}: CategoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const openAddModal = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Category Name is required.');
      return;
    }

    // Prevent duplicates
    const dup = categories.find(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase() && (!editingCategory || c.id !== editingCategory.id)
    );
    if (dup) {
      setError(`A category with the name '${name}' already exists.`);
      return;
    }

    if (editingCategory) {
      onUpdateCategory({
        ...editingCategory,
        name: name.trim(),
        description: description.trim(),
      });
    } else {
      onAddCategory({
        name: name.trim(),
        description: description.trim(),
      });
    }

    setIsModalOpen(false);
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isRestricted = userRole === 'Cashier';

  return (
    <div className="space-y-4" id="category-panel">
      {/* Top Filter and Add Row */}
      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="category-search"
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg pl-8.5 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none text-xs"
          />
        </div>

        {!isRestricted && (
          <button
            id="category-add-btn"
            onClick={openAddModal}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm cursor-pointer"
          >
            <Plus size={12} />
            Add Category
          </button>
        )}
      </div>

      {/* Grid of categories with description list or JTable equivalent */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse" id="categories-table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
              <th className="py-2 px-4 w-20">ID</th>
              <th className="py-2 px-4">Category Name</th>
              <th className="py-2 px-4">Description</th>
              <th className="py-2 px-4 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400">
                  No categories found.
                </td>
              </tr>
            ) : (
              filteredCategories.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-1.5 px-4 font-mono text-slate-400 text-[10px]">#{c.id}</td>
                  <td className="py-1.5 px-4 font-semibold text-slate-800 text-xs">{c.name}</td>
                  <td className="py-1.5 px-4 text-slate-500 italic leading-none">{c.description || 'No description provided.'}</td>
                  <td className="py-1.5 px-4 text-right">
                    {isRestricted ? (
                      <span className="text-[10px] text-slate-400">Read Only</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <button
                          id={`category-edit-${c.id}`}
                          onClick={() => openEditModal(c)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          id={`category-delete-${c.id}`}
                          onClick={() => onDeleteCategory(c.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-scale-up" id="category-modal">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold font-display text-slate-800">
                {editingCategory ? 'Modify Category' : 'Create Category Classification'}
              </h3>
              <button
                id="category-modal-close"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <X size={14} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Category Name *</label>
                <input
                  id="category-form-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Grocery, Household, Beverages"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                <textarea
                  id="category-form-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 h-24"
                  placeholder="Describe what items are included in this category classification"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  id="category-form-cancel"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="category-form-submit"
                  className="bg-blue-600 hover:bg-blue-50 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-blue-600/10 cursor-pointer"
                >
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
