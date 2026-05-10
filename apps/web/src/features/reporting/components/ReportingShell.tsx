import React from 'react';

export function ReportingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      {children}
    </div>
  );
}
