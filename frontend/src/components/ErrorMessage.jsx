import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorMessage({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      <AlertTriangle size={18} />
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-small btn-ghost" onClick={onRetry}>
          <RotateCcw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
