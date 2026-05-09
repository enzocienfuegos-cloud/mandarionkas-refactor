# Sprint 19 manual checks

## Core checks
1. Create a widget and verify the document becomes dirty.
2. Save snapshot, reload the page, then use **Load saved**.
3. Change a feed record field and verify the bound widget updates.
4. Create an invalid CTA without open-url and confirm Diagnostics shows a warning.
5. Set a widget end time before start time and confirm Diagnostics shows an error.
6. Duplicate a widget name and confirm Diagnostics warns about duplicate names.
7. Export HTML and verify the manifest reflects the current scene/widget counts.

## Story checks
1. Set a scene next target and preview through it.
2. Add a branch with a missing target scene and verify Diagnostics catches it.
3. Toggle preview mode and validate widget click actions still work.
