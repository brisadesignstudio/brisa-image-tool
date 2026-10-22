import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { addFiles } from './state/actions';
import { Editor } from './components/Editor';
import { ExportBar } from './components/ExportBar';
import { Header } from './components/Header';
import { ImageList } from './components/ImageList';
import { ImageOutputs } from './components/ImageOutputs';
import { NoticeAnnouncer } from './components/Notice';
import { VersionsBar } from './components/VersionsBar';
import { Welcome } from './components/Welcome';

/** Se pueden soltar imágenes en cualquier parte de la ventana. */
function useWindowDrop(): boolean {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const files = event.dataTransfer?.files;
      if (files?.length) void addFiles(Array.from(files));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);
  return dragging;
}

export function App() {
  const hasImages = useStore((s) => s.images.length > 0);
  const dragging = useWindowDrop();

  return (
    <>
      <Header />
      {hasImages ? (
        <div className="workspace">
          <ImageList />
          {/* Zona con desplazamiento propio en escritorio: enfocable para moverse con el teclado. */}
          <main className="main" aria-label="Versiones y revisión" tabIndex={0}>
            <VersionsBar />
            <ImageOutputs />
          </main>
          <ExportBar />
        </div>
      ) : (
        <>
          <Welcome dragging={dragging} />
          <footer className="footer">
            Una herramienta de Brisa Design Studio · Tus imágenes se procesan en este navegador y
            nunca se suben a ningún servidor.
          </footer>
        </>
      )}
      {hasImages && dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <p className="display">Suelta para añadir tus imágenes</p>
        </div>
      )}
      <NoticeAnnouncer areas={['imagenes', 'versiones', 'descarga']} />
      <Editor />
    </>
  );
}
