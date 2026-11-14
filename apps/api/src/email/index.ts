export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    // Dev/console implementation - provider-agnostic interface for future SMTP/provider.
    // Do not log secrets/tokens in production integrations; dev-only visibility.
    // eslint-disable-next-line no-console
    console.log("[email:dev]", JSON.stringify({ ...message }, null, 2));
  }
}

export const emailProvider: EmailProvider = new ConsoleEmailProvider();

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  await emailProvider.send({
    to: email,
    subject: "Verify your AliAuction account",
    text: `Use this verification token: ${token}\nTODO: replace with frontend verification link/flow when UI is implemented.`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  await emailProvider.send({
    to: email,
    subject: "Reset your AliAuction password",
    text: `Use this password reset token: ${token}\nTODO: replace with frontend reset link/flow when UI is implemented.`,
  });
}
