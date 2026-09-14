import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JXG from 'jsxgraph';
import {
  Circle,
  Compass,
  CornerDownRight,
  Download,
  Eye,
  EyeOff,
  Grid3X3,
  Import,
  Link2,
  Maximize2,
  Menu,
  Minus,
  MousePointer2,
  Pentagon,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Slash,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  ANGLE_STEPS,
  emptyDocument,
  nextPointName,
  removeWithDependents,
  rotationAnchorId,
  sampleDocument,
  snapPointToAngle,
  validateDocument,
} from './model.js';

const STORAGE_KEY = 'open-geometry-lab:document:v1';
const COLORS = ['#16718a', '#d6533c', '#7952a8', '#d18a1d', '#287a55', '#343b42'];
const curveTypes = new Set(['segment', 'line', 'circle', 'perpendicular', 'circumcircle']);
const pointTypes = new Set(['point', 'midpoint', 'intersection', 'squareVertex']);

const TOOLS = [
  { id: 'select', label: 'Select and move', icon: MousePointer2 },
  { id: 'point', label: 'Point', icon: Plus },
  { id: 'segment', label: 'Segment', icon: Minus },
  { id: 'line', label: 'Infinite line', icon: Slash },
  { id: 'circle', label: 'Circle by center and point', icon: Circle },
  { id: 'polygon', label: 'Polygon', icon: Pentagon },
  { id: 'square', label: 'Square by side', icon: Square },
  { id: 'midpoint', label: 'Midpoint', icon: Link2 },
  { id: 'perpendicular', label: 'Perpendicular line', icon: CornerDownRight },
  { id: 'intersection', label: 'Intersection point', icon: X },
];

function readInitialDocument() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? validateDocument(JSON.parse(stored)) : sampleDocument();
  } catch {
    return sampleDocument();
  }
}

