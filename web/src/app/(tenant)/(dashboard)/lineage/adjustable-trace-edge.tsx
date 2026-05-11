"use client";

import { useCallback, useMemo, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
  useReactFlow,
} from "@xyflow/react";

interface AdjustableTraceEdgeData extends Record<string, unknown> {
  offsetY?: number;
  onOffsetChange?: (edgeId: string, offsetY: number) => void;
}

type AdjustableTraceEdgeShape = Edge<AdjustableTraceEdgeData>;

function clampOffset(offsetY: number) {
  return Math.max(-240, Math.min(240, offsetY));
}

export function AdjustableTraceEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  selected,
  data,
}: EdgeProps<AdjustableTraceEdgeShape>) {
  const { getZoom } = useReactFlow();
  const dragStateRef = useRef<{ startClientY: number; startOffsetY: number } | null>(null);
  const offsetY = data?.offsetY ?? 0;

  const geometry = useMemo(() => {
    const controlX = (sourceX + targetX) / 2;
    const controlY = (sourceY + targetY) / 2 + offsetY;
    const labelX = (sourceX + 2 * controlX + targetX) / 4;
    const labelY = (sourceY + 2 * controlY + targetY) / 4;
    const edgePath = `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`;
    return { controlX, controlY, labelX, labelY, edgePath };
  }, [offsetY, sourceX, sourceY, targetX, targetY]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState || !data?.onOffsetChange) return;
    const zoom = Math.max(getZoom(), 0.01);
    const deltaY = (event.clientY - dragState.startClientY) / zoom;
    data.onOffsetChange(id, clampOffset(dragState.startOffsetY + deltaY));
  }, [data, getZoom, id]);

  const endDrag = useCallback(() => {
    dragStateRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", endDrag);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = { startClientY: event.clientY, startOffsetY: offsetY };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endDrag);
  }, [endDrag, handlePointerMove, offsetY]);

  const handleReset = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    data?.onOffsetChange?.(id, 0);
  }, [data, id]);

  return (
    <>
      <BaseEdge id={id} path={geometry.edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className="trace-edge-handle nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${geometry.labelX}px, ${geometry.labelY}px)`,
            pointerEvents: selected ? "auto" : "none",
            opacity: selected ? 1 : 0,
            transition: "opacity 160ms ease",
          }}
        >
          <div
            className="flex items-center gap-2 rounded-full px-2 py-1 shadow-sm"
            style={{
              background: "color-mix(in srgb, var(--color-card) 92%, white 8%)",
              border: "1px solid var(--color-border)",
            }}
          >
            <button
              type="button"
              aria-label="Adjust trace edge"
              title="Drag to bend this trace line"
              onPointerDown={handlePointerDown}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                background: "var(--color-brand)",
                color: "var(--color-brand-contrast)",
                cursor: "ns-resize",
              }}
            >
              ↕
            </button>
            {offsetY !== 0 ? (
              <button
                type="button"
                aria-label="Reset trace edge"
                title="Reset line bend"
                onClick={handleReset}
                className="rounded-full px-2 py-1 text-[11px] font-medium"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-muted)",
                }}
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
