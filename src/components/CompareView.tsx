import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { itemKey, useStore } from '../state/store';
import { renderForCompare } from '../engine/renderer';
import { CancelledError } from '../engine/pool';
import { buildSpec } from '../engine/spec';
import { formatBytes, formatDimensions } from '../lib/format';
import type { Recipe, SourceImage } from '../lib/types';

type Zoom = 'fit' | 1 | 2;

interface Comparison {
  raw: ImageData;
  url: string;
  size: number;
}

/**
 * Antes y después de comprimir, con las medidas finales: a la izquierda los píxeles
 * sin comprimir, a la derecha la copia tal y como se descargará.
 */
export function CompareView({ image, recipe }: { image: SourceImage; recipe: Recipe }) {
  const crop = useStore((s) => s.crops[itemKey(image.id, recipe.id)]);
  const specKey = buildSpec(image, recipe, crop)?.key ?? '';
  const [data, setData] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [split, setSplit] = useState(50);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await renderForCompare(image.id, recipe.id);
        if (cancelled || !result?.output.raw) return;
        const { raw, blob, size } = result.output;
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setData({
          raw: new ImageData(new Uint8ClampedArray(raw.data, 0, raw.width * raw.height * 4), raw.width, raw.height),
          url,
          size,
        });
        setError(null);
      } catch (e) {
        if (cancelled || e instanceof CancelledError) return;
        setError(e instanceof Error ? e.message : 'No se pudo preparar la comparación.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [image.id, recipe.id, specKey]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node || !data) return;
    node.width = data.raw.width;
    node.height = data.raw.height;
    node.getContext('2d')?.putImageData(data.raw, 0, 0);
  }, [data]);

  const viewport = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node || !data) return;
    const measure = () => {
      const scale = Math.min(
        (node.clientWidth - 32) / data.raw.width,
        (node.clientHeight - 32) / data.raw.height,
        1,
      );
      setFitScale(Math.max(scale, 0.01));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [data]);

  const scale = zoom === 'fit' ? fitScale : zoom;
  const width = data ? Math.round(data.raw.width * scale) : 0;
  const height = data ? Math.round(data.raw.height * scale) : 0;

  const dragging = useRef(false);
  const pointToSplit = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setSplit(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
  };

  return (
    <div className="compare-wrap">
      <div className="compare-toolbar">
        <div className="labelled" role="group" aria-labelledby="zoom-label">
          <span id="zoom-label" className="labelled__label">
            Zoom de inspección
          </span>
          <div className="seg">
            <button type="button" aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>
              Ajustar
            </button>
            <button type="button" aria-pressed={zoom === 1} onClick={() => setZoom(1)}>
              100 %
            </button>
            <button type="button" aria-pressed={zoom === 2} onClick={() => setZoom(2)}>
              200 %
            </button>
          </div>
        </div>
        {data && (
          <p className="compare-toolbar__scale tabular">
            Vista al {Math.round(scale * 100)} % · el archivo mide{' '}
            {formatDimensions(data.raw.width, data.raw.height)} px
          </p>
        )}
        <label className="split-control">
          <span>Antes</span>
          <input
            className="range"
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(event) => setSplit(Number(event.target.value))}
            aria-label="Mover la línea entre antes y después"
          />
          <span>Después</span>
        </label>
      </div>
      {data && (
        <div className="compare__labels">
          <span>Antes de comprimir</span>
          <span className="tabular">Después · archivo final, {formatBytes(data.size)}</span>
        </div>
      )}
      <div className="compare-area">
        <div className="compare" ref={viewport} data-pixelated={zoom === 2}>
          {data && (
            <div
              className="compare__canvas"
              style={{ width, height, '--split': `${split}%` } as CSSProperties}
              onPointerDown={(event) => {
                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                pointToSplit(event);
              }}
              onPointerMove={(event) => dragging.current && pointToSplit(event)}
              onPointerUp={() => (dragging.current = false)}
              onPointerCancel={() => (dragging.current = false)}
            >
              <canvas ref={canvas} className="compare__layer" aria-label="Antes: sin comprimir" />
              <img
                className="compare__layer compare__layer--after"
                src={data.url}
                alt="Después: la copia comprimida"
                draggable={false}
              />
              <span className="compare__divider" />
            </div>
          )}
        </div>
        {(loading || error) && (
          <span className={`status compare__status${error ? ' status--error' : ''}`}>
            {error ?? (
              <>
                <span className="spinner" />
                Preparando la comparación…
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
