// Email templates for VerifiedSwingers
const dotenv = require("dotenv");
dotenv.config();
/**
 * Generate password reset email template
 * @param {string} code - The 6-digit reset code
 * @returns {string} HTML email template
 */
const generatePasswordResetEmail = (code) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset - VerifiedSwingers</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%);
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: bold;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .code-container {
          background-color: #f8f9fa;
          border: 2px dashed #eacd48;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 30px 0;
        }
        .reset-code {
          font-size: 48px;
          font-weight: bold;
          color: #eacd48;
          letter-spacing: 6px;
          margin: 0;
          font-family: 'Courier New', monospace;
          text-align: center;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 20px 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        .footer p {
          margin: 5px 0;
          color: #6c757d;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%);
          color: #ffffff;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 25px;
          font-weight: bold;
          margin: 20px 0;
        }
        .expiry-notice {
          color: #dc3545;
          font-weight: bold;
          text-align: center;
          margin: 20px 0;
        }
        @media (max-width: 600px) {
          .container {
            margin: 10px;
            border-radius: 0;
          }
          .content {
            padding: 20px 15px;
          }
          .reset-code {
            font-size: 36px;
            letter-spacing: 4px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset</h1>
        </div>
        
        <div class="content">
          <h2>Hello!</h2>
          <p>We received a request to reset your password for your VerifiedSwingers account. Use the verification code below to complete the process.</p>
          
          <div class="code-container">
            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your verification code:</p>
            <p class="reset-code" style="font-size:64px; line-height:1.2; letter-spacing:6px; color:#eacd48; font-weight:bold; margin:0; text-align:center; font-family:'Courier New', monospace;">${code}</p>
          </div>
          
          <div class="expiry-notice">
            This code will expire in 15 minutes
          </div>
        </div>
        
        <div class="footer">
          <p><strong>VerifiedSwingers</strong></p>
          <p>Your trusted community for open-minded connections</p>
          <p>This email was sent to you because a password reset was requested for your account.</p>
          <p style="font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate welcome email template for new users
 * @param {string} username - The user's username
 * @returns {string} HTML email template
 */
const generateWelcomeEmail = (username) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to VerifiedSwingers</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%);
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: bold;
        }
        .content {
          padding: 40px 30px;
        }
        .welcome-message {
          text-align: center;
          margin: 30px 0;
        }
        .features {
          background-color: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .features h3 {
          color: #eacd48;
          margin-top: 0;
        }
        .features ul {
          list-style: none;
          padding: 0;
        }
        .features li {
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }
        .features li:last-child {
          border-bottom: none;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%);
          color: #ffffff;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 25px;
          font-weight: bold;
          margin: 20px 0;
          text-align: center;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 20px 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        .footer p {
          margin: 5px 0;
          color: #6c757d;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to VerifiedSwingers!</h1>
        </div>
        
        <div class="content">
          <div class="welcome-message">
            <h2>Hello ${username}!</h2>
            <p>Welcome to VerifiedSwingers - your trusted community for open-minded connections!</p>
          </div>
          
          <div class="features">
            <h3>What you can do:</h3>
            <ul>
              <li>✨ Connect with like-minded individuals</li>
              <li>🎭 Join exclusive events and meetups</li>
              <li>💬 Engage in private conversations</li>
              <li>🔒 Enjoy a secure and verified community</li>
              <li>📱 Access from anywhere with our mobile app</li>
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="#" class="cta-button">Complete Your Profile</a>
          </div>
          
          <p>We're excited to have you join our community. Start exploring and connecting with amazing people today!</p>
        </div>
        
        <div class="footer">
          <p><strong>VerifiedSwingers</strong></p>
          <p>Your trusted community for open-minded connections</p>
          <p style="font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate email verification template
 * @param {string} username - The user's username
 * @param {string} verificationCode - The verification code
 * @returns {string} HTML email template
 */
const generateEmailVerificationEmail = (username, verificationCode) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - VerifiedSwingers</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%);
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 28px;
          font-weight: bold;
        }
        .content {
          padding: 40px 30px;
        }
        .code-container {
          background-color: #f8f9fa;
          border: 2px dashed #eacd48;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 30px 0;
        }
        .verification-code {
          font-size: 32px;
          font-weight: bold;
          color: #eacd48;
          letter-spacing: 5px;
          margin: 0;
          font-family: 'Courier New', monospace;
        }
        .footer {
          background-color: #f8f9fa;
          padding: 20px 30px;
          text-align: center;
          border-top: 1px solid #e9ecef;
        }
        .footer p {
          margin: 5px 0;
          color: #6c757d;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 Verify Your Email</h1>
        </div>
        
        <div class="content">
          <h2>Hello ${username}!</h2>
          <p>Please verify your email address to complete your VerifiedSwingers account setup.</p>
          
          <div class="code-container">
            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your verification code:</p>
            <p class="verification-code">${verificationCode}</p>
          </div>
          
          <p>Enter this code in the app to verify your email address and start using your account.</p>
        </div>
        
        <div class="footer">
          <p><strong>VerifiedSwingers</strong></p>
          <p>Your trusted community for open-minded connections</p>
          <p style="font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate profile wink notification email
 * @param {string} winkerId - The userId who winked
 * @param {string} winkedProfileId - The userId who received the wink
 * @returns {string} HTML email template
 */
const generateProfileWinkEmail = (winkerId, winkedProfileId) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You got a Wink! - VerifiedSwingers</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; }
        .content { padding: 30px 25px; }
        .wink { text-align: center; margin: 16px 0 24px; font-size: 18px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; margin: 10px 0; text-align: center; }
        .footer { background-color: #f8f9fa; padding: 18px 24px; text-align: center; border-top: 1px solid #e9ecef; }
        .footer p { margin: 5px 0; color: #6c757d; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💛 You just got a Wink!</h1>
        </div>
        <div class="content">
          <p>Someone just winked at your profile on <strong>VerifiedSwingers</strong>.</p>
          <div class="wink">😉 It's a subtle way to say "Hi" — check them out!</div>
          <div style="text-align:center;">
            <a href="${
              process.env.FRONTEND_URL
            }/#/profile/${winkerId}" target="_blank" class="cta-button">View who winked</a>
          </div>
          <p style="color:#6b7280; font-size:14px; text-align:center;">You can manage these notifications in Settings → Email Notifications.</p>
        </div>
        <div class="footer">
          <p><strong>VerifiedSwingers</strong></p>
          <p>Your trusted community for open-minded connections</p>
          <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate friend request notification email
 * @param {string} senderId - The userId who sent the friend request
 * @param {string} receiverId - The userId who received the friend request
 * @returns {string} HTML email template
 */
const generateFriendRequestEmail = (senderId, receiverId) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Friend Request - VerifiedSwingers</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; }
        .content { padding: 30px 25px; }
        .cta { text-align: center; margin-top: 18px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; }
        .footer { background-color: #f8f9fa; padding: 18px 24px; text-align: center; border-top: 1px solid #e9ecef; }
        .footer p { margin: 5px 0; color: #6c757d; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🤝 New Friend Request</h1>
        </div>
        <div class="content">
          <p>You have received a new friend request on <strong>VerifiedSwingers</strong>.</p>
          <div class="cta">
            <a href="${
              process.env.FRONTEND_URL
            }/#/profile/${senderId}" target="_blank" class="cta-button">View sender profile</a>
          </div>
          <p style="color:#6b7280; font-size:14px; text-align:center; margin-top:12px;">You can manage these notifications in Settings → Email Notifications.</p>
        </div>
        <div class="footer">
          <p><strong>VerifiedSwingers</strong></p>
          <p>Your trusted community for open-minded connections</p>
          <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate daily matches email for a user
 * @param {{username?: string}} user - Minimal user object (for greeting)
 * @param {Array<{_id:string, username?:string, nickname?:string, profileImage?:string, about?:string}>} profiles
 */
const generateDailyMatchesEmail = (user, profiles = []) => {
  const safe = (s) => (s ? String(s) : "");
  const items = profiles
    .slice(0, 10)
    .map((p) => {
      const name = safe(p.nickname || p.username || "Member");
      const img = safe(
        p.profileImage || `${process.env.FRONTEND_URL}/logo.png`
      );
      const link = `${process.env.FRONTEND_URL}/#/profile/${p._id}`;
      const about = safe((p.about || "").slice(0, 120));
      return `
        <tr>
          <td style="padding:12px 0; border-bottom:1px solid #eee;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td width="64" valign="top">
                  <a href="${link}" target="_blank">
                    <img src="${img}" alt="${name}" width="56" height="56" style="border-radius:8px; object-fit:cover;" />
                  </a>
                </td>
                <td valign="top" style="padding-left:12px;">
                  <a href="${link}" target="_blank" style="text-decoration:none; color:#111827;">
                    <div style="font-weight:600; font-size:16px;">${name}</div>
                  </a>
                  <div style="color:#6b7280; font-size:14px; margin-top:4px;">${about}</div>
                </td>
                <td align="right" valign="middle">
                  <a href="${link}" target="_blank" style="display:inline-block; background:linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color:#fff; padding:8px 14px; border-radius:9999px; font-weight:600; font-size:13px; text-decoration:none;">View</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Daily Matches - VerifiedSwingers</title>
    </head>
    <body style="margin:0; padding:0; background:#f3f4f6; font-family:Segoe UI, Tahoma, Geneva, Verdana, sans-serif; color:#111827;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td>
            <table align="center" width="600" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.08);">
              <tr>
                <td style="background:linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); padding:24px; text-align:center; color:#fff;">
                  <div style="font-size:22px; font-weight:700;">Your Daily Matches</div>
                  <div style="opacity:0.95; font-size:14px; margin-top:6px;">New profiles matching your preferences</div>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;">
                  <div style="font-size:16px;">Hello ${
                    safe(user?.username) || "there"
                  },</div>
                  <div style="color:#6b7280; font-size:14px; margin-top:8px;">Here are some members we think you'll like.</div>
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:16px;">
                    ${
                      items ||
                      '<tr><td style="padding:16px; color:#6b7280;">No new matches found today. We’ll email you when we find more.</td></tr>'
                    }
                  </table>
                  <div style="text-align:center; margin-top:18px;">
                    <a href="${
                      process.env.FRONTEND_URL
                    }/#/browse" target="_blank" style="display:inline-block; background:linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color:#fff; padding:10px 18px; border-radius:9999px; font-weight:600; font-size:14px; text-decoration:none;">Discover More</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb; padding:16px 24px; text-align:center; color:#6b7280; font-size:12px; border-top:1px solid #eee;">
                  You can manage these emails in Settings → Email Notifications.
                  <div style="margin-top:6px;">© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Generate missed private message email
 * @param {string} senderId
 * @param {string} receiverId
 * @param {string} chatId
 * @param {string} content
 */
const generatePrivateMessageEmail = (senderId, receiverId, chatId, content) => {
  const chatLink = `${process.env.FRONTEND_URL}/#/chat?chatId=${chatId}`;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Message - VerifiedSwingers</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); padding: 24px; text-align: center; color: #fff; }
        .content { padding: 24px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; }
        .footer { background-color: #f8f9fa; padding: 18px 24px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e9ecef; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💬 You have a new message</h1>
        </div>
        <div class="content">
          <p>You missed a new message while you were away.</p>
          <blockquote style="margin: 12px 0; padding: 12px; background:#f9fafb; border-left: 3px solid #eacd48;">${(
            content || ""
          ).slice(0, 160)}</blockquote>
          <p style="text-align:center; margin-top:16px;">
            <a href="${chatLink}" target="_blank" class="cta-button">Open Chat</a>
          </p>
        </div>
        <div class="footer">
          <p>You can manage these notifications in Settings → Email Notifications.</p>
          <p>© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  generatePasswordResetEmail,
  generateWelcomeEmail,
  generateEmailVerificationEmail,
  generateProfileWinkEmail,
  generateFriendRequestEmail,
  generateDailyMatchesEmail,
  generatePrivateMessageEmail,
};
