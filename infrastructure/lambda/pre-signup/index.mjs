/**
 * Cognito Pre Sign-up trigger.
 *
 * Auto-confirms new users and marks their email as verified so they can sign in
 * immediately without going through the emailed verification code. SES delivery
 * of the code was unreliable and dropping signups.
 */
export async function handler(event) {
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
}
