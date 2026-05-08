import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { LeftRailController } from './use-left-rail-controller';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';

const NODE_WIDTH = 188;
const NODE_HEIGHT = 114;
const HORIZONTAL_GAP = 224;
const VERTICAL_GAP = 152;
const CANVAS_PADDING = 24;

type FlowPoint = { x: number; y: number };

type FlowEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  tone: 'primary' | 'branch';
};

function getFallbackPosition(index: number): FlowPoint {
  return {
    x: CANVAS_PADDING + index * HORIZONTAL_GAP,
    y: CANVAS_PADDING + (index % 2) * VERTICAL_GAP,
  };
}

function clampPosition(point: FlowPoint): FlowPoint {
  return {
    x: Math.max(CANVAS_PADDING, Math.round(point.x)),
    y: Math.max(CANVAS_PADDING, Math.round(point.y)),
  };
}

function buildEdgePath(from: FlowPoint, to: FlowPoint): string {
  const startX = from.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + NODE_HEIGHT / 2;
  const controlOffset = Math.max(56, Math.abs(endX - startX) * 0.42);
  return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
}

export function StoryFlowCanvas({ controller }: { controller: LeftRailController }): JSX.Element {
  const { scenes, activeSceneId, sceneActions } = controller;
  const [positions, setPositions] = useState<Record<string, FlowPoint>>({});
  const dragRef = useRef<{
    pointerId: number;
    sceneId: string;
    startX: number;
    startY: number;
    origin: FlowPoint;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setPositions((current) => {
      const next: Record<string, FlowPoint> = {};
      scenes.forEach((scene, index) => {
        next[scene.id] = current[scene.id]
          ?? (scene.flow?.canvas ? clampPosition(scene.flow.canvas) : getFallbackPosition(index));
      });
      return next;
    });
  }, [scenes]);

  const sceneMap = useMemo(
    () => new Map(scenes.map((scene) => [scene.id, scene])),
    [scenes],
  );

  const edges = useMemo<FlowEdge[]>(() => {
    const nextEdges = scenes.flatMap((scene) => (
      scene.flow?.nextSceneId && sceneMap.has(scene.flow.nextSceneId)
        ? [{
            id: `${scene.id}-next-${scene.flow.nextSceneId}`,
            from: scene.id,
            to: scene.flow.nextSceneId,
            label: 'Next',
            tone: 'primary' as const,
          }]
        : []
    ));

    const branchEdges = scenes.flatMap((scene) => {
      const branches = scene.flow?.branches ?? (scene.flow?.branchEquals ? [scene.flow.branchEquals] : []);
      return branches
        .filter((branch) => sceneMap.has(branch.targetSceneId))
        .map((branch, index) => ({
          id: `${scene.id}-branch-${branch.targetSceneId}-${index}`,
          from: scene.id,
          to: branch.targetSceneId,
          label: branch.label || branch.field,
          tone: 'branch' as const,
        }));
    });

    return [...nextEdges, ...branchEdges];
  }, [sceneMap, scenes]);

  const canvasSize = useMemo(() => {
    const points = scenes.map((scene, index) => positions[scene.id] ?? getFallbackPosition(index));
    const maxX = points.length ? Math.max(...points.map((point) => point.x + NODE_WIDTH)) : NODE_WIDTH;
    const maxY = points.length ? Math.max(...points.map((point) => point.y + NODE_HEIGHT)) : NODE_HEIGHT;
    return {
      width: maxX + CANVAS_PADDING,
      height: maxY + CANVAS_PADDING,
    };
  }, [positions, scenes]);

  function persistScenePosition(sceneId: string, point: FlowPoint): void {
    const scene = sceneMap.get(sceneId);
    if (!scene) return;
    const nextPoint = clampPosition(point);
    sceneActions.updateScene(sceneId, {
      flow: {
        ...scene.flow,
        canvas: nextPoint,
      },
    });
  }

  function handleNodePointerDown(sceneId: string, event: ReactPointerEvent<HTMLDivElement>): void {
    if (!event.isPrimary) return;
    const origin = positions[sceneId] ?? getFallbackPosition(scenes.findIndex((scene) => scene.id === sceneId));
    dragRef.current = {
      pointerId: event.pointerId,
      sceneId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleNodePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const nextPoint = clampPosition({
      x: dragState.origin.x + (event.clientX - dragState.startX),
      y: dragState.origin.y + (event.clientY - dragState.startY),
    });
    dragState.moved = dragState.moved
      || Math.abs(event.clientX - dragState.startX) > 3
      || Math.abs(event.clientY - dragState.startY) > 3;
    setPositions((current) => ({ ...current, [dragState.sceneId]: nextPoint }));
  }

  function handleNodePointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const point = clampPosition({
      x: dragState.origin.x + (event.clientX - dragState.startX),
      y: dragState.origin.y + (event.clientY - dragState.startY),
    });
    setPositions((current) => ({ ...current, [dragState.sceneId]: point }));
    persistScenePosition(dragState.sceneId, point);
    if (!dragState.moved) {
      sceneActions.selectScene(dragState.sceneId);
    }
  }

  function handleNodePointerCancel(event: ReactPointerEvent<HTMLDivElement>): void {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setPositions((current) => ({ ...current, [dragState.sceneId]: dragState.origin }));
  }

  function handleNodeKeyDown(sceneId: string, event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      sceneActions.selectScene(sceneId);
    }
  }

  return (
    <div className="story-flow-canvas-shell">
      <div className="story-flow-canvas-hint">
        <StudioIcon icon={StudioIcons.workflow} size={14} />
        Drag scenes to arrange the journey. Double click or press Enter to focus a scene.
      </div>
      <div className="story-flow-canvas-scroll">
        <div className="story-flow-canvas" style={{ width: canvasSize.width, height: canvasSize.height }}>
          <svg
            className="story-flow-canvas__edges"
            width={canvasSize.width}
            height={canvasSize.height}
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
            aria-hidden="true"
          >
            {edges.map((edge) => {
              const from = positions[edge.from];
              const to = positions[edge.to];
              if (!from || !to) return null;
              const labelX = (from.x + NODE_WIDTH + to.x) / 2;
              const labelY = (from.y + to.y + NODE_HEIGHT) / 2;
              return (
                <g key={edge.id} className={`story-flow-edge story-flow-edge--${edge.tone}`}>
                  <path d={buildEdgePath(from, to)} />
                  <text x={labelX} y={labelY}>
                    {edge.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {scenes.map((scene, index) => {
            const point = positions[scene.id] ?? getFallbackPosition(index);
            const branches = scene.flow?.branches ?? (scene.flow?.branchEquals ? [scene.flow.branchEquals] : []);
            const nextLabel = scene.flow?.nextSceneId
              ? sceneMap.get(scene.flow.nextSceneId)?.name ?? 'Unknown'
              : 'Auto / End';
            const isActive = scene.id === activeSceneId;

            return (
              <div
                key={scene.id}
                role="button"
                tabIndex={0}
                className={`story-flow-node ${isActive ? 'is-active' : ''}`}
                style={{ left: point.x, top: point.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
                onPointerDown={(event) => handleNodePointerDown(scene.id, event)}
                onPointerMove={handleNodePointerMove}
                onPointerUp={handleNodePointerUp}
                onPointerCancel={handleNodePointerCancel}
                onDoubleClick={() => sceneActions.selectScene(scene.id)}
                onKeyDown={(event) => handleNodeKeyDown(scene.id, event)}
              >
                <div className="story-flow-node__header">
                  <strong>{scene.name}</strong>
                  <span className="pill">{scene.durationMs}ms</span>
                </div>
                <div className="story-flow-node__meta">
                  <span className="story-flow-node__step">
                    Scene {index + 1}
                  </span>
                  <span className="story-flow-node__next">Next: {nextLabel}</span>
                </div>
                {branches.length ? (
                  <div className="story-flow-node__branches">
                    {branches.slice(0, 2).map((branch, branchIndex) => (
                      <span key={`${scene.id}-branch-pill-${branchIndex}`} className="story-flow-node__branch-pill">
                        {branch.label || branch.field}
                      </span>
                    ))}
                    {branches.length > 2 ? <span className="story-flow-node__branch-pill">+{branches.length - 2}</span> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
