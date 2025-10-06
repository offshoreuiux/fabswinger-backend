# Email Configuration Setup

## For Production (Render.com)

### Option 1: Gmail with App Password (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. **Set Environment Variables on Render**:
   ```
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-16-character-app-password
   ```

### Option 2: Mailtrap (For Testing)

1. **Sign up at Mailtrap.io**
2. **Get credentials** from your inbox
3. **Set Environment Variables on Render**:
   ```
   MAILTRAP_HOST=smtp.mailtrap.io
   MAILTRAP_PORT=2525
   MAILTRAP_USER=your-mailtrap-username
   MAILTRAP_PASS=your-mailtrap-password
   ```

### Option 3: Custom SMTP

1. **Use your hosting provider's SMTP** or a service like SendGrid
2. **Set Environment Variables on Render**:
   ```
   SMTP_HOST=your-smtp-host
   SMTP_PORT=587
   SMTP_USER=your-smtp-username
   SMTP_PASS=your-smtp-password
   ```

## Environment Variables Priority

The system will try configurations in this order:

1. Gmail with App Password (most reliable)
2. Gmail SMTP
3. Mailtrap (for testing)
4. Custom SMTP

## Testing

After setting up environment variables:

1. Deploy to Render
2. Check the logs for "Email server is ready to send messages"
3. Test the forgot password functionality

## Troubleshooting

- **Connection timeout**: Check if SMTP host/port are correct
- **Authentication failed**: Verify username/password
- **Gmail issues**: Make sure you're using App Password, not regular password
- **No email sent**: Check if all required environment variables are set

