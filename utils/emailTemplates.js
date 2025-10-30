// Email templates for VerifiedSwingers
const dotenv = require("dotenv");
dotenv.config();

/**
 * Generate affiliate registration success email
 * @param {string} username - The user's username
 * @param {string} referralCode - The generated referral code
 */
const generateAffiliateRegistrationEmail = (username, referralCode) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Affiliate Registration Successful</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#f4f4f4; margin:0; padding:0; color:#111827; }
        .container { max-width:600px; margin:24px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08); }
        .header { background:linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color:#fff; padding:24px; text-align:center; }
        .content { padding:24px; }
        .code { display:inline-block; padding:10px 16px; border-radius:9999px; background:#fef3c7; color:#92400e; font-weight:700; letter-spacing:1px; }
        .card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin-top:16px; }
        .cta { display:inline-block; margin-top:18px; background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color:#fff; text-decoration:none; padding:10px 18px; border-radius:9999px; font-weight:600; }
        .footer { padding:16px 24px; text-align:center; font-size:12px; color:#6b7280; border-top:1px solid #e5e7eb; background:#f9fafb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 You're an Affiliate, ${username}!</h1>
        </div>
        <div class="content">
          <p>Welcome to the VerifiedSwingers Affiliate Program. Your registration was successful.</p>
          <div class="card">
            <div style="font-weight:600; margin-bottom:6px;">Your Referral Code</div>
            <div class="code">${referralCode}</div>
            <p style="margin-top:12px; color:#374151; font-size:14px;">Share this code or your referral link to earn commissions when new users subscribe.</p>
          </div>

          <div class="card">
            <div style="font-weight:600; margin-bottom:6px;">Your Referral Link</div>
            <a
              href="${process.env.FRONTEND_URL}/#/signup?ref=${referralCode}"
              style="display:inline-block; color:#1d4ed8; text-decoration:underline; word-break:break-all;"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${process.env.FRONTEND_URL}/#/signup?ref=${referralCode}
            </a>
            <p style="margin-top:12px; color:#374151; font-size:14px;">Send this link to people you invite. When they sign up and subscribe, you earn commission.</p>
          </div>
          <a class="cta" href="${
            process.env.FRONTEND_URL
          }/#/affiliate">Open Affiliate Dashboard</a>
          <div class="card" style="margin-top:16px;">
            <div style="font-weight:600; margin-bottom:6px;">Tips to get started</div>
            <ul style="margin:0; padding-left:18px; color:#374151; font-size:14px;">
              <li>Post your referral link on social media and forums</li>
              <li>Add the link to your profile bio</li>
              <li>Share with friends who might be interested</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate new referral commission earned email
 * @param {string} referredUsername - Referred user's username
 * @param {string} referralCode - Affiliate referral code used
 */
const generateNewReferralCommissionEarnedEmail = (
  referredUsername,
  referralCode
) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>New Referral Commission Earned</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#f4f4f4; margin:0; padding:0; color:#111827; }
        .container { max-width:600px; margin:24px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08); }
        .header { background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#fff; padding:24px; text-align:center; }
        .content { padding:24px; }
        .highlight { background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:16px; }
        .footer { padding:16px 24px; text-align:center; font-size:12px; color:#6b7280; border-top:1px solid #e5e7eb; background:#f9fafb; }
        .cta { display:inline-block; margin-top:16px; background:linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color:#111827; text-decoration:none; padding:10px 18px; border-radius:9999px; font-weight:700; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💸 New Commission Earned</h1>
        </div>
        <div class="content">
          <p>Great news! Someone used your referral code <strong>${referralCode}</strong>.</p>
          <div class="highlight" style="margin-top:12px;">
            <div style="font-weight:600; margin-bottom:6px;">Referral Details</div>
            <div style="font-size:14px; color:#065f46;">Referred user: <strong>${referredUsername}</strong></div>
            <div style="font-size:14px; color:#065f46;">Status: Tracked</div>
          </div>
          <a class="cta" href="${
            process.env.FRONTEND_URL
          }/#/affiliate">View Affiliate Dashboard</a>
          <p style="font-size:13px; color:#6b7280; margin-top:10px;">Commission will be updated upon subscription confirmation (if applicable).</p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate affiliate commission payout email
 * @param {string} username - Affiliate username
 * @param {number} amount - Payout amount in minor currency units (e.g., pence)
 */
const generateAffiliateCommissionPayoutEmail = (username, amount) => {
  const majorAmount = (Number(amount || 0) / 100).toFixed(2);
  const currency = (process.env.DEFAULT_CURRENCY || "GBP").toUpperCase();
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Affiliate Commission Payout</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#f4f4f4; margin:0; padding:0; color:#111827; }
        .container { max-width:600px; margin:24px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08); }
        .header { background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color:#fff; padding:24px; text-align:center; }
        .content { padding:24px; }
        .summary { background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:16px; }
        .footer { padding:16px 24px; text-align:center; font-size:12px; color:#6b7280; border-top:1px solid #e5e7eb; background:#f9fafb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Commission Payout Processed</h1>
        </div>
        <div class="content">
          <p>Hi ${username},</p>
          <p>Your affiliate commission payout has been processed successfully.</p>
          <div class="summary" style="margin-top:12px;">
            <div style="font-weight:600; margin-bottom:6px;">Payout Summary</div>
            <div style="font-size:14px; color:#1f2937;">Amount: <strong>${currency} ${majorAmount}</strong></div>
            <div style="font-size:12px; color:#6b7280; margin-top:6px;">Funds may take 3-5 business days to arrive depending on your bank.</div>
          </div>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
};
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

/**
 * Generate verification submission confirmation email
 * @param {string} username - User's username
 * @returns {string} HTML email template
 */
const generateVerificationSubmittedEmail = (username) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Submitted - VerifiedSwingers</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 20px; }
        .highlight { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #eacd48; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e9ecef; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📸 Verification Submitted</h1>
        </div>
        <div class="content">
          <div class="icon">✅</div>
          <h2>Hello ${username}!</h2>
          <p>Thank you for submitting your verification documents. We have received your submission and our team will review it shortly.</p>
          
          <div class="highlight">
            <h3>What happens next?</h3>
            <ul style="text-align: left; margin: 0; padding-left: 20px;">
              <li>Our verification team will review your documents</li>
              <li>You'll receive an email notification once the review is complete</li>
              <li>If approved, you'll gain access to the website</li>
              <li>If additional information is needed, we'll contact you directly</li>
            </ul>
          </div>
          
          <p><strong>Review Time:</strong> Typically 24-48 hours</p>
          <p>You can check your verification status by trying to login to your account.</p>
        </div>
        <div class="footer">
          <p>Thank you for helping us maintain a safe and authentic community!</p>
          <p>© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate verification approved email
 * @param {string} username - User's username
 * @returns {string} HTML email template
 */
const generateVerificationApprovedEmail = (username) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Approved - VerifiedSwingers</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 20px; }
        .celebration { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #f59e0b; }
        .benefits { background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; margin: 10px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e9ecef; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Verification Approved!</h1>
        </div>
        <div class="content">
          <div class="icon">✅</div>
          <h2>Congratulations ${username}!</h2>
          
          <div class="celebration">
            <h3>🎊 You're Now Verified! 🎊</h3>
            <p>Your verification has been approved! Welcome to the VerifiedSwingers community.</p>
          </div>
          
          <div class="benefits">
            <h3>🌟 What you can do now:</h3>
            <ul style="text-align: left; margin: 0; padding-left: 20px;">
              <li>Access all premium features</li>
              <li>Create and join events</li>
              <li>Send unlimited messages</li>
              <li>Upload more photos and videos</li>
              <li>See who viewed your profile</li>
              <li>Join group chats</li>
              <li>And much more!</li>
            </ul>
          </div>
          
          <p style="margin-top: 30px;">
            <a href="${
              process.env.FRONTEND_URL
            }/#/profile" class="cta-button">View Your Profile</a>
            <a href="${
              process.env.FRONTEND_URL
            }/#/browse" class="cta-button">Start Browsing</a>
          </p>
        </div>
        <div class="footer">
          <p>Thank you for being part of our verified community!</p>
          <p>© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate verification rejected email
 * @param {string} username - User's username
 * @param {string} reason - Rejection reason
 * @returns {string} HTML email template
 */
const generateVerificationRejectedEmail = (username, reason = "") => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verification Update - VerifiedSwingers</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 20px; }
        .notice { background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .help { background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; margin: 10px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e9ecef; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Verification Update</h1>
        </div>
        <div class="content">
          <div class="icon">📝</div>
          <h2>Hello ${username},</h2>
          <p>We've reviewed your verification submission and need some additional information to complete the process.</p>
          
          <div class="notice">
            <h3>📌 What we need:</h3>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
            <p>Please ensure your verification documents are:</p>
            <ul style="text-align: left; margin: 0; padding-left: 20px;">
              <li>Clear and readable</li>
              <li>Valid and current</li>
              <li>Show your full name and photo</li>
              <li>Not edited or filtered</li>
            </ul>
          </div>
          
          <div class="help">
            <h3>💡 Need help?</h3>
            <p>If you have questions about the verification process, please contact our support team. We're here to help!</p>
          </div>
          
          <p style="margin-top: 30px;">
            <a href="${
              process.env.FRONTEND_URL
            }/#/profile" class="cta-button">Resubmit Verification</a>
            <a href="mailto:support@verifiedswingers.com" class="cta-button">Contact Support</a>
          </p>
        </div>
        <div class="footer">
          <p>We appreciate your patience as we work to verify all members.</p>
          <p>© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate admin notification for new verification submission
 * @param {string} username - User's username
 * @param {string} userId - User's ID
 * @returns {string} HTML email template
 */
const generateAdminVerificationNotificationEmail = (username, userId) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Verification Submission - Admin</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 20px; }
        .alert { background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; margin: 10px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e9ecef; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 New Verification Submission</h1>
        </div>
        <div class="content">
          <div class="icon">📋</div>
          <h2>Admin Notification</h2>
          <p>A new verification submission requires your review.</p>
          
          <div class="alert">
            <h3>📝 Submission Details:</h3>
            <p><strong>User:</strong> ${username}</p>
            <p><strong>User ID:</strong> ${userId}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p>Please review the submission in the admin panel.</p>
          
          <p style="margin-top: 30px;">
            <a href="${
              process.env.FRONTEND_URL
            }/#/admin/verifications" class="cta-button">Review Submission</a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated notification for admin users.</p>
          <p>© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate club verification submission confirmation email
 * @param {string} clubName - Club's name
 * @returns {string} HTML email template
 */
const generateClubVerificationSubmittedEmail = (clubName) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Club Verification Submitted - VerifiedSwingers</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 20px; }
        .highlight { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #eacd48; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e9ecef; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏢 Club Verification Submitted</h1>
        </div>
        <div class="content">
          <div class="icon">✅</div>
          <h2>Hello ${clubName}!</h2>
          <p>Thank you for submitting your club verification documents. We have received your submission and our team will review it shortly.</p>
          
          <div class="highlight">
            <h3>What happens next?</h3>
            <ul style="text-align: left; margin: 0; padding-left: 20px;">
              <li>Our verification team will review your business documents</li>
              <li>We'll verify your business license and contact information</li>
              <li>You'll receive an email notification once the review is complete</li>
              <li>If approved, your club will be featured on our platform</li>
              <li>If additional information is needed, we'll contact you directly</li>
            </ul>
          </div>
          
          <p><strong>Review Time:</strong> Typically 2-3 business days</p>
          <p>You can check your verification status by logging into your club account.</p>
        </div>
        <div class="footer">
          <p>Thank you for helping us maintain a safe and authentic community!</p>
          <p>© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate club verification approved email
 * @param {string} clubName - Club's name
 * @returns {string} HTML email template
 */
const generateClubVerificationApprovedEmail = (clubName) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Club Verification Approved - VerifiedSwingers</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 20px; }
        .celebration { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #f59e0b; }
        .benefits { background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; margin: 10px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e9ecef; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Club Verification Approved!</h1>
        </div>
        <div class="content">
          <div class="icon">✅</div>
          <h2>Congratulations ${clubName}!</h2>
          
          <div class="celebration">
            <h3>🎊 Your Club is Now Verified! 🎊</h3>
            <p>Your club verification has been approved! Welcome to the VerifiedSwingers community.</p>
          </div>
          
          <div class="benefits">
            <h3>🌟 What your club can do now:</h3>
            <ul style="text-align: left; margin: 0; padding-left: 20px;">
              <li>Create and manage events</li>
              <li>Attract verified members</li>
              <li>Showcase your club with verified badge</li>
              <li>Access premium club features</li>
              <li>Manage member reviews</li>
              <li>Promote special events</li>
              <li>And much more!</li>
            </ul>
          </div>
          
          <p style="margin-top: 30px;">
            <a href="${
              process.env.FRONTEND_URL
            }/#/club/dashboard" class="cta-button">Club Dashboard</a>
            <a href="${
              process.env.FRONTEND_URL
            }/#/club/create-event" class="cta-button">Create Event</a>
          </p>
        </div>
        <div class="footer">
          <p>Thank you for being part of our verified community!</p>
          <p>© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate club verification rejected email
 * @param {string} clubName - Club's name
 * @param {string} reason - Rejection reason
 * @returns {string} HTML email template
 */
const generateClubVerificationRejectedEmail = (clubName, reason = "") => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Club Verification Update - VerifiedSwingers</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 20px; }
        .notice { background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .help { background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; margin: 10px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e9ecef; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Club Verification Update</h1>
        </div>
        <div class="content">
          <div class="icon">📝</div>
          <h2>Hello ${clubName},</h2>
          <p>We've reviewed your club verification submission and need some additional information to complete the process.</p>
          
          <div class="notice">
            <h3>📌 What we need:</h3>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
            <p>Please ensure your verification documents are:</p>
            <ul style="text-align: left; margin: 0; padding-left: 20px;">
              <li>Valid business license</li>
              <li>Clear contact information</li>
              <li>Accurate club details</li>
              <li>Proper website and social media links</li>
            </ul>
          </div>
          
          <div class="help">
            <h3>💡 Need help?</h3>
            <p>If you have questions about the club verification process, please contact our support team. We're here to help!</p>
          </div>
          
          <p style="margin-top: 30px;">
            <a href="${
              process.env.FRONTEND_URL
            }/#/club/verification" class="cta-button">Resubmit Verification</a>
            <a href="mailto:support@verifiedswingers.com" class="cta-button">Contact Support</a>
          </p>
        </div>
        <div class="footer">
          <p>We appreciate your patience as we work to verify all clubs.</p>
          <p>© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate admin notification for new club verification submission
 * @param {string} clubName - Club's name
 * @param {string} clubId - Club's ID
 * @returns {string} HTML email template
 */
const generateAdminClubVerificationNotificationEmail = (clubName, clubId) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Club Verification Submission - Admin</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; }
        .content { padding: 40px 30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 20px; }
        .alert { background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 24px; font-weight: bold; margin: 10px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e9ecef; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏢 New Club Verification Submission</h1>
        </div>
        <div class="content">
          <div class="icon">📋</div>
          <h2>Admin Notification</h2>
          <p>A new club verification submission requires your review.</p>
          
          <div class="alert">
            <h3>📝 Submission Details:</h3>
            <p><strong>Club:</strong> ${clubName}</p>
            <p><strong>Club ID:</strong> ${clubId}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p>Please review the club verification submission in the admin panel.</p>
          
          <p style="margin-top: 30px;">
            <a href="${
              process.env.FRONTEND_URL
            }/#/admin/club-verifications" class="cta-button">Review Club Submission</a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated notification for admin users.</p>
          <p>© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate email to affiliate when referred user subscribes and they earn commission
 * @param {string} affiliateUsername - The affiliate's username
 * @param {string} referredUsername - The referred user who subscribed
 * @param {string} commissionAmount - The commission amount earned (in pounds, e.g., "5.00")
 */
