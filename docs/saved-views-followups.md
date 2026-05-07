# Saved Views Follow-ups

## Deferred: modified-view drift indicator

Prompt 5 cleanup intentionally did not implement the optional "modified view" dot.

Reason:
- the current parents only hold `currentViewId`
- the canonical `currentView` object lives inside `SavedViewsMenu`
- surfacing accurate drift detection would require either:
  - lifting `currentView` state to every page that uses the menu, or
  - introducing a shared saved-view selection hook/context

This is a worthwhile V2 improvement, but it is larger than the bug-fix scope of the cleanup commit.
