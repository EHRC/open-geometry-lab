import { describe, expect, it } from 'vitest';
import {
  emptyDocument,
  nextPointName,
  removeWithDependents,
  sampleDocument,
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
});
