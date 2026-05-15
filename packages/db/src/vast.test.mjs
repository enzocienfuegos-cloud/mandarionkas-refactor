import test from 'node:test';
import assert from 'node:assert/strict';

import { pickWeightedVastBinding } from './vast.mjs';

test('pickWeightedVastBinding selects active bindings by weight bands', () => {
  const rows = [
    { id: 'a', status: 'active', weight: 80 },
    { id: 'b', status: 'active', weight: 20 },
  ];

  assert.equal(pickWeightedVastBinding(rows, () => 0.00)?.id, 'a');
  assert.equal(pickWeightedVastBinding(rows, () => 0.79)?.id, 'a');
  assert.equal(pickWeightedVastBinding(rows, () => 0.80)?.id, 'b');
  assert.equal(pickWeightedVastBinding(rows, () => 0.99)?.id, 'b');
});

test('pickWeightedVastBinding ignores inactive bindings', () => {
  const rows = [
    { id: 'a', status: 'paused', weight: 99 },
    { id: 'b', status: 'active', weight: 1 },
  ];

  assert.equal(pickWeightedVastBinding(rows, () => 0.10)?.id, 'b');
});

test('pickWeightedVastBinding treats missing or invalid weights as one', () => {
  const rows = [
    { id: 'a', status: 'active', weight: 0 },
    { id: 'b', status: 'active', weight: null },
  ];

  assert.equal(pickWeightedVastBinding(rows, () => 0.10)?.id, 'a');
  assert.equal(pickWeightedVastBinding(rows, () => 0.90)?.id, 'b');
});
