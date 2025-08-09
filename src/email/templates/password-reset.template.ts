export interface PasswordResetData {
  name: string;
  email: string;
  resetLink: string;
  expiresIn: string;
}

export const passwordResetTemplate = (data: PasswordResetData): string => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password - DayTradeDak</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f2f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700;">DayTradeDak</h1>
                  <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Password Reset Request</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <!-- Lock Icon -->
                  <div style="text-align: center; margin-bottom: 30px;">
                    <div style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-radius: 50%; padding: 20px;">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zM9 7c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7zm4 10.723V19h-2v-1.277c-.595-.346-1-.984-1-1.723 0-1.103.897-2 2-2s2 .897 2 2c0 .739-.405 1.377-1 1.723z" fill="white"/>
                      </svg>
                    </div>
                  </div>

                  <!-- Greeting -->
                  <h2 style="color: #1f2937; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                    Hello ${data.name}!
                  </h2>

                  <!-- Message -->
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0; text-align: center;">
                    We received a request to reset your password for your DayTradeDak account. If you didn't make this request, you can safely ignore this email.
                  </p>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin: 40px 0;">
                    <a href="${data.resetLink}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 6px rgba(22, 163, 74, 0.3);">
                      Reset My Password
                    </a>
                  </div>

                  <!-- Alternative Link -->
                  <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 30px 0;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                      <strong>Can't click the button?</strong> Copy and paste this link into your browser:
                    </p>
                    <p style="color: #3b82f6; font-size: 14px; word-break: break-all; margin: 0;">
                      ${data.resetLink}
                    </p>
                  </div>

                  <!-- Security Notice -->
                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin: 30px 0;">
                    <p style="color: #92400e; font-size: 14px; margin: 0;">
                      <strong>⏰ This link will expire in ${data.expiresIn}</strong><br>
                      For security reasons, this password reset link will only work for a limited time.
                    </p>
                  </div>

                  <!-- Additional Info -->
                  <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                    <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0;">
                      Why did I receive this email?
                    </h3>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                      Someone requested a password reset for the DayTradeDak account associated with ${data.email}. If this wasn't you, please ignore this email and your password will remain unchanged.
                    </p>

                    <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0;">
                      Need help?
                    </h3>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                      If you're having trouble resetting your password, please contact our support team at 
                      <a href="mailto:support@daytradedak.com" style="color: #16a34a; text-decoration: none;">support@daytradedak.com</a>
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                    © 2024 DayTradeDak. All rights reserved.
                  </p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    Trading education platform | Learn • Practice • Succeed
                  </p>
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