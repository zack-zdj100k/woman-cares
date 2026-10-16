import "server-only";
import nodemailer from "nodemailer";

export type OutgoingEmail = { to: string; subject: string; html: string; text: string };
export type SendResult = { providerMessageId: string };

/**
 * Email transport adapter.
 *  - "log": prints the message to the server console. Nothing is delivered. Development only.
 *  - "smtp": sends through SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD.
 */
export async function sendRaw(email: OutgoingEmail): Promise<SendResult> {
  const transport = process.env.EMAIL_TRANSPORT ?? "log";
  const from = process.env.EMAIL_FROM ?? "Woman Cares <no-reply@example.com>";

  if (transport === "smtp") {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    const info = await mailer.sendMail({ from, to: email.to, subject: email.subject, html: email.html, text: email.text });
    return { providerMessageId: info.messageId };
  }

  // The log transport delivers nothing; it is refused in production unless a test run opts in explicitly.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOG_TRANSPORT !== "1") {
    throw new Error("EMAIL_TRANSPORT=log is not allowed in production.");
  }
  console.info(`\n[email:log] To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`);
  return { providerMessageId: `log-${Date.now()}` };
}
