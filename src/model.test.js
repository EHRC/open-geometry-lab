import { describe, expect, it } from 'vitest';
import {
  emptyDocument,
  nextPointName,
  removeWithDependents,
  rotationAnchorId,
  sampleDocument,
  snapPointToAngle,
  validateDocument,
} from './model.js';

describe('construction model', () => {
  it('validates the sample and an empty document', () => {
    expect(validateDocument(sampleDocument()).entities).toHaveLength(6);
    expect(validateDocument(emptyDocument()).entities).toHaveLength(0);
  });

  it('rejects missing dependencies and duplicate ids', () => {
    const missing = sampleDocument();
    missing.entities[3].pointIds[0] = 'missing';
    expect(() => validateDocument(missing)).toThrow(/missing dependency/);
    const duplicate = sampleDocument();
    duplicate.entities[1].id = duplicate.entities[0].id;
    expect(() => validateDocument(duplicate)).toThrow(/duplicate/);
  });

  it('removes dependent constructions transitively', () => {
    const entities = sampleDocument().entities;
    const remaining = removeWithDependents(entities, 'p-a');
    expect(remaining.map((entity) => entity.id)).toEqual(['p-b', 'p-c']);
  });

  it('generates readable point labels', () => {
    expect(nextPointName([])).toBe('A');
    expect(nextPointName([{ name: 'A' }, { name: 'C' }])).toBe('B');
  });

  it('normalizes legacy documents with the default angle step', () => {
    const legacy = sampleDocument();
    delete legacy.settings.angleStep;
    expect(validateDocument(legacy).settings.angleStep).toBe(15);
  });

  it('snaps rotation to the selected angular increment', () => {
    const snapped = snapPointToAngle([0, 0], [2, 1.8], 45);
    expect(snapped[0]).toBeCloseTo(snapped[1]);
    expect(Math.hypot(...snapped)).toBeCloseTo(Math.hypot(2, 1.8));
  });

  it('finds the opposite endpoint as a rotation anchor', () => {
    const entities = [
      { id: 'a', type: 'point', name: 'A' },
      { id: 'b', type: 'point', name: 'B' },
      { id: 's', type: 'square', name: 'Q1', pointIds: ['a', 'b', 'c', 'd'] },
    ];
    expect(rotationAnchorId(entities, 'b')).toBe('a');
  });

  it('removes a square together with its calculated vertices', () => {
    const entities = [
      { id: 'a', type: 'point', name: 'A' },
      { id: 'b', type: 'point', name: 'B' },
      { id: 'c', type: 'squareVertex', name: 'C', pointIds: ['a', 'b'], ownerId: 'q' },
      { id: 'd', type: 'squareVertex', name: 'D', pointIds: ['a', 'b'], ownerId: 'q' },
      { id: 'q', type: 'square', name: 'Q1', pointIds: ['a', 'b', 'c', 'd'] },
    ];
    expect(removeWithDependents(entities, 'q').map((entity) => entity.id)).toEqual(['a', 'b']);
  });
});
