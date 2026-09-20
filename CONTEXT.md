# KL Math Prep

The tutoring portal for KL Math Prep. It exists so families can book sessions,
exchange work with tutors, and follow progress over time — and so any tutor can
pick up any student without a verbal handoff from another tutor.

## Language

### People

**Tutor**:
A person who teaches Sessions. Tutors are interchangeable; a Student does not
belong to one.
_Avoid_: Instructor, teacher, coach

**Student**:
The person being taught.
_Avoid_: Client, learner, mentee, kid

**Parent**:
The adult responsible for a Student's account and payment.
_Avoid_: Guardian, customer, account holder

**Household**:
A Parent together with the Students linked to them. Bookings, files, Sessions,
credits and progress are shared across a Household.
_Avoid_: Family account, group, team

### Scheduling

**Weekly Availability**:
The recurring hours a Tutor is generally willing to teach, held per day of week.
_Avoid_: Schedule, hours, calendar

**Date Override**:
A one-off subtraction from a Tutor's Weekly Availability on a specific date.
_Avoid_: Blackout, exception, time off, holiday

**Slot**:
A single bookable start time, derived from a Tutor's availability for one date.
_Avoid_: Opening, timeslot, appointment

**Booking**:
The act of a Household claiming a Slot, which creates a Session.
_Avoid_: Reservation, scheduling

**Session**:
One scheduled or completed lesson between a single Tutor and a single Household.
_Avoid_: Appointment, class, meeting, lesson

**Assignment**:
The pairing of a Tutor to a Session. Chosen by the system at Booking time, never
by the Student.
_Avoid_: Allocation, matching, selection

**Acting Tutor** (ADR-0009):
Whichever Tutor identity the signed-in user has switched the schedule screen
to edit. Under the shared-login model a second Tutor has no Cognito account
of his own, so the Acting Tutor is not always the same as the authenticated
account.
_Avoid_: Impersonation, active user

### Teaching

**Topic**:
A named area of maths tracked across Sessions.
_Avoid_: Subject (a Subject is the course; a Topic is a unit within it), skill

**Mastery Level**:
A Student's current standing on one Topic: Learning, Practicing, Getting It, or
Mastered.
_Avoid_: Score, grade, rating

**Session Notes**:
What a Tutor records about a Session after teaching it.
_Avoid_: Notes (ambiguous), summary, report

**Running Context**:
Freeform standing notes about a Student that outlast any single Session — how
they work, what discourages them, where they are in their course.
_Avoid_: Bio, profile, notes

**Prep Card**:
The single view a Tutor reads before teaching a Student for the first time,
gathering that Student's recent Sessions, Topics, uploads, goal and Running
Context.
_Avoid_: Handoff, briefing, dossier

### Access and communication

**Meeting Room**:
A Tutor's fixed personal video room. Each Tutor has exactly one, and it is the
same room for every Session they teach.
_Avoid_: Zoom, Zoom link, PMI

**Join Link**:
A Student's permanent personal URL, which resolves to the Meeting Room of
whichever Tutor is assigned to their next Session.
_Avoid_: Zoom link, meeting URL, invite link

**Notify Address**:
An additional email address on a Household that receives session correspondence
alongside the account's own address.
_Avoid_: Second email, CC, parent email

**Free Session Credit**:
An entitlement to one Session at no charge.
_Avoid_: Coupon, voucher, discount

**Referral**:
An invitation from an existing Household to a prospective one, which grants a
Free Session Credit when redeemed.
_Avoid_: Invite (ambiguous with Family Invitation)

**Family Invitation**:
An invitation from a Parent to a Student, linking that Student into the Parent's
Household.
_Avoid_: Invite (ambiguous with Referral), link request
