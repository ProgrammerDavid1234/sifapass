import nodemailer from "nodemailer";

/**
 * Send email using dynamic credentials
 * @param {Object} options
 * @param {string} options.fromEmail - Sender's email
 * @param {string} options.fromPassword - Sender's password or app password
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email content (HTML)
 */
export default async function sendEmail({ fromEmail, fromPassword, to, subject, html }) {
  const transporter = nodemailer.createTransport({
    service: "Gmail", // can be changed to any email provider
    auth: {
      user: fromEmail,
      pass: fromPassword,
    },
  });

  await transporter.sendMail({
    from: fromEmail,
    to,
    subject,
    html,
  });
}
