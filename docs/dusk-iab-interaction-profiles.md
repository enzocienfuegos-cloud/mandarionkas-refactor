# Dusk IAB Interaction Profiles v1

This document defines the interaction tiers Dusk should support for IAB-oriented export.

It exists to prevent two common failures:

- treating every editor interaction as export-safe
- overloading the first export engine with playable-grade behavior too early

The interaction model is progressive. Dusk should not assume all creatives need the same runtime complexity.

## Goals

- Define which interaction patterns are allowed in each export tier.
- Separate baseline banner behavior from advanced interactive and playable behavior.
- Keep export decisions policy-driven and non-hardcoded.
- Make room for responsive HTML5 banners, scene-based storytelling, and future playables.

## Design Principles

- `Progressive complexity`: every interaction tier adds capability without redefining the lower tiers.
- `Capability-driven`: widgets/modules must declare which interaction tier they require.
- `Graceful degradation`: if a module exceeds the selected tier, Dusk should downgrade or block with explicit readiness output.
- `Responsive by default`: interaction design must work across aspect ratios, input types, and display contexts.
- `No single-CTA assumption`: interaction profiles must support multiple exits and multiple touch targets.

## Tier Overview

### Tier 1: Banner Runtime

This is the baseline IAB-oriented interaction tier and should anchor the first export engine release.

Supported interaction patterns:

- responsive layout behavior
- one or more scenes
- scene sequencing and simple transitions
- click/tap exits
- multiple CTA buttons
- image or media overlay exits
- hotspots
- show/hide state toggles when simple and deterministic
- timeline-based reveals that do not depend on freeform user manipulation

Allowed widget/module families:

- `text`
- `shape`
- `cta`
- `buttons`
- `image`
- `hero-image`
- `badge`
- `qr-code`
- `interactive-hotspot`
- selected simple scene sequencing patterns

Constraints:

- interactions should remain deterministic and lightweight
- input should be tap/click first
- scene flow should not require game-like state management
- runtime should not depend on editor-only action handling

Recommended export use cases:

- standard responsive HTML5 banners
- scene-based brand stories
- multi-CTA product units
- hotspot explainers

## Tier 2: Advanced Interactive Runtime

This tier adds controlled gesture-based interactivity on top of Tier 1.

Supported interaction patterns:

- all Tier 1 behaviors
- drag with constrained axis or bounded area
- swipe between states or panels
- slider/range manipulation
- simple reveal mechanics
- lightweight multi-state component logic

Allowed widget/module families:

- `slider`
- `range-slider`
- `image-carousel`
- `scratch-reveal`
- `interactive-gallery`
- selected richer modules that can prove bounded gesture behavior

Constraints:

- gestures must be bounded and deterministic
- interactions must degrade cleanly to a non-gesture fallback
- state machines should remain local and shallow
- no dependency on heavy external runtimes
- interaction should still end in one or more standard exits

Recommended export use cases:

- product comparison banners
- before/after sliders
- swipeable story cards
- guided reveal formats

## Tier 3: Playable Runtime

This tier is for playable ad experiences, not for the first IAB export milestone.

Supported interaction patterns:

- all Tier 1 and Tier 2 behaviors
- stateful progression loops
- mini-game mechanics
- score/progress progression
- onboarding gesture prompts
- fail/success or completion states
- end-card CTA flow

Candidate use cases:

- branded mini-games
- trial-like product demos
- gamified quiz or challenge experiences
- mobile-first playable ads

Constraints:

- requires a dedicated playable runtime profile
- requires stronger input, state, and performance governance
- must isolate gameplay state from editor document state
- should not share the exact same runtime assumptions as Banner Runtime

Recommendation:

Do not treat Tier 3 as an automatic extension of the baseline export engine. Build it as a runtime profile on top of the neutral export model.

## Responsive Compatibility

Responsive support is compatible with the Dusk IAB direction and should be part of Tier 1.

Responsive requirements for Dusk:

- layouts must adapt across aspect ratios or slot families
- exits/hotspots must remain correctly aligned after scaling
- scenes must preserve sequencing when resized
- text and CTA readability must remain intact under scaling policies
- interactive hit areas must remain usable on touch devices

Responsive support should not be implemented by hardcoding one list of fixed sizes into widget renderers. It should come from export policy and runtime layout rules.

## Scene Compatibility

Scenes are compatible with IAB-oriented export, but Dusk should treat them as a controlled storytelling layer.

