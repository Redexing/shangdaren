# Publish schedule

Agents read this file at the start of `docs/plans/auto-publish.md`. Update it only in the bookkeeping pull request that procedure describes.

```yaml
mode: schedule          # schedule | on-change
timezone: America/Los_Angeles
cadence: weekly
weekday: Sunday
time: "18:00"
next_publish: 2026-11-01T18:00
hold: false
```

- `schedule`: open a publish PR only when the current time in `timezone` is at or after `next_publish`.
- `on-change`: open a publish PR whenever `main` has shippable commits that `release` does not.
- `hold: true`: a scheduled or on-change run stops. An explicit "publish now" from the user still runs.
- `next_publish` is local time in `timezone`, with no offset suffix. Weekly means the named weekday at `time`.
