import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(TEST_DIR, '../../../');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(SRC_ROOT, relativePath), 'utf8');
}

describe('asset inspector guardrails', () => {
  it('removes raw image URL inputs from audited inspectors', () => {
    const cases: Array<{ file: string; forbidden: Array<string | RegExp> }> = [
      {
        file: 'widgets/modules/image-carousel.inspector.tsx',
        forbidden: ['placeholder="https://.../image.jpg"'],
      },
      {
        file: 'widgets/modules/interactive-gallery.inspector.tsx',
        forbidden: ['placeholder="https://.../image.jpg"'],
      },
      {
        file: 'widgets/modules/instagram-story.inspector.tsx',
        forbidden: ['<label>Source URL</label>', '<label>Avatar URL</label>'],
      },
      {
        file: 'widgets/modules/shoppable-sidebar.inspector.tsx',
        forbidden: ['Advanced product data', '<textarea'],
      },
      {
        file: 'widgets/modules/dynamic-map.inspector.tsx',
        forbidden: [
          /heroImage \?\? ''\)\} placeholder="https:\/\/\.\.\."/,
          /logoImage \?\? ''\)\} placeholder="https:\/\/\.\.\."/,
        ],
      },
      {
        file: 'widgets/shape/shape-mask-inspector.tsx',
        forbidden: ['Image source (URL)', 'placeholder="https://.../image.jpg"'],
      },
      {
        file: 'inspector/sections/FillSection.tsx',
        forbidden: [
          "placeholder={acceptsVideoAsset ? 'https://.../video.mp4' : 'https://.../image.jpg'}",
          'placeholder="https://.../poster.jpg"',
        ],
      },
      {
        file: 'widgets/modules/meta-carousel.inspector.tsx',
        forbidden: ['<label>Source URL</label>'],
      },
      {
        file: 'widgets/modules/teads-layout1.inspector.tsx',
        forbidden: ['<label>Source URL</label>'],
      },
      {
        file: 'widgets/modules/teads-layout2.inspector.tsx',
        forbidden: ['<label>Source URL</label>'],
      },
      {
        file: 'widgets/modules/vertical-accordion.inspector.tsx',
        forbidden: [/\[srcKey\]: event\.target\.value, \[assetIdKey\]: ''/],
      },
      {
        file: 'widgets/modules/four-faces.inspector.tsx',
        forbidden: [/\[srcKey\]: event\.target\.value, \[assetIdKey\]: ''/],
      },
      {
        file: 'widgets/modules/interactive-video.inspector.controls.tsx',
        forbidden: ['<label>{label} URL</label>'],
      },
      {
        file: 'widgets/modules/tiktok-video.inspector.tsx',
        forbidden: ['Video URL (MP4)', '<label>{label} URL</label>'],
      },
    ];

    for (const testCase of cases) {
      const source = readSource(testCase.file);
      for (const forbidden of testCase.forbidden) {
        expect(source).not.toMatch(forbidden);
      }
    }
  });
});