const generateAffiliateSubscriptionCommissionEmail = (
  affiliateUsername,
  referredUsername,
  commissionAmount
) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Commission Earned - User Subscribed!</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#f4f4f4; margin:0; padding:0; color:#111827; }
        .container { max-width:600px; margin:24px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08); }
        .header { background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#fff; padding:32px 24px; text-align:center; }
        .content { padding:24px; }
        .money-highlight { background:linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border:2px solid #10b981; border-radius:12px; padding:24px; text-align:center; margin:20px 0; }
        .amount { font-size:48px; font-weight:800; color:#059669; margin:12px 0; }
        .info-card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin-top:16px; }
        .user-badge { display:inline-block; background:#10b981; color:#fff; padding:6px 12px; border-radius:9999px; font-size:14px; font-weight:600; }
        .cta { display:inline-block; margin-top:20px; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#fff; text-decoration:none; padding:12px 24px; border-radius:9999px; font-weight:600; box-shadow:0 4px 12px rgba(16,185,129,0.3); }
        .footer { padding:16px 24px; text-align:center; font-size:12px; color:#6b7280; border-top:1px solid #e5e7eb; background:#f9fafb; }
        .icon { font-size: 64px; margin-bottom: 12px; }
        .celebration { animation: bounce 1s ease-in-out; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon celebration">🎉💰</div>
          <h1 style="margin:0; font-size:28px;">You Earned a Commission!</h1>
        </div>
        <div class="content">
          <p style="font-size:16px;">Hi ${affiliateUsername},</p>
          <p style="font-size:16px;">Exciting news! Your referred user just subscribed to a premium plan.</p>
          
          <div class="money-highlight">
            <div style="color:#065f46; font-size:16px; font-weight:600; margin-bottom:8px;">
              💸 Commission Earned
            </div>
            <div class="amount">£${commissionAmount}</div>
            <div style="color:#059669; font-size:14px; margin-top:8px;">
              Added to your pending balance
            </div>
          </div>

          <div class="info-card">
            <div style="margin-bottom:12px;">
              <span style="color:#6b7280; font-size:14px;">Referred User:</span><br/>
              <span class="user-badge">${referredUsername}</span>
            </div>
            <div style="color:#374151; font-size:14px; margin-top:8px;">
              ✅ Subscription Confirmed<br/>
              💳 Commission Status: <strong style="color:#10b981;">Pending</strong>
            </div>
          </div>

          <div class="info-card">
            <div style="font-weight:600; margin-bottom:8px; color:#111827;">📊 Your Earnings</div>
            <p style="margin:0; color:#374151; font-size:14px;">
              This commission has been added to your pending balance. Once your total pending balance reaches £10, you can withdraw it to your bank account.
            </p>
          </div>

          <div class="info-card" style="background:#fef3c7; border-color:#fbbf24;">
            <div style="font-weight:600; margin-bottom:8px; color:#92400e;">🚀 Keep Growing</div>
            <p style="margin:0; color:#92400e; font-size:14px;">
              Share your referral link with more people and earn £5 for each subscription. The more you share, the more you earn!
            </p>
          </div>

          <div style="text-align:center;">
            <a class="cta" href="${
              process.env.FRONTEND_URL
            }/#/affiliate">View Your Dashboard</a>
          </div>
        </div>
        <div class="footer">
          <p style="margin:4px 0;">Keep up the great work! 🌟</p>
          <p style="margin:4px 0;">© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate email to affiliate when someone signs up using their referral code
 * @param {string} affiliateUsername - The affiliate's username
 * @param {string} newUserUsername - The new user who signed up
 * @param {string} referralCode - The referral code used
 */
const generateAffiliateNewSignupEmail = (
  affiliateUsername,
  newUserUsername,
  referralCode
) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>New User Signed Up Using Your Referral Code</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#f4f4f4; margin:0; padding:0; color:#111827; }
        .container { max-width:600px; margin:24px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08); }
        .header { background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color:#fff; padding:24px; text-align:center; }
        .content { padding:24px; }
        .highlight { background:#dbeafe; border:1px solid #93c5fd; border-radius:10px; padding:16px; margin:16px 0; }
        .info-card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin-top:16px; }
        .cta { display:inline-block; margin-top:16px; background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color:#fff; text-decoration:none; padding:10px 18px; border-radius:9999px; font-weight:600; }
        .footer { padding:16px 24px; text-align:center; font-size:12px; color:#6b7280; border-top:1px solid #e5e7eb; background:#f9fafb; }
        .icon { font-size: 48px; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">👤</div>
          <h1>New Referral Signup!</h1>
        </div>
        <div class="content">
          <p>Hi ${affiliateUsername},</p>
          <p>Great news! A new user has signed up using your referral code.</p>
          
          <div class="highlight">
            <div style="font-weight:700; font-size:18px; color:#1d4ed8; margin-bottom:8px;">
              ${newUserUsername}
            </div>
            <div style="color:#374151; font-size:14px;">
              Just joined using code: <span style="font-weight:600;">${referralCode}</span>
            </div>
          </div>

          <div class="info-card">
            <div style="font-weight:600; margin-bottom:8px; color:#111827;">💰 Earning Potential</div>
            <p style="margin:0; color:#374151; font-size:14px;">
              You'll earn <strong>£5.00</strong> when ${newUserUsername} subscribes to a premium plan!
            </p>
          </div>

          <div class="info-card">
            <div style="font-weight:600; margin-bottom:8px; color:#111827;">📊 Track Your Progress</div>
            <p style="margin:0; color:#374151; font-size:14px;">
              Check your affiliate dashboard to see all your referrals and earnings in real-time.
            </p>
          </div>

          <a class="cta" href="${
            process.env.FRONTEND_URL
          }/#/affiliate">View Dashboard</a>
        </div>
        <div class="footer">
          <p>Keep sharing your referral link to earn more!</p>
          <p>© ${new Date().getFullYear()} VerifiedSwingers. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate welcome email for referred user
 * @param {string} username - The new user's username
 * @param {string} referrerUsername - The username of the person who referred them (optional)
 */
const generateReferredUserWelcomeEmail = (username, referrerUsername) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Welcome to VerifiedSwingers</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background:#f4f4f4; margin:0; padding:0; color:#111827; }
        .container { max-width:600px; margin:24px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,0.08); }
        .header { background:linear-gradient(135deg, #eacd48 0%, #fbbf24 100%); color:#111827; padding:24px; text-align:center; }
        .content { padding:24px; }
        .highlight { background:#fef3c7; border:1px solid #fde68a; border-radius:10px; padding:16px; margin:16px 0; text-align:center; }
        .card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin-top:16px; }
        .cta { display:inline-block; margin-top:16px; background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color:#fff; text-decoration:none; padding:12px 24px; border-radius:9999px; font-weight:600; }
        .footer { padding:16px 24px; text-align:center; font-size:12px; color:#6b7280; border-top:1px solid #e5e7eb; background:#f9fafb; }
        .icon { font-size: 56px; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">🎉</div>
          <h1>Welcome to VerifiedSwingers!</h1>
        </div>
        <div class="content">
          <p>Hi ${username},</p>
          ${
            referrerUsername
              ? `<div class="highlight">
            <div style="font-size:16px; font-weight:600; margin-bottom:8px;">
              You were referred by ${referrerUsername}
            </div>
            <div style="font-size:14px; color:#92400e;">
              Thanks for joining through their recommendation!
            </div>
          </div>`
              : ""
          }
          
          <p>Welcome to our community! We're excited to have you here.</p>

          <div class="card">
            <div style="font-weight:600; margin-bottom:8px; color:#111827;">✨ Get Started</div>
            <ul style="margin:8px 0; padding-left:20px; color:#374151; font-size:14px;">
              <li>Complete your profile to connect with others</li>
              <li>Browse verified members in your area</li>
              <li>Join events and meets near you</li>
              <li>Engage with the community</li>
            </ul>
          </div>

          <div class="card">
            <div style="font-weight:600; margin-bottom:8px; color:#111827;">🌟 Upgrade to Premium</div>
            <p style="margin:0; color:#374151; font-size:14px;">
              Unlock unlimited messaging, see who viewed your profile, and access exclusive features with a Gold Supporter subscription.
            </p>
          </div>

          <a class="cta" href="${
            process.env.FRONTEND_URL
          }/#/dashboard">Start Exploring</a>
        </div>
        <div class="footer">
          <p>Need help? Contact our support team anytime.</p>
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
  generateVerificationSubmittedEmail,
  generateVerificationApprovedEmail,
  generateVerificationRejectedEmail,
  generateAdminVerificationNotificationEmail,
  generateClubVerificationSubmittedEmail,
  generateClubVerificationApprovedEmail,
  generateClubVerificationRejectedEmail,
  generateAdminClubVerificationNotificationEmail,
  generateAffiliateRegistrationEmail,
  generateNewReferralCommissionEarnedEmail,
  generateAffiliateCommissionPayoutEmail,
  generateAffiliateNewSignupEmail,
  generateReferredUserWelcomeEmail,
  generateAffiliateSubscriptionCommissionEmail,
};
