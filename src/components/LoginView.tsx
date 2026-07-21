import React, { useState } from 'react';
import { User } from '../types';
import { DEFAULT_USERS, hashPassword, DEFAULT_USER_PASSWORDS } from '../data';
import { Shield, Eye, EyeOff, Store, KeyRound, AlertCircle } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  users?: User[];
  userPasswords?: Record<string, string>;
}

export default function LoginView({ onLoginSuccess, users = DEFAULT_USERS, userPasswords = DEFAULT_USER_PASSWORDS }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    const matchedUser = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (!matchedUser) {
      setError('Invalid username or password.');
      return;
    }

    // Hash user's typed password and compare
    const typedHash = hashPassword(password);
    const storedHash = userPasswords[matchedUser.username];

    if (typedHash === storedHash) {
      if (rememberMe) {
        localStorage.setItem('smart_shop_remembered_user', JSON.stringify(matchedUser));
      }
      onLoginSuccess(matchedUser);
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-900/10 blur-[120px]" />

      <div className="w-full max-w-md" id="login-container">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-500/10 text-blue-400 mb-4 border border-blue-500/20 shadow-lg shadow-blue-500/5">
            <Store size={36} />
          </div>
          <h1 className="text-3xl font-bold font-display text-white tracking-tight">Smart Shop</h1>
          <p className="text-slate-400 mt-2 text-sm">Enterprise Management & POS System</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-200">Secure Access</h2>
              <p className="text-xs text-slate-500">Sign in to manage your retail store</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3 animate-fade-in" id="login-error">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Username
              </label>
              <div className="relative">
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none transition-colors duration-200 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-4 pr-11 py-3 text-slate-200 placeholder-slate-600 focus:outline-none transition-colors duration-200 text-sm"
                />
                <button
                  type="button"
                  id="login-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="login-remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                Remember me
              </label>
            </div>

            <button
              type="submit"
              id="login-submit"
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound size={16} />
              Verify Credentials
            </button>
          </form>

          {/* Quick Autofill Roles Selector */}
          <div className="hidden mt-6 pt-5 border-t border-slate-800 space-y-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Quick Autofill Roles:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="autofill-admin"
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                }}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/90 border border-slate-850 hover:border-red-500/30 text-slate-300 hover:text-white transition-all text-center cursor-pointer group"
              >
                <span className="text-[10px] font-extrabold text-red-400 group-hover:scale-105 transition-transform">Admin</span>
                <span className="text-[8px] text-slate-500 mt-0.5 font-mono">admin / 123</span>
              </button>
              <button
                type="button"
                id="autofill-manager"
                onClick={() => {
                  setUsername('manager');
                  setPassword('manager123');
                }}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/90 border border-slate-850 hover:border-amber-500/30 text-slate-300 hover:text-white transition-all text-center cursor-pointer group"
              >
                <span className="text-[10px] font-extrabold text-amber-400 group-hover:scale-105 transition-transform">Manager</span>
                <span className="text-[8px] text-slate-500 mt-0.5 font-mono">manager / 123</span>
              </button>
              <button
                type="button"
                id="autofill-cashier"
                onClick={() => {
                  setUsername('cashier');
                  setPassword('cashier123');
                }}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/60 hover:bg-slate-950/90 border border-slate-850 hover:border-blue-500/30 text-slate-300 hover:text-white transition-all text-center cursor-pointer group"
              >
                <span className="text-[10px] font-extrabold text-blue-400 group-hover:scale-105 transition-transform">Cashier</span>
                <span className="text-[8px] text-slate-500 mt-0.5 font-mono">cashier / 123</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-slate-600 font-mono">
            SECURE LAYER ENABLED • VERSION 1.2.0
          </p>
        </div>
      </div>
    </div>
  );
}
