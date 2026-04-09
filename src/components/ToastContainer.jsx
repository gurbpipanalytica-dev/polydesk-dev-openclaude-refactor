import Toast from './Toast';

/**
 * ToastContainer
 * Fixed position container for all toast notifications
 * Position: Top-right corner
 */

export const ToastContainer = ({ toasts, onClose, theme }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            pointerEvents: 'auto',
            marginBottom: '8px',
          }}
        >
          <Toast toast={toast} onClose={onClose} theme={theme} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
