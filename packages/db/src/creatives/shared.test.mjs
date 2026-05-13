import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeRawClickUrl } from './shared.mjs';

test('normalizeRawClickUrl repairs single-slash http schemes', () => {
  assert.equal(
    normalizeRawClickUrl('https:/www.roblox.com/games/134720376226601/The-World-of-Bocadeli-Flavor'),
    'https://www.roblox.com/games/134720376226601/The-World-of-Bocadeli-Flavor',
  );
});

test('normalizeRawClickUrl extracts and repairs tracked destination URLs', () => {
  assert.equal(
    normalizeRawClickUrl('https://api.example.com/v1/tags/tracker/tag-1/click?url=https%3A%2Fwww.roblox.com%2Fgames%2F1'),
    'https://www.roblox.com/games/1',
  );
});
