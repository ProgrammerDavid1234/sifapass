import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "certomehq@gmail.com",
    pass: "jiayxsekzbcwjcoa", // your app password
  },
});

transporter.sendMail({
  from: "certomehq@gmail.com",
  to: "olonadenifemi@gmail.com",
  subject: "SMTP Test",
  text: "Hello, this is a test email!",
}).then(() => {
  console.log("✅ Email sent");
}).catch(err => {
  console.error("❌ Error:", err);
});
