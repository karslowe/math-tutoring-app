# Every tutor has access to every student's record

Tutor access is unscoped: any Tutor can read any Student's files, session notes,
progress and Prep Card, regardless of whether they have taught them.

This follows directly from pooled booking (ADR-0002) — a Tutor can be assigned a
Student they have never met, so scoping access to previously-taught Students
would leave them unable to prepare for exactly the session where preparation
matters most.

## Consequences

- Recorded as a deliberate decision rather than left as an artifact of the
  existing binary tutor role check, because the records concern minors.
- Households should be told that a second Tutor exists and has access to their
  Student's work before that Tutor takes their first session.
- The single-address environment-variable fallback that grants tutor access by
  email match no longer works with more than one tutor and is replaced by
  group membership.
