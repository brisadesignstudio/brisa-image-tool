import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { itemKey, useStore } from '../state/store';
import { setCrop } from '../state/actions';
import { computeLayout, fitCrop } from '../lib/geometry';
import { formatDimensions } from '../lib/format';
import type { CropRect, Recipe, SourceImage } from '../lib/types';

type Corner = 'nw' | 'ne' | 'sw' | 'se';
type DragKind = 'move' | Corner;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Redimensiona desde una esquina manteniendo la proporción y la esquina opuesta fija. */
function resizeFromCorner(
  start: CropRect,
  corner: Corner,
  dx: number,
  dy: number,
  srcW: number,
  srcH: number,
  aspect: number,
): CropRect {
  const west = corner.includes('w');
  const north = corner.includes('n');
  const sx = start.x * srcW;
  const sy = start.y * srcH;
  const sw = start.w * srcW;
  const sh = start.h * srcH;
  const ax = west ? sx + sw : sx;
  const ay = north ? sy + sh : sy;
  const pdx = dx * srcW * (west ? -1 : 1);
  const pdy = dy * srcH * (north ? -1 : 1);
  // Proyección del movimiento sobre la diagonal del recorte.
  const dw = (pdx + pdy / aspect) / (1 + 1 / (aspect * aspect));
  const maxW = Math.min(west ? ax : srcW - ax, (north ? ay : srcH - ay) * aspect);
  const minW = Math.min(maxW, Math.max(16, 16 * aspect));
  const w = clamp(sw + dw, minW, maxW);
  const h = w / aspect;
  return {
    x: (west ? ax - w : ax) / srcW,
    y: (north ? ay - h : ay) / srcH,
    w: w / srcW,
    h: h / srcH,
  };
}

export function CropView({ image, recipe }: { image: SourceImage; recipe: Recipe }) {
  const info = image.info!;
  const key = itemKey(image.id, recipe.id);
  const stored = useStore((s) => s.crops[key]);
  const aspect = (recipe.width as number) / (recipe.height as number);
  const committed = fitCrop(stored, info.width, info.height, aspect);

  const [draft, setDraft] = useState<CropRect | null>(null);
  const draftRef = useRef<CropRect | null>(null);
  const crop = draft ?? committed;

  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const measure = () => {
      const w = node.clientWidth - 48;
      const h = node.clientHeight - 48;
      const scale = Math.min(w / info.width, h / info.height);
      setBox({
        w: Math.max(1, Math.floor(info.width * scale)),
        h: Math.max(1, Math.floor(info.height * scale)),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [info.width, info.height]);

  const drag = useRef<{ kind: DragKind; x: number; y: number; start: CropRect } | null>(null);

  const begin = (kind: DragKind) => (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind, x: event.clientX, y: event.clientY, start: crop };
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || !box.w || !box.h) return;
    const dx = (event.clientX - d.x) / box.w;
    const dy = (event.clientY - d.y) / box.h;
    const next =
      d.kind === 'move'
        ? {
            ...d.start,
            x: clamp(d.start.x + dx, 0, 1 - d.start.w),
            y: clamp(d.start.y + dy, 0, 1 - d.start.h),
          }
        : resizeFromCorner(d.start, d.kind, dx, dy, info.width, info.height, aspect);
    draftRef.current = next;
    setDraft(next);
  };

  const end = () => {
    if (drag.current && draftRef.current) setCrop(image.id, recipe.id, draftRef.current);
    drag.current = null;
    draftRef.current = null;
    setDraft(null);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    let next: CropRect | null = null;
    if (event.key === 'ArrowLeft') next = { ...crop, x: clamp(crop.x - step, 0, 1 - crop.w) };
    if (event.key === 'ArrowRight') next = { ...crop, x: clamp(crop.x + step, 0, 1 - crop.w) };
    if (event.key === 'ArrowUp') next = { ...crop, y: clamp(crop.y - step, 0, 1 - crop.h) };
    if (event.key === 'ArrowDown') next = { ...crop, y: clamp(crop.y + step, 0, 1 - crop.h) };
    if (event.key === '+' || event.key === '-') {
      const factor = event.key === '+' ? 1.05 : 0.95;
      const grown = { ...crop, w: crop.w * factor, h: crop.h * factor };
      next = fitCrop(
        { ...grown, x: crop.x + (crop.w - grown.w) / 2, y: crop.y + (crop.h - grown.h) / 2 },
        info.width,
        info.height,
        aspect,
      );
    }
    if (next) {
      event.preventDefault();
      setCrop(image.id, recipe.id, next);
    }
  };

  const layout = computeLayout(info.width, info.height, recipe, crop);
  const rect = {
    left: crop.x * box.w,
    top: crop.y * box.h,
    width: crop.w * box.w,
    height: crop.h * box.h,
  };

  return (
    <div className="crop" ref={stage} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      {box.w > 1 && (
        <div className="crop__frame" style={{ width: box.w, height: box.h }}>
          <img src={image.previewUrl} alt={`Encuadre de ${image.name}`} draggable={false} />
          <svg className="crop__shade" width={box.w} height={box.h} aria-hidden="true">
            <path
              fillRule="evenodd"
              d={`M0 0H${box.w}V${box.h}H0Z M${rect.left} ${rect.top}h${rect.width}v${rect.height}h${-rect.width}Z`}
            />
          </svg>
          <div
            className="crop__box"
            style={rect}
            role="group"
            aria-roledescription="encuadre"
            tabIndex={0}
            aria-label="Encuadre: arrástralo o usa las flechas para moverlo, y + o − para cambiar su tamaño"
            onPointerDown={begin('move')}
            onKeyDown={onKey}
            data-testid="crop-box"
          >
            <span className="crop__thirds" />
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
              <span
                key={corner}
                className="crop__handle"
                data-corner={corner}
                onPointerDown={begin(corner)}
              />
            ))}
            <span className="crop__label tabular">
              {formatDimensions(layout.iw, layout.ih)} px{layout.limited ? ' · resolución real' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
