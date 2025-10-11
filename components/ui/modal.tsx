import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
}

/**
 * Accessible modal shell built to align with shadcn/ui semantics.
 * Framer Motion animations can be plugged in by wrapping the container
 * with `<AnimatePresence>` and replacing the root div with `motion.div`.
 */
export function Modal({ open, onClose, children, title, description }: ModalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      aria-hidden={!open}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm transition-opacity',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        className={cn(
          'relative mx-4 w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl transition-transform',
          open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close modal"
        >
          ×
        </button>
        {(title || description) && (
          <header className="mb-4 space-y-1">
            {title && (
              <h3 id="modal-title" className="text-xl font-semibold leading-tight">
                {title}
              </h3>
            )}
            {description && (
              <p id="modal-description" className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </header>
        )}
        <div className="space-y-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
