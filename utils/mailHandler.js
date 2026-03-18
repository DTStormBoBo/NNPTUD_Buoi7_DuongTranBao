const nodemailer = require("nodemailer");

var transport = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "69066a61b20472",
    pass: "823dc912711662"
  }
});

module.exports = {
    sendMail: async function (to, url) {
        try {
            const info = await transport.sendMail({
                from: 'admin@heha.com',
                to: to,
                subject: "Reset Password email",
                text: "click vao day de reset password",
                html: "click vao <a href=" + url + ">day</a> de reset password",
            });
            console.log("Email sent:", info.response);
        } catch (error) {
            console.log("Error sending email:", error);
        }
    }
}