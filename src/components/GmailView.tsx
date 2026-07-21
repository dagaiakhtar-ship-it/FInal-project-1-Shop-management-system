import React from 'react';
import { Mail } from 'lucide-react';

export default function GmailView() {
  return (
    <div className="flex flex-col items-center justify-center p-10 bg-white rounded-2xl border border-slate-200/70 shadow-xs">
      <div className="p-4 bg-slate-100 text-slate-500 rounded-full mb-4">
        <Mail size={40} />
      </div>
      <h2 className="text-xl font-bold text-slate-800">Gmail Functionality Disabled</h2>
      <p className="text-sm text-slate-500 mt-2 text-center max-w-sm">
        This feature has been disabled as part of the Firebase integration removal.
      </p>
    </div>
  );
}
