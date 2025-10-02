// Email templates for VerifiedSwingers

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

module.exports = {
  generatePasswordResetEmail,
  generateWelcomeEmail,
  generateEmailVerificationEmail,
};
