import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldBypassDspClickMacroForPreview,
  wrapTrackedClickUrlWithDspMacro,
} from './dsp-macros.mjs';

const TRACKED_CLICK_URL = 'https://api.example.com/v1/tags/tracker/tag-1/click?url=https%3A%2F%2Fwww.roblox.com%2Fgames%2F123';
const BASIS_PREVIEW_CLICK_MACRO = 'https://adpreview.sitescout.com/clk/692521909a93a222/969695cc20f3a972/6a04ca630008e47f03950005/0?adPreviewId=28a499ef-8c39-4608-8832-ae93f9841565&r=';
const BASIS_LIVE_CLICK_MACRO = 'https://clickserv.sitescout.com/clk/12345?redirect=';

test('Basis preview click macro can be identified for opt-in bypass', () => {
  assert.equal(
    shouldBypassDspClickMacroForPreview({
      dsp: 'Basis',
      macroValue: BASIS_PREVIEW_CLICK_MACRO,
    }),
    true,
  );
});

test('Basis preview click macro still wraps by default so Basis can detect clicks', () => {
  const clickTag = wrapTrackedClickUrlWithDspMacro(
    TRACKED_CLICK_URL,
    { dsp: 'Basis', cuu: BASIS_PREVIEW_CLICK_MACRO },
    'Basis',
  );

  assert.equal(clickTag, `${BASIS_PREVIEW_CLICK_MACRO}${encodeURIComponent(TRACKED_CLICK_URL)}`);
});

test('Basis preview click macro bypass requires an explicit Dusk opt-in flag', () => {
  const clickTag = wrapTrackedClickUrlWithDspMacro(
    TRACKED_CLICK_URL,
    {
      dsp: 'Basis',
      cuu: BASIS_PREVIEW_CLICK_MACRO,
      smx_bypass_preview_click_macro: '1',
    },
    'Basis',
  );

  assert.equal(clickTag, TRACKED_CLICK_URL);
});

test('Basis live click macro still wraps the tracked click URL', () => {
  assert.equal(
    shouldBypassDspClickMacroForPreview({
      dsp: 'Basis',
      macroValue: BASIS_LIVE_CLICK_MACRO,
    }),
    false,
  );

  const clickTag = wrapTrackedClickUrlWithDspMacro(
    TRACKED_CLICK_URL,
    { dsp: 'Basis', cuu: BASIS_LIVE_CLICK_MACRO },
    'Basis',
  );

  assert.equal(clickTag, `${BASIS_LIVE_CLICK_MACRO}${encodeURIComponent(TRACKED_CLICK_URL)}`);
});

test('Basis preview bypass does not apply to other DSPs', () => {
  assert.equal(
    shouldBypassDspClickMacroForPreview({
      dsp: 'Xandr',
      macroValue: BASIS_PREVIEW_CLICK_MACRO,
    }),
    false,
  );

  const clickTag = wrapTrackedClickUrlWithDspMacro(
    TRACKED_CLICK_URL,
    { dsp: 'Xandr', cuu: BASIS_PREVIEW_CLICK_MACRO },
    'Xandr',
  );

  assert.equal(clickTag, `${BASIS_PREVIEW_CLICK_MACRO}${encodeURIComponent(TRACKED_CLICK_URL)}`);
});

test('Basis preview bypass requires adPreviewId to avoid touching live wrappers', () => {
  const basisNonPreviewMacro = 'https://adpreview.sitescout.com/clk/692521909a93a222/969695cc20f3a972/6a04ca630008e47f03950005/0?r=';

  assert.equal(
    shouldBypassDspClickMacroForPreview({
      dsp: 'Basis',
      macroValue: basisNonPreviewMacro,
    }),
    false,
  );

  const clickTag = wrapTrackedClickUrlWithDspMacro(
    TRACKED_CLICK_URL,
    { dsp: 'Basis', cuu: basisNonPreviewMacro },
    'Basis',
  );

  assert.equal(clickTag, `${basisNonPreviewMacro}${encodeURIComponent(TRACKED_CLICK_URL)}`);
});
