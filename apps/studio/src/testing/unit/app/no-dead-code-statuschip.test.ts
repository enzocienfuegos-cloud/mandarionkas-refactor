import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('S64 dead topbar status code removal', () => {
  it('removes TopBarStatus.tsx', () => {
    expect(existsSync(join(process.cwd(), 'src/app/shell/topbar/TopBarStatus.tsx'))).toBe(false);
  });

  it('removes StatusChip.tsx', () => {
    expect(existsSync(join(process.cwd(), 'src/app/shell/StatusChip.tsx'))).toBe(false);
  });
});
