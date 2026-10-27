export default function LoadingIndicator({ label = 'Working…' }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="dot" /><span className="dot" /><span className="dot" />
      <span className="loading-label">{label}</span>
    </div>
  );
}
