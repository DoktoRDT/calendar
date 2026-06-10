# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-10

### Added

- Initial release of `@nelmad/calendar`
- `Calendar` — month view with multi-day event bars and single-day chips
- `CalendarSkeleton` loading placeholder
- UTC-offset-aware layout (`buildWeekLayout`, `getMonthGridRange`, `getMonthGridWeeks`)
- `formatEventTime` helper
- Customizable `labels`, `theme`, and `palette` with default exports
- Hover edit/delete actions with `single` / `series` scope
- ESM + CJS build, bundled CSS (`styles.css`, `tokens.css`)
- Storybook examples

### Changed

- README: product overview, data-flow example, multi-day quick start, limitations, event flags matrix, CSS/font setup, exports list
