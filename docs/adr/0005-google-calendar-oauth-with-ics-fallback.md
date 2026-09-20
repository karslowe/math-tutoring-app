# Google Calendar sync requires OAuth production verification; ICS ships first

Sessions are pushed one-way into each Tutor's Google Calendar, with the Student
and any Notify Addresses invited as attendees so the session and its join
details land on the Student's own calendar. Two Google constraints, neither
visible in the code, shape how this is delivered.

## Constraints

- While an OAuth app's publishing status is **Testing**, refresh tokens expire
  after seven days. A background job that writes bookings to a calendar cannot
  live with that, so the app must be **In Production**.
- Google Calendar scopes are classified **sensitive**, so reaching production
  requires Google's verification: domain ownership, policy links and a recorded
  demonstration of the scope in use. That is gated on Google's review queue, not
  on our effort, and is the single item most likely to slip.

## Consequences

- Calendar invites are attached to booking emails as ICS from the start. This is
  the interim delivery mechanism and remains the permanent fallback for anyone
  who does not authorize, or does not use Google Calendar.
- Only the two Tutors ever authorize. Students never see a consent screen.
- Two-way sync — reading a Tutor's other commitments to suppress conflicting
  slots — is explicitly out of scope. It is the more valuable feature and should
  be reconsidered once one-way push is stable.
