export interface VideoRejectedData {
  recipientName: string;
  videoTitle: string;
  rejectedBy: string;
  rejectionDate: string;
  rejectionReason: string;
  suggestions?: string;
  currentVersion: number;
  editUrl: string;
  dashboardUrl: string;
  supportUrl: string;
}

export const videoRejectedTemplate = (data: VideoRejectedData): string => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Video Needs Revision - DayTradeDak</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f4f7fc;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          padding: 30px;
        }
        .revision-banner {
          background-color: #fef3c7;
          border: 2px solid #f59e0b;
          border-radius: 10px;
          padding: 20px;
          margin: 20px 0;
        }
        .revision-icon {
          width: 60px;
          height: 60px;
          margin: 0 auto 15px;
          background-color: #f59e0b;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .video-info {
          background-color: #fffbeb;
          border-left: 4px solid #f59e0b;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .video-info h2 {
          color: #92400e;
          margin-top: 0;
          font-size: 20px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e0e0e0;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: bold;
          color: #666;
        }
        .info-value {
          color: #333;
        }
        .reason-section {
          background-color: #fef2f2;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 4px solid #ef4444;
        }
        .reason-section h3 {
          color: #991b1b;
          margin-top: 0;
          font-size: 18px;
        }
        .reason-content {
          color: #7f1d1d;
          line-height: 1.6;
          margin: 10px 0;
        }
        .suggestions-section {
          background-color: #f0fdf4;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 4px solid #10b981;
        }
        .suggestions-section h3 {
          color: #064e3b;
          margin-top: 0;
          font-size: 18px;
        }
        .suggestions-content {
          color: #065f46;
          line-height: 1.6;
        }
        .suggestions-content ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .suggestions-content li {
          margin: 5px 0;
        }
        .action-buttons {
          text-align: center;
          margin: 30px 0;
        }
        .btn {
          display: inline-block;
          padding: 12px 30px;
          margin: 10px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          font-size: 16px;
          transition: all 0.3s;
        }
        .btn-primary {
          background-color: #f59e0b;
          color: white;
        }
        .btn-primary:hover {
          background-color: #d97706;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(245, 158, 11, 0.4);
        }
        .btn-secondary {
          background-color: #6b7280;
          color: white;
        }
        .btn-secondary:hover {
          background-color: #4b5563;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(107, 114, 128, 0.4);
        }
        .btn-tertiary {
          background-color: #3b82f6;
          color: white;
        }
        .btn-tertiary:hover {
          background-color: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
        }
        .footer {
          background-color: #f7f7f7;
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        .footer a {
          color: #f59e0b;
          text-decoration: none;
        }
        .encouragement {
          background-color: #eff6ff;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
          text-align: center;
        }
        .encouragement h3 {
          color: #1e3a8a;
          margin-top: 0;
        }
        .encouragement p {
          color: #3730a3;
          line-height: 1.6;
        }
        .revision-icon svg {
          width: 35px;
          height: 35px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Video Needs Revision</h1>
          <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Additional edits required</p>
        </div>
        
        <div class="content">
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Hello <strong>${data.recipientName}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Thank you for your submission. After careful review, your video requires some revisions before it can be approved for publishing.
          </p>
          
          <div class="revision-banner">
            <div class="revision-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 4H7C5.89543 4 5 4.89543 5 6V18C5 19.1046 5.89543 20 7 20H17C18.1046 20 19 19.1046 19 18V14" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <path d="M16.5 2.5L21.5 7.5L12 17L7 18L8 13L16.5 2.5Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2 style="color: #92400e; margin: 0; text-align: center;">Revisions Requested</h2>
            <p style="color: #78350f; margin: 10px 0 0; text-align: center;">
              Please review the feedback below and resubmit
            </p>
          </div>
          
          <div class="video-info">
            <h2>📹 ${data.videoTitle}</h2>
            <div class="info-row">
              <span class="info-label">Reviewed by:</span>
              <span class="info-value">${data.rejectedBy}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Review Date:</span>
              <span class="info-value">${data.rejectionDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Current Version:</span>
              <span class="info-value">Version ${data.currentVersion}</span>
            </div>
          </div>
          
          <div class="reason-section">
            <h3>❌ Reason for Revision:</h3>
            <div class="reason-content">
              ${data.rejectionReason.split('\n').map(line => `<p style="margin: 5px 0;">${line}</p>`).join('')}
            </div>
          </div>
          
          ${data.suggestions ? `
          <div class="suggestions-section">
            <h3>💡 Suggestions for Improvement:</h3>
            <div class="suggestions-content">
              ${data.suggestions}
            </div>
          </div>
          ` : ''}
          
          <div class="encouragement">
            <h3>💪 Don't Give Up!</h3>
            <p>
              Quality content takes time and iteration. Your dedication to improvement is what makes our platform exceptional. 
              We're here to support you through the revision process.
            </p>
          </div>
          
          <div class="action-buttons">
            <a href="${data.editUrl}" class="btn btn-primary">Edit Video</a>
            <a href="${data.dashboardUrl}" class="btn btn-secondary">View Dashboard</a>
            <a href="${data.supportUrl}" class="btn btn-tertiary">Get Help</a>
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #111827; margin-top: 0; font-size: 16px;">📋 Next Steps:</h3>
            <ol style="color: #4b5563; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
              <li>Review the feedback carefully</li>
              <li>Make the requested revisions</li>
              <li>Upload the revised version (it will be Version ${data.currentVersion + 1})</li>
              <li>The reviewer will be notified automatically</li>
            </ol>
          </div>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6; margin-top: 20px;">
            <strong>Need assistance?</strong> Our support team is ready to help you with any questions about the revision process. 
            Don't hesitate to reach out if you need clarification on the feedback.
          </p>
        </div>
        
        <div class="footer">
          <p>Your commitment to quality is appreciated. We look forward to your revised submission!</p>
          <p>Need help? <a href="mailto:support@daytradedak.com">Contact Support</a></p>
          <p style="margin-top: 15px; font-size: 12px; color: #999;">
            © 2025 DayTradeDak. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};