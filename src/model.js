export const DOCUMENT_VERSION = 1;

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
]);

export const emptyDocument = () => ({
  version: DOCUMENT_VERSION,
  title: 'Untitled construction',
  entities: [],
  settings: { grid: true, snap: false, labels: true },
});

export const sampleDocument = () => ({
  version: DOCUMENT_VERSION,
  title: 'Triangle study',
  settings: { grid: true, snap: false, labels: true },
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
  if (entity.pointIds) return entity.pointIds;
  if (entity.objectIds) return entity.objectIds;
  if (entity.lineId || entity.pointId) return [entity.lineId, entity.pointId].filter(Boolean);
  return [];
}

export function removeWithDependents(entities, rootId) {
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
  return entities.filter((entity) => !removed.has(entity.id));
}

export function nextPointName(entities) {
  const used = new Set(entities.map((entity) => entity.name));
  for (let index = 0; index < 26; index += 1) {
    const candidate = String.fromCharCode(65 + index);
    if (!used.has(candidate)) return candidate;
  }
  return `P${entities.filter((entity) => entity.type === 'point').length + 1}`;
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
  const ids = new Set();
  for (const entity of value.entities) {
    if (!entity || typeof entity.id !== 'string' || ids.has(entity.id) || !allowedTypes.has(entity.type)) {
      throw new Error('Invalid or duplicate geometry element');
    }
    if (typeof entity.name !== 'string' || entity.name.length > 32) {
      throw new Error('Invalid geometry label');
    }
    if (entity.type === 'point' && (![entity.x, entity.y].every(Number.isFinite))) {
      throw new Error('Invalid point coordinates');
    }
    ids.add(entity.id);
  }
  for (const entity of value.entities) {
    if (dependencyIds(entity).some((id) => !ids.has(id))) {
      throw new Error('Construction contains a missing dependency');
    }
  }
  return structuredClone(value);
}
