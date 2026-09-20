# Join Links are unguessable URLs that require no login

Each Student gets a permanent personal URL that redirects to the Meeting Room of
their next Session without authenticating them. It resolves only within a window
around a scheduled session.

Students already receive the meeting link in a booking email and an hour-before
reminder, and still ask for it by text — so the problem is not delivery, it is
that a link arriving by email is not reachable at the moment it is needed.
Requiring a login to reach the Join Link would reintroduce exactly the friction
that sends them to text in the first place.

## Consequences

- Anyone holding the URL can learn a meeting room and a session time. This was
  accepted deliberately: it exposes no files, notes, progress or account data,
  and is comparable to a forwarded calendar invite.
- The time window bounds a leaked link so it is not permanently live.
- Calendar attendee invites (ADR-0005) are the primary path to the meeting; the
  Join Link is the backup for anyone not using a calendar.
