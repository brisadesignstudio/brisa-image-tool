import type { ReactNode } from 'react';

/** Título de zona con su número dentro del recorrido: añadir, versiones, revisar, descargar. */
export function SectionTitle({
  id,
  step,
  children,
  count,
}: {
  id: string;
  step: number;
  children: ReactNode;
  count?: ReactNode;
}) {
  return (
    <h2 id={id} className="section-title">
      <span className="step" aria-hidden="true">
        {step}
      </span>
      <span className="visually-hidden">Paso {step}: </span>
      <span>{children}</span>
      {count !== undefined && <span className="count tabular">{count}</span>}
    </h2>
  );
}
