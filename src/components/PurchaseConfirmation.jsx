import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import './PurchaseConfirmation.css';

export default function PurchaseConfirmation({ title, message, onClose }) {
  const dialogRef = useRef(null);
  const nativeDialog = typeof window.HTMLDialogElement?.prototype.showModal === 'function';

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const wasInert = root?.inert;
    const previousHidden = root?.getAttribute('aria-hidden');
    if (nativeDialog) dialog.showModal();
    else {
      dialog.setAttribute('open', '');
      if (root) { root.inert = true; root.setAttribute('aria-hidden', 'true'); }
      dialog.querySelector('button')?.focus();
    }
    return () => {
      if (dialog.open) dialog.close?.();
      if (!nativeDialog && root) {
        root.inert = wasInert;
        if (previousHidden === null) root.removeAttribute('aria-hidden');
        else root.setAttribute('aria-hidden', previousHidden);
      }
      const target = previousFocus?.isConnected && !previousFocus.disabled
        ? previousFocus : document.querySelector('[role="tab"][aria-selected="true"]');
      target?.focus({ preventScroll: true });
    };
  }, [nativeDialog]);

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!nativeDialog) { event.preventDefault(); onClose(); }
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...event.currentTarget.querySelectorAll('button')];
    const current = buttons.indexOf(document.activeElement);
    event.preventDefault();
    const next = current < 0 ? (event.shiftKey ? buttons.length - 1 : 0)
      : (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return createPortal(<dialog ref={dialogRef}
    className={`purchase-confirmation${nativeDialog ? '' : ' is-fallback'}`}
    role="dialog" aria-modal="true" aria-labelledby="purchase-confirmation-title" aria-describedby="purchase-confirmation-message"
    onClose={event => { if (!event.currentTarget.open) onClose(); }} onKeyDown={handleKeyDown}>
    <div className="purchase-confirmation-card">
      <button type="button" className="purchase-confirmation-close" onClick={onClose} aria-label="Close purchase confirmation"><X size={20}/></button>
      <span className="purchase-confirmation-icon" aria-hidden="true"><Check size={30}/></span>
      <h2 id="purchase-confirmation-title">{title}</h2>
      <p id="purchase-confirmation-message">{message}</p>
      <button type="button" className="arcade-button primary purchase-confirmation-continue" onClick={onClose}>Continue</button>
    </div>
  </dialog>, document.body);
}