function useDocumentHistory(initial) {
  const [history, setHistory] = useState({ past: [], present: initial, future: [] });
  const commit = useCallback((update) => {
    setHistory((current) => {
      const next = typeof update === 'function' ? update(current.present) : update;
      if (JSON.stringify(next) === JSON.stringify(current.present)) return current;
      return { past: [...current.past.slice(-49), current.present], present: next, future: [] };
    });
  }, []);
  const undo = useCallback(() => {
    setHistory((current) => {
      if (!current.past.length) return current;
      const previous = current.past.at(-1);
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);
  const redo = useCallback(() => {
    setHistory((current) => {
      if (!current.future.length) return current;
      return {
        past: [...current.past, current.present],
        present: current.future[0],
        future: current.future.slice(1),
      };
    });
  }, []);
  const replace = useCallback((document) => {
    setHistory((current) => ({ past: [...current.past, current.present], present: document, future: [] }));
  }, []);
  return { history, commit, undo, redo, replace };
}

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const { history, commit, undo, redo, replace } = useDocumentHistory(readInitialDocument());
  const construction = history.present;
  const [tool, setTool] = useState('select');
  const [pending, setPending] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [menuOpen, setMenuOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(construction.title);
  const [boardRevision, setBoardRevision] = useState(0);
  const boardRef = useRef(null);
  const gridRef = useRef(null);
  const objectsRef = useRef({});
  const documentRef = useRef(construction);
  const toolRef = useRef(tool);
  const pendingRef = useRef(pending);
  const selectedRef = useRef(selectedId);
  const altPressedRef = useRef(false);
  const handlerRef = useRef(null);
  const importRef = useRef(null);

  documentRef.current = construction;
  toolRef.current = tool;
  pendingRef.current = pending;
  selectedRef.current = selectedId;

  useEffect(() => setTitleDraft(construction.title), [construction.title]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(construction));
  }, [construction]);

  const changeTool = useCallback((nextTool) => {
    setTool(nextTool);
    setPending([]);
    setStatus(nextTool === 'select' ? 'Ready' : `Active tool: ${TOOLS.find((item) => item.id === nextTool)?.label}`);
  }, []);

  const addPairEntity = useCallback(
    (type, pointId, extraEntities = []) => {
      const chosen = pendingRef.current;
      if (!chosen.length) {
        if (extraEntities.length) commit((doc) => ({ ...doc, entities: [...doc.entities, ...extraEntities] }));
        setPending([pointId]);
        setStatus('Choose the second point');
        return;
      }
      if (chosen[0] === pointId) {
        setStatus('Choose a different point');
        return;
      }
      const count = documentRef.current.entities.filter((entity) => entity.type === type).length + 1;
      if (type === 'square') {
        const squareId = crypto.randomUUID();
        const baseEntities = [...documentRef.current.entities, ...extraEntities];
        const endVertex = {
          id: crypto.randomUUID(),
          type: 'squareVertex',
          name: nextPointName(baseEntities),
          pointIds: [chosen[0], pointId],
          corner: 'end',
          ownerId: squareId,
          color: '#d6533c',
        };
        const startVertex = {
          id: crypto.randomUUID(),
          type: 'squareVertex',
          name: nextPointName([...baseEntities, endVertex]),
          pointIds: [chosen[0], pointId],
          corner: 'start',
          ownerId: squareId,
          color: '#d6533c',
        };
        const square = {
          id: squareId,
          type: 'square',
          name: `Q${count}`,
          pointIds: [chosen[0], pointId, endVertex.id, startVertex.id],
          color: '#16718a',
        };
        commit((doc) => ({
          ...doc,
          entities: [...doc.entities, ...extraEntities, endVertex, startVertex, square],
        }));
        setPending([]);
        setSelectedId(square.id);
        setStatus('Square created');
        return;
      }
      const prefixes = { segment: 's', line: 'l', circle: 'c', midpoint: 'M' };
      const entity = {
        id: crypto.randomUUID(),
        type,
        name: type === 'midpoint' ? nextPointName(documentRef.current.entities) : `${prefixes[type]}${count}`,
        pointIds: [chosen[0], pointId],
        color: type === 'midpoint' ? '#d18a1d' : '#16718a',
      };
      commit((doc) => ({ ...doc, entities: [...doc.entities, ...extraEntities, entity] }));
      setPending([]);
      setSelectedId(entity.id);
      setStatus(`${TOOLS.find((item) => item.id === type)?.label ?? 'Element'} created`);
    },
    [commit],
  );

  handlerRef.current = (event) => {
    const board = boardRef.current;
    if (!board) return;
    const entities = documentRef.current.entities;
    const allUnderPointer = board.getAllObjectsUnderMouse(event) ?? [];
    const hitObject = allUnderPointer.find((object) => object.__entityId);
    const hitEntity = hitObject
      ? entities.find((entity) => entity.id === hitObject.__entityId)
      : null;
    const activeTool = toolRef.current;

    if (activeTool === 'select') {
      setSelectedId(hitEntity?.id ?? null);
      setStatus(hitEntity ? `${hitEntity.name || hitEntity.type} selected` : 'Ready');
      return;
    }

    if (activeTool === 'intersection') {
      if (!hitEntity || !curveTypes.has(hitEntity.type)) {
        setStatus('Choose a line or circle');
        return;
      }
      if (!pendingRef.current.length) {
        setPending([hitEntity.id]);
        setStatus('Choose the second line or circle');
        return;
      }
      if (pendingRef.current[0] === hitEntity.id) return;
      const entity = {
        id: crypto.randomUUID(),
        type: 'intersection',
        name: nextPointName(entities),
        objectIds: [pendingRef.current[0], hitEntity.id],
        branch: 0,
        color: '#d6533c',
      };
      commit((doc) => ({ ...doc, entities: [...doc.entities, entity] }));
      setPending([]);
      setSelectedId(entity.id);
      setStatus('Intersection created');
      return;
    }

    if (
      activeTool === 'midpoint'
      && hitEntity
      && ['segment', 'polygon', 'square'].includes(hitEntity.type)
    ) {
      const pointIds = hitObject.__pointIds
        ?? (hitEntity.type === 'segment' ? hitEntity.pointIds : null);
      if (!pointIds) {
        setStatus('Choose a side');
        return;
      }
      const entity = {
        id: crypto.randomUUID(),
        type: 'midpoint',
        name: nextPointName(entities),
        pointIds,
        color: '#d18a1d',
      };
      commit((doc) => ({ ...doc, entities: [...doc.entities, entity] }));
      setPending([]);
      setSelectedId(entity.id);
      setStatus('Midpoint created');
      return;
    }

    if (activeTool === 'perpendicular' && !pendingRef.current.length) {
      if (!hitEntity || !['segment', 'line', 'perpendicular'].includes(hitEntity.type)) {
        setStatus('Choose a line');
        return;
      }
      setPending([hitEntity.id]);
      setStatus('Choose a point');
      return;
    }

    const canReusePoint = hitEntity && pointTypes.has(hitEntity.type);
    const coords = board.getUsrCoordsOfMouse(event);
    const snapped = documentRef.current.settings.snap
      ? coords.map((value) => Math.round(value * 2) / 2)
      : coords;
    const newPoint = canReusePoint
      ? null
      : {
          id: crypto.randomUUID(),
          type: 'point',
          name: nextPointName(entities),
          x: snapped[0],
          y: snapped[1],
          color: '#d6533c',
        };
    const pointId = canReusePoint ? hitEntity.id : newPoint.id;
    const additions = newPoint ? [newPoint] : [];

    if (activeTool === 'point') {
      if (newPoint) commit((doc) => ({ ...doc, entities: [...doc.entities, newPoint] }));
      setSelectedId(pointId);
      setStatus(newPoint ? 'Point created' : `${hitEntity.name} selected`);
      return;
    }

    if (['segment', 'line', 'circle', 'square', 'midpoint'].includes(activeTool)) {
      addPairEntity(activeTool, pointId, additions);
      return;
    }

    if (activeTool === 'polygon') {
      const chosen = pendingRef.current;
      if (chosen.length >= 3 && pointId === chosen[0]) {
        const count = entities.filter((entity) => entity.type === 'polygon').length + 1;
        const polygon = {
          id: crypto.randomUUID(),
          type: 'polygon',
          name: `P${count}`,
          pointIds: chosen,
          color: '#16718a',
        };
        commit((doc) => ({ ...doc, entities: [...doc.entities, polygon] }));
        setPending([]);
        setSelectedId(polygon.id);
        setStatus('Polygon closed');
      } else if (!chosen.includes(pointId)) {
        if (newPoint) commit((doc) => ({ ...doc, entities: [...doc.entities, newPoint] }));
        setPending([...chosen, pointId]);
        setStatus(chosen.length < 2 ? 'Add another vertex' : 'Select the first point to close');
      }
      return;
    }

    if (activeTool === 'perpendicular') {
      const entity = {
        id: crypto.randomUUID(),
        type: 'perpendicular',
        name: `n${entities.filter((item) => item.type === 'perpendicular').length + 1}`,
        lineId: pendingRef.current[0],
        pointId,
        color: '#7952a8',
      };
      commit((doc) => ({ ...doc, entities: [...doc.entities, ...additions, entity] }));
      setPending([]);
      setSelectedId(entity.id);
      setStatus('Perpendicular created');
    }
  };

  useEffect(() => {
    const board = JXG.JSXGraph.initBoard('geometry-board', {
      boundingbox: [-8, 5.5, 8, -5.5],
      axis: true,
      keepAspectRatio: true,
      showCopyright: false,
      showNavigation: false,
      pan: { enabled: true, needShift: true },
      zoom: { enabled: true, wheel: true, pinch: true, factorX: 1.2, factorY: 1.2 },
      defaultAxes: {
        x: { strokeColor: '#9aa3a6', ticks: { strokeColor: '#c8cecf', label: { color: '#677174' } } },
        y: { strokeColor: '#9aa3a6', ticks: { strokeColor: '#c8cecf', label: { color: '#677174' } } },
      },
    });
    boardRef.current = board;
    gridRef.current = board.create('grid', [], {
      strokeColor: '#dce1df',
      strokeOpacity: 0.78,
      majorLineColor: '#c8d0ce',
      majorLineOpacity: 0.8,
      minorElements: 1,
    });
    const onDown = (event) => handlerRef.current?.(event);
    board.on('down', onDown);
    return () => {
      board.off('down', onDown);
      JXG.JSXGraph.freeBoard(board);
      boardRef.current = null;
    };
  }, []);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    board.suspendUpdate();
    for (const object of Object.values(objectsRef.current).reverse()) {
      try {
        board.removeObject(object, true);
      } catch {
        // A parent removal may already remove a dependent JSXGraph object.
      }
    }
    objectsRef.current = {};
    gridRef.current?.setAttribute({ visible: construction.settings.grid });
    const unresolved = [...construction.entities];
    let attempts = unresolved.length + 1;
    while (unresolved.length && attempts > 0) {
      attempts -= 1;
      for (let index = unresolved.length - 1; index >= 0; index -= 1) {
        const entity = unresolved[index];
        const color = entity.color || '#16718a';
        const owner = entity.ownerId
          ? construction.entities.find((item) => item.id === entity.ownerId)
          : null;
        const common = {
          name: construction.settings.labels ? entity.name : '',
          withLabel: construction.settings.labels,
          strokeColor: selectedRef.current === entity.id ? '#d6533c' : color,
          highlightStrokeColor: '#d6533c',
          strokeWidth: selectedRef.current === entity.id ? 3 : 2,
          visible: entity.visible !== false && owner?.visible !== false,
          label: { color: '#23292d', offset: [9, -12], fontSize: 13 },
        };
        const points = entity.pointIds?.map((id) => objectsRef.current[id]);
        let object = null;
        try {
          if (entity.type === 'point') {
            object = board.create('point', [entity.x, entity.y], {
              ...common,
              size: 4,
              face: 'o',
              fillColor: selectedRef.current === entity.id ? '#d6533c' : color,
              highlightFillColor: '#d6533c',
              strokeColor: '#ffffff',
              strokeWidth: 2,
              snapToGrid: construction.settings.snap,
              snapSizeX: 0.5,
              snapSizeY: 0.5,
            });
            let angleLocked = false;
            object.on('drag', (event) => {
              if (!(event?.altKey || altPressedRef.current)) return;
              const anchorId = rotationAnchorId(documentRef.current.entities, entity.id);
              const anchor = anchorId ? objectsRef.current[anchorId] : null;
              if (!anchor) return;
              const next = snapPointToAngle(
                [anchor.X(), anchor.Y()],
                [object.X(), object.Y()],
                documentRef.current.settings.angleStep,
              );
              object.setPosition(JXG.COORDS_BY_USER, next);
              angleLocked = true;
            });
            object.on('up', () => {
              const x = object.X();
              const y = object.Y();
              commit((doc) => ({
                ...doc,
                entities: doc.entities.map((item) =>
                  item.id === entity.id ? { ...item, x, y } : item,
                ),
              }));
              if (angleLocked) {
                setStatus(`Angle locked to ${documentRef.current.settings.angleStep}°`);
                angleLocked = false;
              }
            });
          } else if (entity.type === 'squareVertex' && points?.every(Boolean)) {
            const [start, end] = points;
            const atEnd = entity.corner === 'end';
            object = board.create(
              'point',
              [
                () => (atEnd ? end.X() : start.X()) - (end.Y() - start.Y()),
                () => (atEnd ? end.Y() : start.Y()) + (end.X() - start.X()),
              ],
              {
                ...common,
                size: 3.5,
                fillColor: color,
                fixed: true,
              },
            );
          } else if (entity.type === 'segment' && points?.every(Boolean)) {
            object = board.create('segment', points, common);
          } else if (entity.type === 'line' && points?.every(Boolean)) {
            object = board.create('line', points, common);
          } else if (entity.type === 'circle' && points?.every(Boolean)) {
            object = board.create('circle', points, { ...common, fillOpacity: 0 });
          } else if (['polygon', 'square'].includes(entity.type) && points?.every(Boolean)) {
            object = board.create('polygon', points, {
              ...common,
              fillColor: color,
              fillOpacity: 0.08,
              highlightFillColor: color,
              highlightFillOpacity: 0.14,
              borders: { strokeColor: color, strokeWidth: 2 },
            });
          } else if (entity.type === 'midpoint' && points?.every(Boolean)) {
            object = board.create('midpoint', points, {
              ...common,
              size: 3.5,
              fillColor: color,
              fixed: true,
            });
          } else if (entity.type === 'circumcircle' && points?.every(Boolean)) {
            object = board.create('circumcircle', points, { ...common, fillOpacity: 0 });
          } else if (entity.type === 'perpendicular') {
            const line = objectsRef.current[entity.lineId];
            const point = objectsRef.current[entity.pointId];
            if (line && point) object = board.create('perpendicular', [line, point], common);
          } else if (entity.type === 'intersection') {
            const parents = entity.objectIds.map((id) => objectsRef.current[id]);
            if (parents.every(Boolean)) {
              object = board.create('intersection', [...parents, entity.branch ?? 0], {
                ...common,
                size: 3.5,
                fillColor: color,
                fixed: true,
              });
            }
          }
        } catch {
          object = null;
        }
        if (object) {
          object.__entityId = entity.id;
          object.borders?.forEach((border, borderIndex) => {
            border.__entityId = entity.id;
            border.__pointIds = [
              entity.pointIds[borderIndex],
              entity.pointIds[(borderIndex + 1) % entity.pointIds.length],
            ];
          });
          objectsRef.current[entity.id] = object;
          unresolved.splice(index, 1);
        }
      }
    }
    board.unsuspendUpdate();
    setBoardRevision((revision) => revision + 1);
  }, [construction, commit, selectedId]);

  const removeSelected = useCallback(() => {
    if (!selectedRef.current) return;
    commit((doc) => ({
      ...doc,
      entities: removeWithDependents(doc.entities, selectedRef.current),
    }));
    setSelectedId(null);
    setPending([]);
    setStatus('Element removed');
  }, [commit]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Alt') altPressedRef.current = true;
      const editable = ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
      if (editable) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        removeSelected();
      } else if (event.key === 'Escape') {
        setPending([]);
        setStatus('Ready');
      } else {
        const keys = { v: 'select', p: 'point', s: 'segment', l: 'line', c: 'circle', i: 'intersection' };
        if (keys[event.key.toLowerCase()]) changeTool(keys[event.key.toLowerCase()]);
      }
    };
    const onKeyUp = (event) => {
      if (event.key === 'Alt') altPressedRef.current = false;
    };
    const onBlur = () => {
      altPressedRef.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [changeTool, redo, removeSelected, undo]);

  const selected = construction.entities.find((entity) => entity.id === selectedId);
  const selectedMetric = useMemo(() => {
    const object = selectedId ? objectsRef.current[selectedId] : null;
    if (!object || !selected) return null;
    try {
      if (selected.type === 'segment') return `Length ${object.L().toFixed(3)}`;
      if (['circle', 'circumcircle'].includes(selected.type)) return `Radius ${object.Radius().toFixed(3)}`;
      if (['polygon', 'square'].includes(selected.type)) return `Area ${object.Area().toFixed(3)}`;
      if (pointTypes.has(selected.type)) return `(${object.X().toFixed(3)}, ${object.Y().toFixed(3)})`;
    } catch {
      return null;
    }
    return null;
  }, [boardRevision, construction, selected, selectedId]);

  const commitTitle = () => {
    const title = titleDraft.trim().slice(0, 80) || 'Untitled construction';
    setTitleDraft(title);
    commit((doc) => ({ ...doc, title }));
  };

  const exportJson = () => {
    downloadBlob(
      `${construction.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'construction'}.json`,
      new Blob([`${JSON.stringify(construction, null, 2)}\n`], { type: 'application/json' }),
    );
    setStatus('Construction exported');
  };

  const exportSvg = () => {
    const svg = boardRef.current?.renderer?.svgRoot;
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    downloadBlob('geometry.svg', new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    setStatus('SVG exported');
  };

  const importJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || file.size > 1_000_000) {
      if (file) setStatus('File is too large');
      return;
    }
    try {
      const document = validateDocument(JSON.parse(await file.text()));
      replace(document);
      setSelectedId(null);
      setPending([]);
      setStatus('Construction imported');
    } catch {
      setStatus('Could not import this construction');
    }
  };

  const setSetting = (key) => {
    commit((doc) => ({ ...doc, settings: { ...doc.settings, [key]: !doc.settings[key] } }));
  };

  const setAngleStep = (angleStep) => {
    commit((doc) => ({ ...doc, settings: { ...doc.settings, angleStep } }));
  };

  const toggleVisibility = (id) => {
    const entity = documentRef.current.entities.find((item) => item.id === id);
    commit((doc) => ({
      ...doc,
      entities: doc.entities.map((entity) =>
        entity.id === id ? { ...entity, visible: entity.visible === false } : entity,
      ),
    }));
    setStatus(entity?.visible === false ? 'Object shown' : 'Object hidden');
  };

  const updateSelected = (changes) => {
    commit((doc) => ({
      ...doc,
      entities: doc.entities.map((entity) =>
        entity.id === selectedId ? { ...entity, ...changes } : entity,
      ),
    }));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Open Geometry Lab">
          <span className="brand-mark"><Compass size={19} /></span>
          <span>Open Geometry Lab</span>
        </div>
        <input
          className="document-title"
          aria-label="Construction title"
          value={titleDraft}
          maxLength={80}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />
        <div className="top-actions">
          <button className="icon-button" title="Undo" aria-label="Undo" disabled={!history.past.length} onClick={undo}><Undo2 size={18} /></button>
          <button className="icon-button" title="Redo" aria-label="Redo" disabled={!history.future.length} onClick={redo}><Redo2 size={18} /></button>
          <span className="divider" />
          <button className="icon-button" title="Save in this browser" aria-label="Save in this browser" onClick={() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(construction)); setStatus('Saved in this browser'); }}><Save size={18} /></button>
          <div className="menu-wrap">
            <button className="icon-button" title="File menu" aria-label="File menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><Menu size={19} /></button>
            {menuOpen && (
              <div className="file-menu">
                <button onClick={() => { replace(emptyDocument()); setSelectedId(null); setMenuOpen(false); setStatus('Blank construction'); }}><Plus size={16} /> New</button>
                <button onClick={() => { replace(sampleDocument()); setSelectedId(null); setMenuOpen(false); setStatus('Sample loaded'); }}><Sparkles size={16} /> Load sample</button>
                <button onClick={() => { importRef.current?.click(); setMenuOpen(false); }}><Import size={16} /> Import JSON</button>
                <button onClick={() => { exportJson(); setMenuOpen(false); }}><Download size={16} /> Export JSON</button>
                <button onClick={() => { exportSvg(); setMenuOpen(false); }}><Maximize2 size={16} /> Export SVG</button>
              </div>
            )}
          </div>
          <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importJson} />
        </div>
      </header>

      <section className="workspace">
        <nav className="tool-rail" aria-label="Geometry tools">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`tool-button ${tool === id ? 'active' : ''}`} title={label} aria-label={label} aria-pressed={tool === id} onClick={() => changeTool(id)}><Icon size={20} /></button>
          ))}
          <span className="rail-divider" />
          <button className="tool-button danger" title="Delete selected" aria-label="Delete selected" disabled={!selectedId} onClick={removeSelected}><Trash2 size={19} /></button>
        </nav>

        <section className="canvas-area" aria-label="Geometry canvas">
          <div id="geometry-board" className="jxgbox" />
          <div className="canvas-controls">
            <button className="icon-button" title="Zoom out" aria-label="Zoom out" onClick={() => boardRef.current?.zoomOut()}><Minus size={17} /></button>
            <button className="icon-button" title="Reset view" aria-label="Reset view" onClick={() => boardRef.current?.setBoundingBox([-8, 5.5, 8, -5.5], true)}><RotateCcw size={16} /></button>
            <button className="icon-button" title="Zoom in" aria-label="Zoom in" onClick={() => boardRef.current?.zoomIn()}><Plus size={17} /></button>
          </div>
          <div className="statusbar" aria-live="polite">
            <span className="status-dot" />
            <span>{status}</span>
            {pending.length > 0 && <span className="selection-count">{pending.length} selected</span>}
          </div>
        </section>

        <aside className="inspector">
          <section className="inspector-section">
            <div className="section-heading"><span>View</span><Grid3X3 size={15} /></div>
            <label className="switch-row"><span>Grid</span><input type="checkbox" checked={construction.settings.grid} onChange={() => setSetting('grid')} /></label>
            <label className="switch-row"><span>Snap to 0.5</span><input type="checkbox" checked={construction.settings.snap} onChange={() => setSetting('snap')} /></label>
            <label className="switch-row"><span>Labels</span><input type="checkbox" checked={construction.settings.labels} onChange={() => setSetting('labels')} /></label>
            <label className="select-row">
              <span>Alt angle</span>
              <select value={construction.settings.angleStep} onChange={(event) => setAngleStep(Number(event.target.value))}>
                {ANGLE_STEPS.map((step) => <option key={step} value={step}>{step}°</option>)}
              </select>
            </label>
          </section>

          <section className="inspector-section properties">
            <div className="section-heading"><span>Selection</span><span className="element-type">{selected?.type ?? 'None'}</span></div>
            {selected ? (
              <>
                <label className="field-label" htmlFor="element-name">Label</label>
                <input id="element-name" className="field-input" value={selected.name} maxLength={32} onChange={(event) => updateSelected({ name: event.target.value })} />
                {selectedMetric && <output className="measurement">{selectedMetric}</output>}
                <label className="switch-row selection-visibility"><span>Visible</span><input type="checkbox" checked={selected.visible !== false} onChange={() => toggleVisibility(selected.id)} /></label>
                <span className="field-label">Color</span>
                <div className="swatches" aria-label="Element color">
                  {COLORS.map((color) => (
                    <button key={color} className={`swatch ${selected.color === color ? 'chosen' : ''}`} style={{ '--swatch': color }} title={`Set color ${color}`} aria-label={`Set color ${color}`} onClick={() => updateSelected({ color })} />
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-selection"><MousePointer2 size={21} /><span>Select an element</span></div>
            )}
          </section>

          <section className="inspector-section construction-list">
            <div className="section-heading"><span>Construction</span><span>{construction.entities.length}</span></div>
            <div className="entity-list">
              {construction.entities.map((entity) => (
                <div key={entity.id} className={`entity-row ${selectedId === entity.id ? 'selected' : ''} ${entity.visible === false ? 'hidden' : ''}`}>
                  <button className="entity-select" onClick={() => { setSelectedId(entity.id); changeTool('select'); }}>
                    <span className="entity-color" style={{ '--entity-color': entity.color }} />
                    <span className="entity-name">{entity.name || 'Unnamed'}</span>
                    <span className="entity-kind">{entity.type === 'squareVertex' ? 'square vertex' : entity.type}</span>
                  </button>
                  <button className="visibility-button" title={entity.visible === false ? 'Show object' : 'Hide object'} aria-label={`${entity.visible === false ? 'Show' : 'Hide'} ${entity.name || entity.type}`} onClick={() => toggleVisibility(entity.id)}>
                    {entity.visible === false ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              ))}
              {!construction.entities.length && <div className="empty-list">Empty construction</div>}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default App;
