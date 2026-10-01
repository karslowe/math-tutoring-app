import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | KL Math Prep",
  description: "How KL Math Prep collects, uses and protects your information.",
};

const CONTACT_EMAIL = "karstenmathprep@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-gray-700">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: October 1, 2026</p>

      <p className="mb-8">
        KL Math Prep (klmathprep.com) is a small tutoring service. This page
        explains what information the site collects and how it is used.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Information we collect
      </h2>
      <ul className="list-disc pl-6 mb-8 space-y-1">
        <li>Account details: name, email address, and optionally a phone number.</li>
        <li>Files you upload, and the notes and completed work your tutor shares with you.</li>
        <li>Session bookings, session notes, and progress on topics.</li>
        <li>Referral and family-account information you choose to enter.</li>
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        How we use it
      </h2>
      <p className="mb-8">
        We use this information only to run the tutoring service: signing you
        in, scheduling sessions, storing and sharing session materials, sending
        booking confirmations and reminders by email, and tracking progress. We
        do not sell your information or use it for advertising.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Google Calendar
      </h2>
      <p className="mb-8">
        The tutors&apos; own Google Calendar is connected to the site. The site
        uses it to read when the tutor is busy, so that students are only
        offered open times, and to add booked sessions to that calendar. It
        accesses only the tutors&apos; calendar. Students are never asked to
        connect their Google account. Use of information received from Google
        APIs adheres to the{" "}
        <a
          className="text-primary-700 underline"
          href="https://developers.google.com/terms/api-services-user-data-policy"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Calendar data is not shared
        with anyone else, is not used for advertising, and is not used to
        train AI models.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Where it is stored and who can see it
      </h2>
      <p className="mb-8">
        Data is stored with Amazon Web Services (sign-in, file storage,
        database and email delivery). Your files and notes are visible to you,
        to the tutors, and to family members you have linked to your account.
        We do not share them with anyone else except where required by law.
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Your choices
      </h2>
      <p className="mb-8">
        You can delete your uploaded files from the site at any time. To
        request a copy or deletion of your account and data, email{" "}
        <a
          className="text-primary-700 underline"
          href={`mailto:${CONTACT_EMAIL}`}
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact</h2>
      <p>
        Questions about this policy:{" "}
        <a
          className="text-primary-700 underline"
          href={`mailto:${CONTACT_EMAIL}`}
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
