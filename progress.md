Original prompt: after few scond rotating circle is moveing downwoard fix it

- Started investigating rotating arena drifting downward in the live app.
- Need to reproduce in browser, identify whether the drift is physics-state or layout-related, patch it, and re-test.
- Hypothesis: this is a layout drift, not arena physics. The grid middle row appears to grow as chat messages accumulate, pushing the footer out of view and making the arena look like it slides downward.
- Next: verify with browser measurements/screenshots, then lock the grid row/column sizing and overflow behavior.
- Reproduced the bug by logging in and pushing 10 manual chat spawns. Before the fix, the middle grid row expanded to ~1355px, the footer was pushed below the viewport, and the arena appeared to drift downward.
- Fixed by locking the root grid to `80px / minmax(0,1fr) / 100px` and by adding `min-h-0` + `overflow-hidden` to the sidebars and chat scroller so growing chat stays inside its panel.
- Re-tested with the same 10-spawn stress case: viewport stayed at 784px high, main stayed at 602px high, footer stayed visible at y=684, and the arena remained anchored.
- The drift regressed after restoring the v5 layout. Root cause is the same: the dashboard grid used plain `1fr` for the middle row and the sidebars did not clamp overflow, so chat growth pushed the arena downward again.
- Reapplied the non-visual layout fix while preserving the v5 screen design: root grid now uses `minmax(0,1fr)` rows/columns and both sidebars clamp height with `min-h-0` and `overflow-hidden`; the chat list also uses `min-h-0`.
- Increased flag ball movement speed without changing the v5 layout: initial launch speed raised to 11, random in-play force scale raised to 0.0024, and max velocity clamp raised to 11.
- Updated the live chat panel to an ephemeral feed: messages now carry timestamps, auto-expire after 6 seconds, and the sidebar uses plain rows with hidden overflow instead of scrollable cards.
- Added round-level entrant lockout: once a country joins a round, it is stored in `roundCountries` and cannot spawn again until the round fully resets after win/draw cleanup.
