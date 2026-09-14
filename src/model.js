export const DOCUMENT_VERSION = 1;
export const ANGLE_STEPS = [15, 30, 45, 90];

const allowedTypes = new Set([
  'point',
  'segment',
  'line',
  'circle',
  'polygon',
  'midpoint',
  'perpendicular',
  'intersection',
  'circumcircle',
  'squareVertex',
  'square',
]);

export const emptyDocument = () => ({
  version: DOCUMENT_VERSION,
  title: 'Untitled construction',
  entities: [],
  settings: { grid: true, snap: false, snapPoints: true, labels: true, angleStep: 15 },
});

export const sampleDocument = () => ({
  version: DOCUMENT_VERSION,
  title: 'Triangle study',
  settings: { grid: true, snap: false, snapPoints: true, labels: true, angleStep: 15 },
  entities: [
    { id: 'p-a', type: 'point', name: 'A', x: -3.4, y: -2.1, color: '#d6533c' },
    { id: 'p-b', type: 'point', name: 'B', x: 3.1, y: -2.1, color: '#d6533c' },
    { id: 'p-c', type: 'point', name: 'C', x: 0.1, y: 3.15, color: '#d6533c' },
    {
      id: 'poly-1',
      type: 'polygon',
      name: '△ABC',
      pointIds: ['p-a', 'p-b', 'p-c'],
      color: '#16718a',
    },
    {
      id: 'circum-1',
      type: 'circumcircle',
      name: 'c₁',
      pointIds: ['p-a', 'p-b', 'p-c'],
      color: '#7952a8',
    },
    {
      id: 'mid-1',
      type: 'midpoint',
      name: 'M',
      pointIds: ['p-a', 'p-b'],
      color: '#d18a1d',
    },
  ],
});

export function dependencyIds(entity) {
  if (entity.pointIds) return [...entity.pointIds, entity.ownerId].filter(Boolean);
  if (entity.objectIds) return entity.objectIds;
  if (entity.lineId || entity.pointId) return [entity.lineId, entity.pointId].filter(Boolean);
  return [];
}

export function removeWithDependents(entities, rootId) {
  const removed = dependentIds(entities, rootId);
  return entities.filter((entity) => !removed.has(entity.id));
}

export function dependentIds(entities, rootId) {
  const removed = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of entities) {
      if (!removed.has(entity.id) && dependencyIds(entity).some((id) => removed.has(id))) {
        removed.add(entity.id);
        changed = true;
      }
    }
  }
  return removed;
}

export function nextPointName(entities) {
  const used = new Set(entities.map((entity) => entity.name));
  for (let index = 0; index < 26; index += 1) {
    const candidate = String.fromCharCode(65 + index);
    if (!used.has(candidate)) return candidate;
  }
  return `P${entities.filter((entity) => entity.type === 'point').length + 1}`;
}

export function snapPointToAngle(anchor, point, stepDegrees) {
  const dx = point[0] - anchor[0];
  const dy = point[1] - anchor[1];
  const radius = Math.hypot(dx, dy);
  if (!radius || !ANGLE_STEPS.includes(stepDegrees)) return point;
  const step = (stepDegrees * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return [anchor[0] + radius * Math.cos(angle), anchor[1] + radius * Math.sin(angle)];
}

export function nearestPointId(points, target, tolerance, excludeIds = null) {
  const excluded = new Set(
    Array.isArray(excludeIds) || excludeIds instanceof Set
      ? excludeIds
      : [excludeIds].filter(Boolean),
  );
  let nearest = null;
  let nearestDistance = tolerance;
  for (const point of points) {
    if (excluded.has(point.id)) continue;
    const distance = Math.hypot(point.x - target[0], point.y - target[1]);
    if (distance <= nearestDistance) {
      nearest = point.id;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function rotationAnchorId(entities, pointId) {
  for (let index = entities.length - 1; index >= 0; index -= 1) {
    const entity = entities[index];
    const points = entity.pointIds ?? [];
    const pointIndex = points.indexOf(pointId);
    if (pointIndex < 0) continue;
    if (entity.type === 'circle' && pointIndex === 1) return points[0];
    if (['square', 'segment', 'line'].includes(entity.type) && pointIndex < 2) {
      return points[pointIndex === 0 ? 1 : 0];
    }
    if (entity.type === 'polygon' && points.length > 1) {
      return points[(pointIndex - 1 + points.length) % points.length];
    }
  }
  return null;
}

export function validateDocument(value) {
  if (!value || value.version !== DOCUMENT_VERSION || !Array.isArray(value.entities)) {
    throw new Error('Unsupported construction file');
  }
  if (typeof value.title !== 'string' || value.title.length < 1 || value.title.length > 80) {
    throw new Error('Invalid construction title');
  }
  if (!value.settings || ['grid', 'snap', 'labels'].some((key) => typeof value.settings[key] !== 'boolean')) {
    throw new Error('Invalid construction settings');
  }
  if (value.settings.snapPoints !== undefined && typeof value.settings.snapPoints !== 'boolean') {
    throw new Error('Invalid point snapping setting');
  }
  const ids = new Set();
  for (const entity of value.entities) {
    if (!entity || typeof entity.id !== 'string' || ids.has(entity.id) || !allowedTypes.has(entity.type)) {
      throw new Error('Invalid or duplicate geometry element');
    }
    if (typeof entity.name !== 'string' || entity.name.length > 32) {
      throw new Error('Invalid geometry label');
    }
    if (entity.visible !== undefined && typeof entity.visible !== 'boolean') {
      throw new Error('Invalid element visibility');
    }
    if (entity.type === 'point' && (![entity.x, entity.y].every(Number.isFinite))) {
      throw new Error('Invalid point coordinates');
    }
    if (entity.type === 'squareVertex' && !['end', 'start'].includes(entity.corner)) {
      throw new Error('Invalid square vertex');
    }
    ids.add(entity.id);
  }
  for (const entity of value.entities) {
    if (dependencyIds(entity).some((id) => !ids.has(id))) {
      throw new Error('Construction contains a missing dependency');
    }
  }
  const document = structuredClone(value);
  document.settings.angleStep = ANGLE_STEPS.includes(value.settings.angleStep)
    ? value.settings.angleStep
    : 15;
  document.settings.snapPoints = value.settings.snapPoints !== false;
  return document;
}
