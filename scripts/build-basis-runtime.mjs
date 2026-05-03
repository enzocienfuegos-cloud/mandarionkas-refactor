import { readFile, writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const runtimePath = new URL('../packages/contracts/src/basis-runtime.mjs', import.meta.url);
const snippetsPath = new URL('../packages/contracts/src/tag-snippets.mjs', import.meta.url);
const startMarker = '// BEGIN BASIS_NATIVE_BLOB';
const endMarker = '// END BASIS_NATIVE_BLOB';

const runtimeSource = await readFile(runtimePath, 'utf8');
const snippetsSource = await readFile(snippetsPath, 'utf8');

const { code } = await transform(runtimeSource, {
  loader: 'js',
  minify: true,
  format: 'esm',
  target: 'es2018',
});

const minified = code.trim().replace(/;$/, '');
const escaped = minified
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const startIndex = snippetsSource.indexOf(startMarker);
const endIndex = snippetsSource.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
  throw new Error('Failed to locate BASIS_NATIVE_BLOB markers in tag-snippets.mjs');
}

const replacement = `${startMarker}
const BASIS_NATIVE_BLOB = \`${escaped}\`;
${endMarker}`;

const updated = `${snippetsSource.slice(0, startIndex)}${replacement}${snippetsSource.slice(endIndex + endMarker.length)}`;

if (updated === snippetsSource) {
  throw new Error('Failed to update BASIS_NATIVE_BLOB in tag-snippets.mjs');
}

await writeFile(snippetsPath, updated);
console.log('Updated BASIS_NATIVE_BLOB from basis-runtime.mjs');
