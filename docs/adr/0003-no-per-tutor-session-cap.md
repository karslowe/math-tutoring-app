---
status: accepted
---

# No per-tutor session cap

A hard weekly ceiling per Tutor was proposed and deliberately rejected: the
founding tutor will limit his load by publishing fewer hours rather than by
having the system refuse bookings. Recorded because the codebase otherwise reads
as though the possibility was never considered, and because pooled booking
(ADR-0002) means any published hour is bookable by anyone.

## Consequences

- Nothing in the system prevents the founding tutor from being booked solid in a
  week where he publishes generously. The safeguard is self-restraint at the
  point of editing availability.
- Revisit if a week ever exceeds the intended load. The mechanism is small — count
  a tutor's scheduled sessions for the week and drop their slots from the union
  once the ceiling is reached — and can be added without a migration.
