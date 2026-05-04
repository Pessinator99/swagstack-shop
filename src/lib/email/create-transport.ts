import nodemailer from "nodemailer";

export function createMailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 0);
  if (!host || !port) {
    throw new Error("SMTP_HOST oder SMTP_PORT fehlt.");
  }
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const isMailpit =
    /localhost|127\.0\.0\.1|host\.docker\.internal|mailpit|mailhog/i.test(host);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: isMailpit ? undefined : user && pass ? { user, pass } : undefined,
    tls: isMailpit ? { rejectUnauthorized: false } : undefined,
  });
}
