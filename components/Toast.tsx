import React from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Toast, ToastType } from '../context/ToastContext';

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
  const styles: Record<ToastType, string> = {
    success: 'bg-white border-green-200 text-green-800 shadow-green-100',
    error: 'bg-white border-red-200 text-red-800 shadow-red-100',
    info: 'bg-white border-blue-200 text-blue-800 shadow-blue-100',
    warning: 'bg-white border-amber-200 text-amber-800 shadow-amber-100',
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={20} className="text-green-500" />,
    error: <AlertCircle size={20} className="text-red-500" />,
    info: <Info size={20} className="text-blue-500" />,
    warning: <AlertTriangle size={20} className="text-amber-500" />,
  };

  return (
    <div
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg 
        transform transition-all duration-300 animate-in slide-in-from-right fade-in
        ${styles[toast.type]}
      `}
      role="alert"
    >
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      <div className="flex-1 text-sm font-medium">{toast.message}</div>
      <button
        onClick={onRemove}
        className="p-1 rounded-full hover:bg-black/5 transition-colors text-slate-400 hover:text-slate-600"
      >
        <X size={16} />
      </button>
    </div>
  );
};