import test from 'node:test';
import assert from 'node:assert/strict';

import { pickWeightedCreativeRow } from './routes.mjs';

test('pickWeightedCreativeRow ignores rows without public_url', () => {
  const row = pickWeightedCreativeRow([
    { binding_id: 'a', weight: 10, public_url: '' },
    { binding_id: 'b', weight: 5, public_url: 'https://cdn.example.com/b.html' },
  ], () => 0.25);

  assert.equal(row?.binding_id, 'b');
});

test('pickWeightedCreativeRow selects the only valid candidate', () => {
  const row = pickWeightedCreativeRow([
    { binding_id: 'a', weight: 1, public_url: 'https://cdn.example.com/a.html' },
  ], () => 0.99);

  assert.equal(row?.binding_id, 'a');
});

test('pickWeightedCreativeRow distributes by weight bands', () => {
  const rows = [
    { binding_id: 'a', weight: 80, public_url: 'https://cdn.example.com/a.html' },
    { binding_id: 'b', weight: 20, public_url: 'https://cdn.example.com/b.html' },
  ];

  assert.equal(pickWeightedCreativeRow(rows, () => 0.00)?.binding_id, 'a');
  assert.equal(pickWeightedCreativeRow(rows, () => 0.79)?.binding_id, 'a');
  assert.equal(pickWeightedCreativeRow(rows, () => 0.80)?.binding_id, 'b');
  assert.equal(pickWeightedCreativeRow(rows, () => 0.99)?.binding_id, 'b');
});

test('pickWeightedCreativeRow treats invalid weights as 1', () => {
  const rows = [
    { binding_id: 'a', weight: 0, public_url: 'https://cdn.example.com/a.html' },
    { binding_id: 'b', weight: null, public_url: 'https://cdn.example.com/b.html' },
  ];

  assert.equal(pickWeightedCreativeRow(rows, () => 0.10)?.binding_id, 'a');
  assert.equal(pickWeightedCreativeRow(rows, () => 0.90)?.binding_id, 'b');
});
