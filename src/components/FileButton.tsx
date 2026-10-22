import { useRef, type ReactNode } from 'react';
import { addFiles } from '../state/actions';

const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

/** Botón que abre el selector de archivos del sistema. */
export function FileButton({ className, children }: { className: string; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        data-testid="file-input"
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length) void addFiles(Array.from(files));
          event.target.value = '';
        }}
      />
    </>
  );
}
