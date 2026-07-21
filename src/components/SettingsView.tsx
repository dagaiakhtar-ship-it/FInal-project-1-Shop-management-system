import React, { useState, useRef } from 'react';
import { Settings, User, ActivityLog } from '../types';
import { Settings as SettingsIcon, Shield, Database, Users, HelpCircle, Save, Download, Upload, Plus, Trash2, Pencil, User as UserIcon, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { BackupPayload, BackupExportResult, validateBackupPayload, formatFileSize } from '../utils/backup';
import { DataManagementAction } from '../utils/dataManagement';
import AdminDataManagement from './AdminDataManagement';

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  currentUser: User;
  users?: User[];
  onAddUser?: (user: User, initialPasswordPlain: string) => void;
  onUpdateUser?: (updatedUser: User, newPasswordPlain?: string, oldUsername?: string) => void;
  onDeleteUser?: (id: number, username: string) => void;
  onResetUsers?: () => void;
  onExportBackup?: () => BackupExportResult;
  onImportBackup?: (payload: BackupPayload) => { sessionWarning?: string };
  backupSummary?: { recordCounts: Record<string, number>; totalRecords: number };
  activityLogs?: ActivityLog[];
  onAdminDataAction?: (action: DataManagementAction) => { success: boolean; recordsDeleted: number; message?: string };
  onExportDataCsv?: () => void;
  onExportReportsPdf?: () => void;
}

