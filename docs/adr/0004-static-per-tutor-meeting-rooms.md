# Each tutor has one fixed meeting room; no Zoom API integration

Every Tutor stores a single permanent video room on their profile, and session
emails, calendar events and the Join Link resolve to the assigned Tutor's room.
The portal does not talk to Zoom's API and does not create a meeting per session.

## Considered Options

- **Zoom API, one generated meeting per session.** Rejected for now: it needs
  OAuth, token refresh and a scheduled job, and it solves a collision problem
  that per-tutor rooms already solve — two tutors with two rooms never clash, and
  the per-tutor slot lock (ADR-0001) already stops a tutor double-booking
  themselves.

## Consequences

- Replaces the previous single global room, configured as a build-time
  environment variable and therefore identical for everyone. That constant was
  the reason a second tutor could not be added without collisions.
- A Tutor's room is reused across concurrent sessions only if they are somehow
  double-booked, which the slot lock prevents.