Scene rules by default:

- scenes are supported in Tier 1
- simple transitions are supported
- scene sequencing should be declarative
- scenes should not require complex branching in v1
- scene count should remain constrained by export policy, not hardcoded in widget code

Good scene patterns:

- intro scene
- product/value scene
- CTA/end-card scene

Higher-risk scene patterns:

- nested branching scenes
- loop-heavy interactive stories
- scene flows tightly coupled to drag/game state

## Tap and Multi-CTA Compatibility

Tap and click-based interactions are core to Tier 1.

Required rules:

- a banner may expose more than one CTA
- hotspots may generate exits independently from CTA widgets
- buttons collections may generate multiple exits
- duplicate destination URLs are allowed
- exits still need distinct IDs, labels, and geometry

This means Dusk should model:

- `primary CTA` as optional metadata only
- not as a hard requirement of the engine

## Drag Compatibility

Drag is compatible with Dusk's long-term direction, but should be Tier 2, not Tier 1.

Why:

- drag adds more runtime complexity than tap
- drag interactions are harder to preserve responsively
- drag often requires more local state and gesture handling
- drag-based modules need explicit fallback planning

Drag should only graduate into export when the module can answer:

- what is the constrained gesture area
- what is the start state
- what is the end state
- what is the fallback when drag is unavailable or degraded
- how does the interaction resolve to a useful outcome or exit

## Playable Compatibility

Playable ads are compatible with Dusk conceptually, but they should be treated as a separate profile, not as the default banner export target.

Reasons:

- playables need stronger state management
- playables often need onboarding and completion states
- playables require a more robust runtime contract
- playables are not just "a banner with more interactions"

Playable profile requirements:

- dedicated state model
- explicit gameplay loop
- completion/end-card handling
- interaction telemetry hooks
- stronger readiness diagnostics

## Degradation Policy

If a creative contains modules above the selected interaction tier, Dusk should:

- degrade them if a meaningful fallback exists
- otherwise block export with a capability-aware message

Examples:

- Tier 1 export with `slider` present -> degrade to static first state
- Tier 1 export with `dynamic-map` present -> snapshot or block depending on policy
- Tier 2 export with `scratch-reveal` present -> allow bounded reveal or fall back to static image
- Tier 3 export with no end-card CTA -> readiness warning or blocker based on policy

## Suggested Policy Model

```ts
type InteractionTier = 'banner-runtime' | 'advanced-interactive' | 'playable-runtime';

type ExportInteractionPolicy = {
  tier: InteractionTier;
  responsiveMode: 'fixed' | 'adaptive' | 'fluid-policy';
  supportsScenes: boolean;
  supportsMultipleExits: boolean;
  supportsHotspots: boolean;
  supportsDrag: boolean;
  supportsSwipe: boolean;
  supportsPlayableState: boolean;
};
```

## Mapping to Current Dusk Modules

### Tier 1-ready targets

- `text`
- `shape`
- `cta`
- `buttons`
- `image`
- `hero-image`
- `badge`
- `qr-code`
- `interactive-hotspot`

### Tier 2 candidates

- `slider`
- `range-slider`
- `image-carousel`
- `scratch-reveal`
- `interactive-gallery`

### Tier 3 or special-case candidates

- `speed-test`
- `form`
- richer game-like future modules

### Likely degraded or blocked across tiers unless redesigned

- `dynamic-map`
- live-data modules with uncontrolled external dependencies

## Build Order

### Phase 1

- implement Tier 1 interaction policy
- support responsive scenes and multiple exits
- make Tier 1 the default IAB export path

### Phase 2

- add Tier 2 gesture runtime
- add bounded drag/swipe modules
- add degradation-aware fallbacks

### Phase 3

- define playable runtime profile
- isolate playable state/runtime from baseline banner runtime
- introduce playable-specific readiness checks

## Product Recommendation

Dusk should expose interaction intent clearly during export.

Suggested export-facing options:

- `Responsive Banner`
- `Interactive Banner`
- `Playable Experience`

These labels are product-friendly wrappers around the technical tiers:

- `Responsive Banner` -> Tier 1
- `Interactive Banner` -> Tier 2
- `Playable Experience` -> Tier 3

## Immediate Next Steps

- codify `InteractionTier` in `src/export/types`
- add module-to-tier mapping in export policy/config
- update readiness to report when a document exceeds its selected tier
- implement Tier 1 first before adding gesture runtime
