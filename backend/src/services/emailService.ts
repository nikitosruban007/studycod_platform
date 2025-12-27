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

  private getFrontendUrl(): string {
    return process.env.FRONTEND_URL || "http://localhost:5173";
  }

  private escapeHtml(input: unknown): string {
    const s = String(input ?? "");
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private buildStudyCodEmail(opts: {
    /** <title> and main heading */
    title: string;
    /** short preview line that some clients show near subject */
    preheader?: string;
    /** Optional small badge on top */
    badge?: string;
    /** Greeting line like "Привіт, ..." */
    greeting?: string;
    /** Main rich HTML (must be already escaped/sanitized by caller OR use escapeHtml helpers) */
    contentHtml: string;
    /** CTA button */
    cta?: { label: string; url: string };
    /** Secondary link shown as raw URL */
    secondaryLink?: { label: string; url: string };
    /** Footer note */
    footerNote?: string;
  }): string {
    const title = this.escapeHtml(opts.title);
    const preheader = this.escapeHtml(opts.preheader || "");
    const badge = opts.badge ? this.escapeHtml(opts.badge) : "";
    const greeting = opts.greeting ? this.escapeHtml(opts.greeting) : "";

    const ctaLabel = opts.cta ? this.escapeHtml(opts.cta.label) : "";
    const ctaUrl = opts.cta ? this.escapeHtml(opts.cta.url) : "";

    const secondaryLabel = opts.secondaryLink ? this.escapeHtml(opts.secondaryLink.label) : "";
    const secondaryUrl = opts.secondaryLink ? this.escapeHtml(opts.secondaryLink.url) : "";

    const footerNote = this.escapeHtml(
      opts.footerNote || "Це автоматичний лист від StudyCod. Будь ласка, не відповідайте на нього."
    );

    // NOTE: inline styles only (email clients)
    return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0b0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0f14;padding:56px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background-color:#0f1620;border:1px solid #233043;border-radius:14px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,0.55);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:44px 28px 26px;background:linear-gradient(135deg,#0f1620 0%, #111118 100%);">
              <div style="display:inline-block;border:2px solid #00ff88;border-radius:10px;padding:12px 14px;background:rgba(0,255,136,0.06);box-shadow:0 0 28px rgba(0,255,136,0.18);">
                <span style="color:#00ff88;font-weight:800;font-size:20px;font-family:'Courier New',monospace;">&lt;/&gt;</span>
              </div>
              <div style="margin-top:14px;color:#00ff88;font-size:28px;font-weight:800;letter-spacing:-0.4px;">StudyCod</div>
              <div style="margin-top:6px;color:#9fb3c8;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;">
                ${badge ? badge : "Education & Personal"}
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:34px 34px 10px;">
              <div style="color:#d6e1f0;font-size:22px;font-weight:700;line-height:1.25;margin:0 0 12px;">
                ${title}
              </div>
              ${greeting ? `<div style="color:#9fb3c8;font-size:15px;line-height:1.7;margin:0 0 14px;">${greeting}</div>` : ""}

              <div style="color:#d6e1f0;font-size:15px;line-height:1.75;margin:0;">
                ${opts.contentHtml}
              </div>
            </td>
          </tr>

          <!-- CTA -->
          ${
            opts.cta
              ? `<tr>
            <td align="center" style="padding:18px 34px 10px;">
              <a href="${ctaUrl}" style="display:inline-block;padding:14px 22px;background:linear-gradient(135deg,#00ff88 0%, #00cc6f 100%);color:#0b0f14;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px;letter-spacing:0.02em;box-shadow:0 10px 22px rgba(0,255,136,0.22);">
                ${ctaLabel}
              </a>
            </td>
          </tr>`
              : ""
          }

          <!-- Secondary link -->
          ${
            opts.secondaryLink
              ? `<tr>
            <td style="padding:16px 34px 8px;">
              <div style="background-color:#0b0f14;border:1px solid #233043;border-left:4px solid #00ff88;border-radius:10px;padding:14px 16px;">
                <div style="color:#9fb3c8;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">
                  ${secondaryLabel}
                </div>
                <a href="${secondaryUrl}" style="color:#5b9fff;text-decoration:none;font-size:13px;font-family:'Courier New',monospace;word-break:break-all;line-height:1.6;">
                  ${secondaryUrl}
                </a>
              </div>
            </td>
          </tr>`
              : ""
          }

          <!-- Footer -->
          <tr>
            <td style="padding:26px 34px 30px;border-top:1px solid #233043;background-color:#0b0f14;">
              <div style="color:#6a6a7f;font-size:12px;line-height:1.6;text-align:center;">
                ${footerNote}<br/>
                © 2025 StudyCod
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    const verificationUrl = `${this.getFrontendUrl()}/verify-email?token=${token}`;

    const html = this.buildStudyCodEmail({
      title: "Підтвердження email",
      preheader: "Підтвердіть email, щоб активувати акаунт StudyCod.",
      badge: "Account",
      greeting: `Привіт, ${username}!`,
      contentHtml: `
<p style="margin:0 0 12px;color:#9fb3c8;">Дякуємо за реєстрацію на StudyCod.</p>
<p style="margin:0 0 14px;">Щоб активувати акаунт — підтвердіть електронну пошту.</p>
<div style="margin-top:14px;background-color:#0b0f14;border:1px solid #233043;border-left:4px solid #00ff88;border-radius:10px;padding:14px 16px;">
  <div style="color:#9fb3c8;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Важливо</div>
  <div style="color:#d6e1f0;font-size:13px;line-height:1.6;">
    Якщо ви не реєструвалися — просто проігноруйте цей лист.
  </div>
</div>
      `,
      cta: { label: "Підтвердити email", url: verificationUrl },
      secondaryLink: { label: "Посилання (якщо кнопка не працює)", url: verificationUrl },
    });

    const text = `Привіт, ${username}!

Дякуємо за реєстрацію на StudyCod! 🎉

Для завершення реєстрації та активації вашого акаунта, будь ласка, підтвердьте свою електронну пошту, перейшовши за посиланням:

${verificationUrl}

Якщо ви не реєструвалися на StudyCod, просто проігноруйте цей лист. Ваш акаунт не буде створено.

© 2025 StudyCod. Всі права захищені.`;

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
    const resetUrl = `${this.getFrontendUrl()}/auth/reset-password?token=${token}`;
    const html = this.buildStudyCodEmail({
      title: "Відновлення паролю",
      preheader: "Посилання для відновлення паролю StudyCod.",
      badge: "Security",
      greeting: `Привіт, ${username}!`,
      contentHtml: `
<p style="margin:0 0 12px;">Ми отримали запит на відновлення паролю.</p>
<p style="margin:0 0 14px;color:#9fb3c8;">Якщо це були не ви — ігноруйте цей лист.</p>
      `,
      cta: { label: "Відновити пароль", url: resetUrl },
      secondaryLink: { label: "Посилання (якщо кнопка не працює)", url: resetUrl },
    });

    const text = `Відновлення паролю (StudyCod)\n\nПривіт, ${username}!\n\nВідкрий посилання для відновлення паролю:\n${resetUrl}\n\nЯкщо це були не ви — просто ігноруйте цей лист.\n\n— StudyCod`;

    await this.sendEmail({
      to: email,
      subject: "Відновлення паролю - StudyCod",
      html,
      text,
    });
  }

  async sendTaskAssignmentEmail(
      email: string,
      studentName: string,
      taskTitle: string,
      deadline: Date | null,
      taskType: "PRACTICE" | "CONTROL_WORK"
  ): Promise<void> {
    const deadlineText = deadline
        ? new Date(deadline).toLocaleDateString("uk-UA", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "без дедлайну";

    const taskTypeText = taskType === "CONTROL_WORK" ? "контрольну роботу" : "завдання";
    const frontendUrl = this.getFrontendUrl();
    const safeTaskTitle = this.escapeHtml(taskTitle);

    const html = this.buildStudyCodEmail({
      title: `Нове ${taskTypeText}`,
      preheader: `${taskTitle} · Дедлайн: ${deadlineText}`,
      badge: "EDU",
      greeting: `Вітаємо, ${studentName}!`,
      contentHtml: `
<p style="margin:0 0 12px;">Вчитель призначив вам нове ${this.escapeHtml(taskTypeText)}.</p>
<div style="margin:14px 0 4px;background-color:#0b0f14;border:1px solid #233043;border-left:4px solid #00ff88;border-radius:10px;padding:14px 16px;">
  <div style="color:#00ff88;font-size:16px;font-weight:800;margin:0 0 8px;">${safeTaskTitle}</div>
  <div style="color:#ffd93d;font-weight:800;font-size:13px;">Дедлайн: ${this.escapeHtml(deadlineText)}</div>
</div>
<p style="margin:12px 0 0;color:#9fb3c8;">Перейдіть на платформу, щоб почати виконання.</p>
      `,
      cta: { label: "Перейти до завдання", url: `${frontendUrl}/edu/lessons` },
      secondaryLink: { label: "Відкрити StudyCod", url: `${frontendUrl}/edu/lessons` },
    });

    const text = `
Вітаємо, ${studentName}!

Вчитель призначив вам нове ${taskTypeText}: ${taskTitle}
Дедлайн: ${deadlineText}

Перейдіть на платформу, щоб почати виконувати завдання: ${frontendUrl}

---
Це автоматичне повідомлення від платформи StudyCod.
    `;

    await this.sendEmail({
      to: email,
      subject: `Нове ${taskType === "CONTROL_WORK" ? "контрольне завдання" : "завдання"} - StudyCod`,
      html,
      text,
    });
  }

  async sendStreakBreakNotification(
      email: string,
      username: string,
      streak: number
  ): Promise<void> {
    const frontendUrl = this.getFrontendUrl();
    const html = this.buildStudyCodEmail({
      title: "Streak зламався",
      preheader: `Твій streak: ${streak} днів. Повернись до навчання.`,
      badge: "Personal",
      greeting: `Привіт, ${username}!`,
      contentHtml: `
<p style="margin:0 0 12px;">Твій streak зламався 😅</p>
<div style="margin:14px 0 4px;background-color:#0b0f14;border:1px solid #233043;border-left:4px solid #ffd93d;border-radius:10px;padding:14px 16px;">
  <div style="color:#ffd93d;font-size:14px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Статистика</div>
  <div style="color:#d6e1f0;font-size:14px;line-height:1.6;">Ти мав ${this.escapeHtml(streak)} днів підряд.</div>
</div>
<p style="margin:12px 0 0;color:#9fb3c8;">Повернися до навчання, щоб почати новий streak.</p>
      `,
      cta: { label: "Відкрити StudyCod", url: frontendUrl },
      secondaryLink: { label: "Посилання", url: frontendUrl },
    });

    const text = `StudyCod — streak\n\nПривіт, ${username}!\nТвій streak зламався. Ти мав ${streak} днів підряд.\nПовернися до навчання: ${frontendUrl}\n\n— StudyCod`;

    await this.sendEmail({
      to: email,
      subject: "Твій streak зламався - StudyCod",
      html,
      text,
    });
  }

  async sendGradeNotificationEmail(
      email: string,
      studentName: string,
      taskTitle: string,
      grade: number,
      feedback: string | null,
      taskType: "edu_task" | "topic_task"
  ): Promise<void> {
    const frontendUrl = this.getFrontendUrl();
    const safeTaskTitle = this.escapeHtml(taskTitle);
    const safeGrade = this.escapeHtml(grade);
    const safeFeedback = feedback ? this.escapeHtml(feedback) : "";

    const feedbackHtml = feedback
      ? `<div style="margin:14px 0 4px;background-color:#0b0f14;border:1px solid #233043;border-left:4px solid #5b9fff;border-radius:10px;padding:14px 16px;">
  <div style="color:#9fb3c8;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Коментар</div>
  <div style="color:#d6e1f0;font-size:13px;line-height:1.6;white-space:pre-wrap;">${safeFeedback}</div>
</div>`
      : "";

    const html = this.buildStudyCodEmail({
      title: "Оцінка виставлена",
      preheader: `${taskTitle} · ${grade}/12`,
      badge: "EDU",
      greeting: `Вітаємо, ${studentName}!`,
      contentHtml: `
<p style="margin:0 0 12px;">Вчитель виставив оцінку за ваше завдання.</p>
<div style="margin:14px 0 4px;background-color:#0b0f14;border:1px solid #233043;border-left:4px solid #00ff88;border-radius:10px;padding:14px 16px;">
  <div style="color:#9fb3c8;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Завдання</div>
  <div style="color:#d6e1f0;font-size:15px;font-weight:800;margin-bottom:8px;">${safeTaskTitle}</div>
  <div style="color:#00ff88;font-size:28px;font-weight:900;">${safeGrade} <span style="color:#9fb3c8;font-size:14px;font-weight:700;">/ 12</span></div>
</div>
${feedbackHtml}
      `,
      cta: { label: "Відкрити журнал", url: `${frontendUrl}/edu` },
      secondaryLink: { label: "Посилання", url: `${frontendUrl}/edu` },
    });

    const text = `Вітаємо, ${studentName}!

Вчитель виставив оцінку за ваше завдання.

Завдання: ${taskTitle}
Оцінка: ${grade} / 12
${feedback ? `Коментар: ${feedback}` : ""}

Переглянути оцінку: ${frontendUrl}

---
© 2025 StudyCod. Всі права захищені.`;

    await this.sendEmail({
      to: email,
      subject: `Оцінка виставлена: ${grade}/12 - ${taskTitle}`,
      html,
      text,
    });
  }

  async sendAnnouncementEmail(
    email: string,
    studentName: string,
    className: string,
    title: string | null,
    contentPreview: string
  ): Promise<void> {
    const safeTitle = title?.trim() || "Оголошення";
    const frontendUrl = this.getFrontendUrl();
    const safeClassName = this.escapeHtml(className);
    const safeContentPreview = this.escapeHtml(contentPreview);

    const html = this.buildStudyCodEmail({
      title: `Нове оголошення: ${safeTitle}`,
      preheader: `${className} · ${contentPreview.slice(0, 80)}`,
      badge: `Клас: ${safeClassName}`,
      greeting: `Привіт, ${studentName}!`,
      contentHtml: `
<p style="margin:0 0 12px;color:#9fb3c8;">Нове оголошення у класі <b style="color:#d6e1f0;">${safeClassName}</b></p>
<div style="margin:14px 0 4px;background-color:#0b0f14;border:1px solid #233043;border-left:4px solid #00ff88;border-radius:10px;padding:14px 16px;">
  <div style="color:#d6e1f0;font-size:13px;line-height:1.7;white-space:pre-wrap;">${safeContentPreview}</div>
</div>
      `,
      cta: { label: "Відкрити оголошення", url: `${frontendUrl}/edu/lessons` },
      secondaryLink: { label: "StudyCod", url: `${frontendUrl}/edu/lessons` },
    });

    const text = `Нове оголошення у класі "${className}"

${safeTitle}
${contentPreview}

Перейти до StudyCod: ${frontendUrl}/edu/lessons

— StudyCod`;

    await this.sendEmail({
      to: email,
      subject: `Нове оголошення: ${safeTitle}`,
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
