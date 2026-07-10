# Hex Jarvis Visual System

## Intent

A private intelligence interface—not a generic admin dashboard. The visual language combines Hex's identity (six-sided geometry, precise symmetry, turquoise energy) with Raul's blackwork/geometry aesthetic and the readable density of a spacecraft instrument panel.

## Tokens

- Background: `#03080b`
- Elevated surface: `rgba(8, 20, 25, .82)`
- Primary energy: `#45f5df`
- Secondary energy: `#47a7ff`
- Warm alert/accent: `#ffb85c`
- Success: `#68f59a`
- Critical: `#ff5f76`
- Primary text: `#e9fffb`
- Secondary text: `#87a7aa`
- Border: `rgba(69, 245, 223, .18)`

Typography uses the native Apple/system sans stack for speed and clarity, with monospaced numerals for telemetry.

## Motion states

- Idle: slow ring rotation and breathing core.
- Listening: eyes and outer field brighten; vertical audio bars respond.
- Thinking: rings accelerate asynchronously; amber processing trace appears.
- Speaking: mouth waveform and core pulse at alternating cadence.
- Error: red edge pulse, never full-screen flashing.

## Mobile rules

- Primary action remains within thumb reach.
- Bottom navigation respects iPhone safe-area insets.
- Minimum interactive target: 46px.
- No hover-only interactions.
- Information remains readable at 320px width.
- Animation reduces automatically when `prefers-reduced-motion` is enabled.
