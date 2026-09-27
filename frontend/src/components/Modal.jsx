import { useEffect } from 'react';

export default function Modal({ title, wide = false, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className={`modal ${wide ? 'wide' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <div><span className="eyebrow">Property Manager</span><h2>{title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">×</button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
