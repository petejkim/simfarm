# Debug events

The user requested a Debug menu for non-disaster events. This is a native debugging addition, not a claim about an original DOS menu. It appears immediately after Disasters and uses the existing HTML menu focus, hover and Escape behavior. Original menu decoding/artwork and Disasters entries are unchanged.

- **Start rodeo**: requires a recreation district, no active event and at least$1,000 (the original invitation gate; accepting costs$500).
- **Start fair (carnival)**: requires a recreation district and no active event. Uses the original fair announcement if there are no eligible farm animals or insufficient entry cash; otherwise accepting costs$200.
- **Advance event week**: advances only the current event countdown. Rodeo lasts two event weeks and fair three; participation produces the original randomized result dialog and award/cleanup. Farm date, weekly field orders, weather and taxes do not advance.

Start invokes the recovered calendar event entry (`beginTownCalendarEvent`, sourcec9b0..cbb3) with its original event selector dates, while retaining the actual farm calendar. It bypasses the calendar and Messages option deliberately; it does not grant money, add animals or construct recreation land. Other prerequisites, source map changesd9b2..db51, fees, RNG and music remain canonical. Manual countdown uses the same dbe4..dd3d implementation as weekly play; choices use `resolveTownEventDialog`. Existing natural calendar triggers still run normally. Actions are disabled during other modal decisions or flight; an active event cannot be replaced. Disabled controls explain their requirements in tooltips.

New checkpoint version28 adds a `debug` town-event continuation phase. Its saved date must equal the current date, its modal owns pause, and its day-tick counter is retained. Resolution restores the saved run/pause state without calling weekly rollover or the interrupted simulation tick tail. This prevents debug acknowledgement from changing unrelated farming rules. Both entry and result save/load preserve RNG, fees and awards exactly once. Versions1..27 continue to load. Gzip transport remains unchanged.
