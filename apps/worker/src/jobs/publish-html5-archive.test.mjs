import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeArchiveMemberPath,
  stripCommonArchiveRoot,
} from './publish-html5-archive.mjs';

test('normalizeArchiveMemberPath rejects traversal and macOS junk', () => {
  assert.equal(normalizeArchiveMemberPath('../index.html'), null);
  assert.equal(normalizeArchiveMemberPath('/../../evil.js'), null);
  assert.equal(normalizeArchiveMemberPath('__MACOSX/._index.html'), null);
  assert.equal(normalizeArchiveMemberPath('.DS_Store'), null);
});

test('normalizeArchiveMemberPath normalizes slashes and leading separators', () => {
  assert.equal(normalizeArchiveMemberPath('/folder\\index.html'), 'folder/index.html');
  assert.equal(normalizeArchiveMemberPath('index.html'), 'index.html');
});

test('stripCommonArchiveRoot collapses a single top-level wrapper folder', () => {
  assert.deepEqual(
    stripCommonArchiveRoot([
      'creative/index.html',
      'creative/assets/app.js',
      'creative/assets/style.css',
    ]),
    [
      'index.html',
      'assets/app.js',
      'assets/style.css',
    ],
  );
});

test('stripCommonArchiveRoot preserves paths when archive already has files at root', () => {
  assert.deepEqual(
    stripCommonArchiveRoot([
      'index.html',
      'assets/app.js',
    ]),
    [
      'index.html',
      'assets/app.js',
    ],
  );
});
