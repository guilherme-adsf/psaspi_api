import * as nodemailer from "nodemailer";
import { google } from "googleapis";
import SMTPTransport = require("nodemailer/lib/smtp-transport");
const clientID = "CLIENT_ID";
const clientSecret = "CLIENT_SECRET";
const refresh_token = "REFRESH_TOKEN";
const OAuth2 = google.auth.OAuth2;
const oauth2Client = new OAuth2(
  clientID, // ClientID
  clientSecret, // Client Secret
  "https://developers.google.com/oauthplayground" // Redirect URL
);
oauth2Client.setCredentials({
  refresh_token: refresh_token,
});

class NodeMailer {
  async get_transporter() {
    const accessToken = await oauth2Client.getAccessToken();

    var transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: "EMAIL_DO_REMETENTE - DEVE SER O MESMO EMAIL DA CONTA DAS CREDENCIAIS",
        clientId: clientID,
        clientSecret: clientSecret,
        refreshToken: refresh_token,
        accessToken: accessToken,
      },
      tls: {
        rejectUnauthorized: false,
      },
    } as SMTPTransport.Options);

    return transporter;
  }

  async send_email(mailOptions) {
    const transporter = await this.get_transporter();
    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
          console.log(err);
          resolve(false);
        } else {
          console.log(info);
          resolve(true);
        }
      });
    });
  }
}

export default new NodeMailer();
