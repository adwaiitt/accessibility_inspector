function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDanger = false
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div className={`modal-icon-badge ${isDanger ? "badge-danger" : "badge-info"}`}>
            {isDanger ? "⚠️" : "ℹ"}
          </div>
          <div>
            <h3 id="modal-title" className="modal-title">{title}</h3>
            <p className="modal-message">{message}</p>
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-cancel-btn"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`modal-btn ${isDanger ? "modal-danger-btn" : "modal-confirm-btn"}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
