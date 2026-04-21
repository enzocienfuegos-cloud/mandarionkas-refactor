/**
 * packages/db/__tests__/pacing.test.mjs
 *
 * Unit tests for the pacing computation logic.
 * No DB connection required — pure functions only.
 *
 * computePacing(campaign, servedTotal, today?) returns:
 *   { servedTotal, impressionGoal, totalDays, elapsedDays, remainingDays,
 *     expectedByNow, pacingPct, deliveryPct, burnRatePerDay,
 *     projectedTotal, status }
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computePacing,
  pacingStatus,
  burnRate,
  BEHIND_THRESHOLD,
  AHEAD_THRESHOLD,
  PACING_STATUSES,
} from '../src/pacing.mjs';

// ── helpers ───────────────────────────────────────────────────────────────

function makeCampaign(overrides = {}) {
  return {
    id:              'camp-1',
    name:            'Test Campaign',
    start_date:      '2026-01-01',
    end_date:        '2026-01-31',
    impression_goal: 310_000,
    daily_budget:    null,
    ...overrides,
  };
}

// Jan 11 local midnight — 10 days into a 30-day flight
const D11 = new Date(2026, 0, 11);
// totalDays = 30, elapsedDays = 10
// expectedByNow = 310_000 * 10 / 30 ≈ 103_333

// ── burnRate ──────────────────────────────────────────────────────────────

describe('burnRate', () => {
  it('returns 0 when no impressions served', () => {
    assert.equal(burnRate(0, 10), 0);
  });

  it('returns 0 when elapsedDays is 0 (no divide-by-zero crash)', () => {
    assert.doesNotThrow(() => burnRate(1000, 0));
  });

  it('returns correct daily average', () => {
    assert.equal(burnRate(300, 10), 30);
  });
});

// ── pacingStatus ──────────────────────────────────────────────────────────

describe('pacingStatus', () => {
  it('all known statuses are present in PACING_STATUSES', () => {
    for (const s of ['on_track', 'behind', 'ahead', 'completed', 'not_started', 'no_goal']) {
      assert.ok(PACING_STATUSES.includes(s), `${s} missing from PACING_STATUSES`);
    }
  });

  it('returns completed when campaign end date is in the past', () => {
    const past = new Date(2026, 1, 1); // Feb 1 — after Jan 31
    const status = pacingStatus(100, makeCampaign(), past);
    assert.equal(status, 'completed');
  });

  it('returns not_started before campaign start', () => {
    const early = new Date(2025, 11, 31);
    const status = pacingStatus(0, makeCampaign(), early);
    assert.equal(status, 'not_started');
  });

  it('returns ahead above AHEAD_THRESHOLD', () => {
    assert.equal(pacingStatus(AHEAD_THRESHOLD + 1, makeCampaign(), D11), 'ahead');
  });

  it('returns behind below BEHIND_THRESHOLD', () => {
    assert.equal(pacingStatus(BEHIND_THRESHOLD - 1, makeCampaign(), D11), 'behind');
  });

  it('returns on_track in normal range', () => {
    assert.equal(pacingStatus(100, makeCampaign(), D11), 'on_track');
  });

  it('returns no_goal when impression_goal is null', () => {
    assert.equal(pacingStatus(100, makeCampaign({ impression_goal: null }), D11), 'no_goal');
  });
});

// ── computePacing — shape ─────────────────────────────────────────────────

describe('computePacing — return shape', () => {
  const EXPECTED_FIELDS = [
    'servedTotal', 'impressionGoal', 'totalDays', 'elapsedDays',
    'remainingDays', 'expectedByNow', 'pacingPct', 'deliveryPct',
    'burnRatePerDay', 'projectedTotal', 'status',
  ];

  it('returns an object with all required fields', () => {
    const result = computePacing(makeCampaign(), 103_333, D11);
    for (const f of EXPECTED_FIELDS) {
      assert.ok(f in result, `missing field: ${f}`);
    }
  });

  it('servedTotal equals the servedTotal argument', () => {
    const r = computePacing(makeCampaign(), 77_000, D11);
    assert.equal(r.servedTotal, 77_000);
  });

  it('impressionGoal equals campaign.impression_goal', () => {
    const r = computePacing(makeCampaign({ impression_goal: 500_000 }), 100_000, D11);
    assert.equal(r.impressionGoal, 500_000);
  });

  it('remainingDays is non-negative', () => {
    const r = computePacing(makeCampaign(), 50_000, D11);
    assert.ok(r.remainingDays >= 0, `remainingDays ${r.remainingDays} should be >= 0`);
  });

  it('totalDays is positive', () => {
    const r = computePacing(makeCampaign(), 50_000, D11);
    assert.ok(r.totalDays > 0);
  });

  it('elapsedDays is 10 on day 11 of a Jan 1 start', () => {
    const r = computePacing(makeCampaign(), 100_000, D11);
    assert.equal(r.elapsedDays, 10);
  });
});

// ── computePacing — status logic ──────────────────────────────────────────

describe('computePacing — status logic', () => {
  it('on_track when delivery matches expected', () => {
    const r = computePacing(makeCampaign(), 103_333, D11);
    assert.equal(r.status, 'on_track');
  });

  it('behind when delivery is ~60% of expected', () => {
    const r = computePacing(makeCampaign(), 62_000, D11);
    assert.equal(r.status, 'behind');
  });

  it('ahead when delivery is ~120% of expected', () => {
    const r = computePacing(makeCampaign(), 124_000, D11);
    assert.equal(r.status, 'ahead');
  });

  it('not_started before campaign start date', () => {
    const early = new Date(2025, 11, 15);
    const r = computePacing(makeCampaign(), 0, early);
    assert.equal(r.status, 'not_started');
  });

  it('completed after campaign end date', () => {
    const after = new Date(2026, 1, 5);
    const r = computePacing(makeCampaign(), 310_000, after);
    assert.equal(r.status, 'completed');
  });
});

// ── computePacing — null impression_goal ─────────────────────────────────

describe('computePacing — null impression_goal', () => {
  it('does not throw with null impression_goal', () => {
    assert.doesNotThrow(() => computePacing(makeCampaign({ impression_goal: null }), 0, D11));
  });

  it('returns status=no_goal when impression_goal is null', () => {
    const r = computePacing(makeCampaign({ impression_goal: null }), 0, D11);
    assert.equal(r.status, 'no_goal');
  });

  it('returns impressionGoal=null', () => {
    const r = computePacing(makeCampaign({ impression_goal: null }), 0, D11);
    assert.equal(r.impressionGoal, null);
  });
});

// ── computePacing — pacingPct ─────────────────────────────────────────────

describe('computePacing — pacingPct', () => {
  it('pacingPct ≈ 100 when on track', () => {
    const r = computePacing(makeCampaign(), 103_333, D11);
    assert.ok(r.pacingPct > 95 && r.pacingPct < 105, `pacingPct ${r.pacingPct} expected ~100`);
  });

  it('pacingPct < BEHIND_THRESHOLD when behind', () => {
    const r = computePacing(makeCampaign(), 62_000, D11);
    assert.ok(r.pacingPct < BEHIND_THRESHOLD, `pacingPct ${r.pacingPct} should be < ${BEHIND_THRESHOLD}`);
  });

  it('pacingPct > AHEAD_THRESHOLD when ahead', () => {
    const r = computePacing(makeCampaign(), 124_000, D11);
    assert.ok(r.pacingPct > AHEAD_THRESHOLD, `pacingPct ${r.pacingPct} should be > ${AHEAD_THRESHOLD}`);
  });
});
