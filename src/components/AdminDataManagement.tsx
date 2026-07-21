import React, { useState, useRef } from 'react';
import { User, ActivityLog } from '../types';
import { Shield, Download, Upload, AlertTriangle, X, FileSpreadsheet, FileText, Trash2 } from 'lucide-react';
import {
  DATA_ACTION_CONFIGS,
  DataManagementAction,
  DataActionConfig,
} from '../utils/dataManagement';
import { BackupPayload, BackupExportResult, validateBackupPayload, formatFileSize } from '../utils/backup';

interface AdminDataManagementProps {
  currentUser: User;
  activityLogs: ActivityLog[];
  onAdminAction: (action: DataManagementAction) => { success: boolean; recordsDeleted: number; message?: string };
  onExportBackup?: () => BackupExportResult;
  onImportBackup?: (payload: BackupPayload) => { sessionWarning?: string };
  onExportCsv?: () => void;
  onExportPdfReports?: () => void;
}

export default function AdminDataManagement({
  currentUser,
  activityLogs,
  onAdminAction,
  onExportBackup,
  onImportBackup,
  onExportCsv,
  onExportPdfReports,
}: AdminDataManagementProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAction, setPendingAction] = useState<DataActionConfig | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [importPreview, setImportPreview] = useState<BackupPayload | null>(null);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const isAdmin = currentUser.role === 'Admin';

  const requireAdmin = (): boolean => {
    if (!isAdmin) {
      setAccessDenied(true);
      setActionMessage({
        type: 'error',
        text: 'Access Denied. Only administrators can perform this operation.',
      });
      return false;
    }
    setAccessDenied(false);
    return true;
  };

  const openConfirmDialog = (config: DataActionConfig) => {
    if (!requireAdmin()) return;
    setPendingAction(config);
    setConfirmInput('');
    setActionMessage(null);
  };

  const handleConfirmAction = () => {
    if (!pendingAction || !requireAdmin()) return;
    if (confirmInput !== pendingAction.confirmPhrase) return;

    const result = onAdminAction(pendingAction.id);
    setPendingAction(null);
    setConfirmInput('');

    if (result.success) {
      setActionMessage({
        type: 'success',
        text: result.message ?? `${pendingAction.label} completed. ${result.recordsDeleted} record(s) affected.`,
      });
    } else {
      setActionMessage({
        type: 'error',
        text: result.message ?? 'Operation failed.',
      });
    }
  };

  const handleExportBackup = () => {
    if (!requireAdmin() || !onExportBackup) return;
    setBackupMessage(null);
    const result = onExportBackup();
    const total = Object.values(result.recordCounts).reduce((s: number, n: number) => s + n, 0);
    setBackupMessage({
      type: 'success',
      text: `Backup exported as ${result.filename} (${formatFileSize(result.fileSizeBytes)}, ${total} records).`,
    });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!requireAdmin()) return;
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
    if (!importPreview || !onImportBackup || !requireAdmin()) return;
    const result = onImportBackup(importPreview);
    setImportPreview(null);
    const total = Object.values(importPreview.meta.recordCounts).reduce((s: number, n: number) => s + n, 0);
    let text = `Backup restored successfully (${total} records).`;
    if (result.sessionWarning) {
      setBackupMessage({ type: 'warning', text: `${text} ${result.sessionWarning}` });
    } else {
      setBackupMessage({ type: 'success', text });
    }
  };

  const clearActions = DATA_ACTION_CONFIGS.filter((a) => a.category === 'clear' || a.category === 'reset');
  const destructiveActions = DATA_ACTION_CONFIGS.filter((a) => a.id === 'factory_reset');

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <div className="border border-slate-200 bg-slate-50 p-5 rounded-2xl opacity-60">
          <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
            <Shield size={16} />
            Admin Data Management
          </h3>
          <p className="text-xs text-slate-500 mt-2">
            Only administrators can access Data Management features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
        <Shield size={16} className="text-red-500" />
        Admin Data Management
      </h3>

      {(actionMessage || backupMessage) && (
        <div
          className={`p-3 border text-xs rounded-xl flex items-center gap-2 ${
            (actionMessage ?? backupMessage)?.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
              : (actionMessage ?? backupMessage)?.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-red-50 border-red-200 text-red-600'
          }`}
        >
          <Shield size={14} />
          {(actionMessage ?? backupMessage)?.text}
        </div>
      )}

      {accessDenied && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl">
          Access Denied. Only administrators can perform this operation.
        </div>
      )}

      {/* Clear / Reset Actions */}
      <div className="border border-slate-100 p-5 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Data Cleanup & Reset</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {clearActions.filter((a) => a.id !== 'factory_reset').map((config) => (
            <button
              key={config.id}
              id={`admin-action-${config.id}`}
              onClick={() => openConfirmDialog(config)}
              className="flex items-center gap-2 text-left bg-slate-50 hover:bg-red-50 hover:border-red-200 border border-slate-100 text-slate-700 font-semibold px-3 py-2.5 rounded-xl text-[11px] transition-colors cursor-pointer"
            >
              <span>{config.emoji}</span>
              <span>{config.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Export Actions */}
      <div className="border border-slate-100 p-5 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Export & Backup</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            id="admin-export-backup"
            onClick={handleExportBackup}
            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
          >
            <Download size={14} />
            Export Backup (JSON)
          </button>
          <button
            id="admin-import-backup"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
          >
            <Upload size={14} />
            Import Backup (JSON)
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
          <button
            id="admin-export-csv"
            onClick={() => {
              if (requireAdmin() && onExportCsv) onExportCsv();
            }}
            className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            Export CSV
          </button>
          <button
            id="admin-export-pdf"
            onClick={() => {
              if (requireAdmin() && onExportPdfReports) onExportPdfReports();
            }}
            className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
          >
            <FileText size={14} />
            Export PDF Reports
          </button>
        </div>
      </div>

      {/* Factory Reset */}
      <div className="border border-red-200 bg-red-50/50 p-5 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider">Danger Zone</h4>
        {destructiveActions.map((config) => (
          <button
            key={config.id}
            id={`admin-action-${config.id}`}
            onClick={() => openConfirmDialog(config)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
          >
            <Trash2 size={14} />
            {config.emoji} {config.label}
          </button>
        ))}
      </div>

      {/* Activity Log */}
      <div className="border border-slate-100 p-5 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Activity Log</h4>
        {activityLogs.length === 0 ? (
          <p className="text-xs text-slate-400">No admin actions recorded yet.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {[...activityLogs].reverse().slice(0, 50).map((log) => (
              <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] space-y-1">
                <div className="font-bold text-slate-700">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Unknown date'}
                </div>
                <div className="text-slate-600">
                  Admin: <span className="font-semibold">{log.username ?? 'Unknown'}</span>
                </div>
                <div className="text-slate-600">Action: {log.action}</div>
                {log.dataAffected && <div className="text-slate-500">Data: {log.dataAffected}</div>}
                {log.recordsDeleted !== undefined && (
                  <div className="text-slate-500">Records: {log.recordsDeleted}</div>
                )}
                <div className={`font-semibold ${log.status === 'Success' ? 'text-emerald-600' : log.status === 'Denied' ? 'text-red-600' : 'text-amber-600'}`}>
                  Status: {log.status ?? 'Success'}
                </div>
                {log.deviceInfo && (
                  <div className="text-slate-400 truncate" title={log.deviceInfo}>
                    Device: {log.deviceInfo.length > 80 ? `${log.deviceInfo.slice(0, 80)}…` : log.deviceInfo}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {pendingAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                Confirm: {pendingAction.label}
              </h4>
              <button onClick={() => setPendingAction(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{pendingAction.description}</p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800">
              <strong>Data affected:</strong> {pendingAction.dataAffected}
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-semibold text-slate-500">
                Type <span className="font-mono font-bold text-red-600">{pendingAction.confirmPhrase}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-red-400"
                placeholder={pendingAction.confirmPhrase}
                autoComplete="off"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={confirmInput !== pendingAction.confirmPhrase}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Dialog */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-slate-800">Confirm Backup Import</h4>
              <button onClick={() => setImportPreview(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Backup from: {new Date(importPreview.meta.exportedAt).toLocaleString()}
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {Object.entries(importPreview.meta.recordCounts).map(([key, count]) => (
                <div key={key} className="flex justify-between text-[11px] px-2 py-1 bg-slate-50 rounded-lg">
                  <span className="text-slate-500">{key}</span>
                  <span className="font-mono font-bold">{count}</span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>This will replace all current data. This cannot be undone.</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setImportPreview(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs cursor-pointer">
                Cancel
              </button>
              <button onClick={handleConfirmImport} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-xs cursor-pointer">
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
