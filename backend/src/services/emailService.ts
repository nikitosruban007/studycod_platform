/**
 * Email service for sending emails
 */
import nodemailer from "nodemailer";

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || "noreply@studycod.app";
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailProvider = process.env.EMAIL_PROVIDER || "smtp";

    if (emailProvider === "gmail") {
      this.transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER || "",
          pass: process.env.EMAIL_PASSWORD || "",
        },
      });
    } else if (emailProvider === "smtp") {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || "",
          pass: process.env.SMTP_PASSWORD || "",
        },
      });
    } else {
      console.warn(
          "[EmailService] No email provider configured. Emails will be logged to console."
      );
      this.transporter = null;
    }
  }

  async sendVerificationEmail(
      email: string,
      token: string,
      username: string
  ): Promise<void> {
    const verificationUrl = `${
        process.env.FRONTEND_URL || "http://localhost:5173"
    }/verify-email?token=${token}`;

    const html = `
      <h2>StudyCod</h2>
      <p>Привіт, ${username}!</p>
      <p>Підтвердьте email за посиланням:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
    `;

    const text = `Привіт, ${username}!
Підтвердьте email: ${verificationUrl}`;

    await this.sendEmail({
      to: email,
      subject: "Підтвердження електронної пошти - StudyCod",
      html,
      text,
    });
  }

  async sendPasswordResetEmail(
      email: string,
      token: string,
      username: string
  ): Promise<void> {
    const resetUrl = `${
        process.env.FRONTEND_URL || "http://localhost:5173"
    }/auth/reset-password?token=${token}`;

    const html = `
      <h2>StudyCod</h2>
      <p>Привіт, ${username}!</p>
      <p>Відновлення паролю:</p>
      <a href="${resetUrl}">${resetUrl}</a>
    `;

    const text = `Відновлення паролю: ${resetUrl}`;

    await this.sendEmail({
      to: email,
      subject: "Відновлення паролю - StudyCod",
      html,
      text,
    });
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    if (!this.transporter) {
      console.log("\n=== EMAIL (DEV MODE) ===");
      console.log("To:", options.to);
      console.log("Subject:", options.subject);
      console.log(options.text);
      console.log("=======================\n");
      return;
    }

    await this.transporter.sendMail({
      from: this.fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }
}

export const emailService = new EmailService();