export default function SettingsView({
  settings,
  onUpdateSettings,
  currentUser,
  users = [],
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onResetUsers,
  onExportBackup,
  onImportBackup,
  backupSummary,
  activityLogs = [],
  onAdminDataAction,
  onExportDataCsv,
  onExportReportsPdf,
}: SettingsViewProps) {
  const [shopName, setShopName] = useState(settings.shopName);
  const [shopAddress, setShopAddress] = useState(settings.shopAddress);
  const [phone, setPhone] = useState(settings.phone);
  const [taxPercentage, setTaxPercentage] = useState(settings.taxPercentage);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol);
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter);

  const [activeTab, setActiveTab] = useState<'shop' | 'users' | 'backup' | 'data_management' | 'profile'>(() => {
    return currentUser.role === 'Admin' ? 'shop' : 'profile';
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile update states
  const [profileFullName, setProfileFullName] = useState(currentUser.fullName);
  const [profileUsername, setProfileUsername] = useState(currentUser.username);
  const [profilePassword, setProfilePassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Sync profile fields if currentUser prop changes
  React.useEffect(() => {
    setProfileFullName(currentUser.fullName);
    setProfileUsername(currentUser.username);
  }, [currentUser]);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess(false);

    if (!profileFullName.trim() || !profileUsername.trim()) {
      setProfileError('Full Name and Username are required fields.');
      return;
    }

    const cleanedUsername = profileUsername.trim().toLowerCase();

    // Check for duplicate username across other users
    if (cleanedUsername !== currentUser.username) {
      const dup = users.find((u) => u.username.toLowerCase() === cleanedUsername);
      if (dup) {
        setProfileError(`Username '${profileUsername}' is already taken.`);
        return;
      }
    }

    const updatedUser: User = {
      ...currentUser,
      fullName: profileFullName.trim(),
      username: cleanedUsername,
    };

    if (onUpdateUser) {
      onUpdateUser(updatedUser, profilePassword.trim() || undefined, currentUser.username);
      setProfileSuccess(true);
      setProfilePassword('');
      setTimeout(() => setProfileSuccess(false), 3000);
    }
  };

  // Users registration states
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Manager' | 'Cashier'>('Cashier');
  const [userError, setUserError] = useState('');

  // Editing state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<'Admin' | 'Manager' | 'Cashier'>('Cashier');
  const [editPassword, setEditPassword] = useState('');

  // Backup state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [lastExportInfo, setLastExportInfo] = useState<{ filename: string; fileSizeBytes: number; recordCounts: Record<string, number> } | null>(null);
  const [importPreview, setImportPreview] = useState<BackupPayload | null>(null);

  const handleExportBackup = () => {
    if (!onExportBackup) return;
    setBackupMessage(null);
    const result = onExportBackup();
    setLastExportInfo({
      filename: result.filename,
      fileSizeBytes: result.fileSizeBytes,
      recordCounts: result.recordCounts,
    });
    const totalRecords = Object.values(result.recordCounts).reduce((sum, n) => sum + n, 0);
    setBackupMessage({
      type: 'success',
      text: `Backup exported as ${result.filename} (${formatFileSize(result.fileSizeBytes)}, ${totalRecords} total records).`,
    });
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string);
        const validation = validateBackupPayload(raw);
        if (validation.ok === false) {
          setBackupMessage({ type: 'error', text: validation.error });
          return;
        }
        setImportPreview(validation.payload);
      } catch {
        setBackupMessage({ type: 'error', text: 'Invalid JSON file. Could not parse backup.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!importPreview || !onImportBackup) return;
    const result = onImportBackup(importPreview);
    setImportPreview(null);
    const totalRecords = Object.values(importPreview.meta.recordCounts).reduce(
      (sum: number, n: number) => sum + n,
      0
    );
    let text = `Backup restored successfully (${totalRecords} total records).`;
    if (result.sessionWarning) {
      setBackupMessage({ type: 'warning', text: `${text} ${result.sessionWarning}` });
    } else {
      setBackupMessage({ type: 'success', text });
    }
  };

  const collectionLabels: Record<string, string> = {
    products: 'Products',
    categories: 'Categories',
    suppliers: 'Suppliers',
    customers: 'Customers',
    sales: 'Sales',
    stockHistory: 'Stock History',
    loans: 'Loans',
    loanPayments: 'Loan Payments',
    settings: 'Settings',
    users: 'Users',
    userPasswords: 'User Passwords',
    expenses: 'Expenses',
    purchases: 'Purchases',
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      id: settings.id,
      shopName,
      shopAddress,
      phone,
      taxPercentage: Number(taxPercentage),
      currencySymbol,
      receiptFooter,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);
  };

  // Add user handler (restricted to Admin)
  const handleAddUserLocal = (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');

    if (!newUsername.trim() || !newFullName.trim() || !newPassword.trim()) {
      setUserError('All user fields, including password, are required.');
      return;
    }

    const dup = users.find((u) => u.username.toLowerCase() === newUsername.trim().toLowerCase());
    if (dup) {
      setUserError(`Username '${newUsername}' is already taken.`);
      return;
    }

    const newUser: User = {
      id: users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1,
      username: newUsername.trim().toLowerCase(),
      fullName: newFullName.trim(),
      role: newRole,
      createdAt: new Date().toISOString(),
    };

    if (onAddUser) {
      onAddUser(newUser, newPassword);
    }
    setNewUsername('');
    setNewFullName('');
    setNewPassword('');
    setNewRole('Cashier');
  };

  const handleStartEditUser = (user: User) => {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditUsername(user.username);
    setEditRole(user.role);
    setEditPassword('');
    setUserError('');
  };

  const handleSaveEditedUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');

    if (!editingUser) return;

    if (!editUsername.trim() || !editFullName.trim()) {
      setUserError('Full display name and username are required.');
      return;
    }

    // Check duplicate username if renamed
    if (editUsername.trim().toLowerCase() !== editingUser.username) {
      const dup = users.find((u) => u.username.toLowerCase() === editUsername.trim().toLowerCase());
      if (dup) {
        setUserError(`Username '${editUsername}' is already taken.`);
        return;
      }
    }

    const updatedUser: User = {
      ...editingUser,
      fullName: editingUser.fullName, // Not other changes
      username: editUsername.trim().toLowerCase(),
      role: editingUser.role, // Not other changes
    };

    if (onUpdateUser) {
      onUpdateUser(updatedUser, editPassword.trim() || undefined, editingUser.username);
    }

    setEditingUser(null);
    setEditFullName('');
    setEditUsername('');
    setEditRole('Cashier');
    setEditPassword('');
  };

  const handleDeleteUserLocal = (id: number, username: string) => {
    if (id === currentUser.id) {
      setUserError('Cannot delete currently logged in administrator.');
      return;
    }
    if (id <= 3) {
      setUserError('Standard preset users (Admin, Manager, Cashier) cannot be deleted.');
      return;
    }
    if (onDeleteUser) {
      onDeleteUser(id, username);
    }
  };

  const isAdmin = currentUser.role === 'Admin';
  const isAllowedUsers = currentUser.role === 'Admin' || currentUser.role === 'Manager';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="settings-panel">
      {/* Side Tabs Navigation */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs space-y-1 h-fit">
        {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
          <button
            id="settings-tab-shop"
            onClick={() => setActiveTab('shop')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'shop' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <SettingsIcon size={16} />
            Shop Parameters
          </button>
        )}
        {(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
          <button
            id="settings-tab-users"
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'users' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Users size={16} />
            User Permissions
          </button>
        )}
        {currentUser.role === 'Admin' && (
          <button
            id="settings-tab-backup"
            onClick={() => setActiveTab('backup')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'backup' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Database size={16} />
            Database Tools
          </button>
        )}
        {currentUser.role === 'Admin' && (
          <button
            id="settings-tab-data-management"
            onClick={() => setActiveTab('data_management')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              activeTab === 'data_management' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Shield size={16} />
            Data Management
          </button>
        )}
        <button
          id="settings-tab-profile"
          onClick={() => setActiveTab('profile')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'profile' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <UserIcon size={16} />
          My Profile / User Info
        </button>
      </div>

      {/* Main Configurations Display Column */}
      <div className="lg:col-span-3 bg-white border border-slate-100 p-6 rounded-2xl shadow-xs">
        {activeTab === 'shop' && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
              <SettingsIcon size={16} className="text-slate-400" />
              General Shop Settings
            </h3>

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs rounded-xl flex items-center gap-2">
                <Shield size={14} />
                General configurations updated successfully!
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Shop Name *</label>
                  <input
                    id="settings-form-name"
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Number *</label>
                  <input
                    id="settings-form-phone"
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Shop Address *</label>
                  <input
                    id="settings-form-address"
                    type="text"
                    required
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">System Currency Symbol *</label>
                  <input
                    id="settings-form-currency"
                    type="text"
                    required
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Sales Tax Percentage (%) *</label>
                  <input
                    id="settings-form-tax"
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={taxPercentage}
                    onChange={(e) => setTaxPercentage(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Receipt Footer Memo</label>
                  <input
                    id="settings-form-footer"
                    type="text"
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  id="settings-form-submit"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-blue-600/10 cursor-pointer"
                >
                  <Save size={14} />
                  Save Configurations
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 gap-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Shield size={16} className="text-slate-400" />
                Role-Based User Permissions Manager
              </h3>
              {isAdmin && onResetUsers && (
                <button
                  id="reset-users-default"
                  type="button"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to restore the default users (Admin, Manager, Cashier)? This will overwrite existing users.")) {
                      onResetUsers();
                    }
                  }}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white font-bold px-3 py-1.5 rounded-xl text-[10px] shadow-sm cursor-pointer transition-colors"
                >
                  <RefreshCw size={12} />
                  Restore Default Users
                </button>
              )}
            </div>

            {!isAllowedUsers ? (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-center text-xs space-y-2">
                <Shield size={24} className="mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">Access Restricted</p>
                <p>Only system Administrators and Managers are authorized to view and modify user login profiles.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* User listing table */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm border-collapse" id="settings-users-table">
                    <thead className="bg-slate-50/70 text-slate-400 font-medium text-xs uppercase">
                      <tr>
                        <th className="py-2.5 px-4">Full Name</th>
                        <th className="py-2.5 px-4">Username</th>
                        <th className="py-2.5 px-4">Role Permission</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-600 text-xs">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/30">
                          <td className="py-3 px-4 font-semibold text-slate-800">{u.fullName}</td>
                          <td className="py-3 px-4 font-mono">{u.username}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                u.role === 'Admin'
                                  ? 'bg-red-50 text-red-600 border border-red-100'
                                  : u.role === 'Manager'
                                  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                  : 'bg-blue-50 text-blue-600 border border-blue-100'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              id={`user-edit-${u.id}`}
                              onClick={() => handleStartEditUser(u)}
                              className="text-blue-500 p-1 hover:bg-blue-50 rounded-lg cursor-pointer mr-1.5 inline-flex items-center"
                              title="Edit Username or Password"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              id={`user-delete-${u.id}`}
                              onClick={() => handleDeleteUserLocal(u.id, u.username)}
                              className="text-red-500 p-1 hover:bg-red-50 rounded-lg cursor-pointer inline-flex items-center"
                              title="Delete User"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Edit user credentials card if active, else Register form */}
                {editingUser ? (
                  <div className="bg-blue-50/40 border border-blue-100/60 p-5 rounded-2xl space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-blue-100/40">
                      <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Pencil size={14} />
                        Modify Login Account: {editingUser.fullName}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setEditingUser(null)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    </div>

                    {userError && (
                      <div className="p-2.5 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                        {userError}
                      </div>
                    )}

                    <form onSubmit={handleSaveEditedUser} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Full Name (Read-Only)</label>
                        <input
                          id="edit-user-name"
                          type="text"
                          required
                          disabled
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-400 text-xs focus:outline-none cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Username Login</label>
                        <input
                          id="edit-user-username"
                          type="text"
                          required
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">New Password (leave empty to keep)</label>
                        <input
                          id="edit-user-password"
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Role (Read-Only)</label>
                        <select
                          id="edit-user-role"
                          value={editRole}
                          disabled
                          onChange={(e) => setEditRole(e.target.value as User['role'])}
                          className="w-full bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-400 text-xs focus:outline-none cursor-not-allowed"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="Cashier">Cashier</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 md:col-span-1">
                        <button
                          type="submit"
                          id="edit-user-submit"
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 rounded-xl text-xs h-[32px] cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus size={14} className="text-slate-400" />
                      Register New Login Account
                    </h4>

                    {userError && (
                      <div className="p-2.5 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                        {userError}
                      </div>
                    )}

                    <form onSubmit={handleAddUserLocal} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Full Display Name</label>
                        <input
                          id="user-form-name"
                          type="text"
                          required
                          value={newFullName}
                          onChange={(e) => setNewFullName(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                          placeholder="e.g. Bilal Ahmed"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Username Login</label>
                        <input
                          id="user-form-username"
                          type="text"
                          required
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-blue-500 font-mono"
                          placeholder="e.g. bilal12"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Login Password</label>
                        <input
                          id="user-form-password"
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                          placeholder="••••••••"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Role Permission</label>
                        <select
                          id="user-form-role"
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as User['role'])}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 text-xs focus:outline-none"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="Cashier">Cashier</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 md:col-span-1">
                        <button
                          type="submit"
                          id="user-form-submit"
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 rounded-xl text-xs h-[32px] cursor-pointer"
                        >
                          Add Account
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Database size={16} className="text-slate-400" />
              Database Backup & Recovery
            </h3>

            {backupMessage && (
              <div
                className={`p-3 border text-xs rounded-xl flex items-center gap-2 ${
                  backupMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : backupMessage.type === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-red-50 border-red-200 text-red-600'
                }`}
              >
                <Shield size={14} />
                {backupMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-100 p-5 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Export Backup</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Download a JSON file containing all shop data: products, sales, customers, users, and more.
                </p>
                <button
                  id="backup-export-btn"
                  onClick={handleExportBackup}
                  disabled={!onExportBackup}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download size={14} />
                  Export Backup
                </button>
              </div>

              <div className="border border-slate-100 p-5 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Import Backup</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Restore all data from a previously exported JSON backup file. Current data will be replaced.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportFileSelect}
                />
                <button
                  id="backup-import-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!onImportBackup}
                  className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Upload size={14} />
                  Import Backup
                </button>
              </div>
            </div>

            {backupSummary && (
              <div className="border border-slate-100 p-5 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Current Data Summary</h4>
                <p className="text-xs text-slate-400">
                  {backupSummary.totalRecords} total records across all collections
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(backupSummary.recordCounts).map(([key, count]) => (
                    <div key={key} className="flex justify-between text-[11px] bg-slate-50 px-2 py-1 rounded-lg">
                      <span className="text-slate-500">{collectionLabels[key] ?? key}</span>
                      <span className="font-mono font-bold text-slate-700">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lastExportInfo && (
              <div className="border border-emerald-100 bg-emerald-50/50 p-5 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Last Export</h4>
                <p className="text-[11px] text-emerald-700 font-mono">{lastExportInfo.filename}</p>
                <p className="text-[11px] text-emerald-600">{formatFileSize(lastExportInfo.fileSizeBytes)}</p>
              </div>
            )}

            {importPreview && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-800">Confirm Backup Import</h4>
                    <button
                      onClick={() => setImportPreview(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500">
                    Backup from: {new Date(importPreview.meta.exportedAt).toLocaleString()}
                  </p>

                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {Object.entries(importPreview.meta.recordCounts).map(([key, count]) => (
                      <div key={key} className="flex justify-between text-[11px] px-2 py-1 bg-slate-50 rounded-lg">
                        <span className="text-slate-500">{collectionLabels[key] ?? key}</span>
                        <span className="font-mono font-bold">{count}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>This will replace all current data. This cannot be undone.</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setImportPreview(null)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-xs cursor-pointer"
                    >
                      Confirm Import
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'data_management' && (
          <AdminDataManagement
            currentUser={currentUser}
            activityLogs={activityLogs}
            onAdminAction={onAdminDataAction ?? (() => ({ success: false, recordsDeleted: 0 }))}
            onExportBackup={onExportBackup}
            onImportBackup={onImportBackup}
            onExportCsv={onExportDataCsv}
            onExportPdfReports={onExportReportsPdf}
          />
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
              <UserIcon size={16} className="text-slate-400" />
              My Profile & Login Information
            </h3>

            {profileSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs rounded-xl flex items-center gap-2">
                <Shield size={14} />
                Your profile information has been updated successfully!
              </div>
            )}

            {profileError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <Shield size={14} className="text-red-500" />
                {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name *</label>
                  <input
                    id="profile-form-fullname"
                    type="text"
                    required
                    value={profileFullName}
                    onChange={(e) => setProfileFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Username Login *</label>
                  <input
                    id="profile-form-username"
                    type="text"
                    required
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">New Password (leave empty to keep current)</label>
                  <input
                    id="profile-form-password"
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Assigned Role (Read-only)</label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-500 text-sm font-semibold select-none">
                    {currentUser.role}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  id="profile-form-submit"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-blue-600/10 cursor-pointer"
                >
                  <Save size={14} />
                  Update Profile Info
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
