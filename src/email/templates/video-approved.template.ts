export interface VideoApprovedData {
  recipientName: string;
  videoTitle: string;
  approvedBy: string;
  approvalDate: string;
  publishStatus: 'published' | 'scheduled' | 'draft';
  publishDate?: string;
  finalVersion: number;
  viewUrl: string;
  dashboardUrl: string;
  reviewNotes?: string;
}

export const videoApprovedTemplate = (data: VideoApprovedData): string => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Video Approved - DayTradeDak</title>
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
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
        .success-banner {
          background-color: #d1fae5;
          border: 2px solid #10b981;
          border-radius: 10px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
        }
        .success-icon {
          width: 60px;
          height: 60px;
          margin: 0 auto 15px;
          background-color: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .video-info {
          background-color: #f0fdf4;
          border-left: 4px solid #10b981;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .video-info h2 {
          color: #065f46;
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
        .status-badge {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .status-published {
          background-color: #10b981;
          color: white;
        }
        .status-scheduled {
          background-color: #f59e0b;
          color: white;
        }
        .status-draft {
          background-color: #6b7280;
          color: white;
        }
        .notes-section {
          background-color: #eff6ff;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 3px solid #3b82f6;
        }
        .notes-section h3 {
          color: #1e3a8a;
          margin-top: 0;
          font-size: 16px;
        }
        .celebration {
          text-align: center;
          padding: 20px;
          background-color: #fef3c7;
          border-radius: 10px;
          margin: 20px 0;
        }
        .celebration h3 {
          color: #92400e;
          margin-top: 0;
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
          background-color: #10b981;
          color: white;
        }
        .btn-primary:hover {
          background-color: #059669;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
        }
        .btn-secondary {
          background-color: #6366f1;
          color: white;
        }
        .btn-secondary:hover {
          background-color: #4f46e5;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(99, 102, 241, 0.4);
        }
        .footer {
          background-color: #f7f7f7;
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        .footer a {
          color: #10b981;
          text-decoration: none;
        }
        .checkmark {
          width: 40px;
          height: 40px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        .stat-card {
          background-color: #f9fafb;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #10b981;
        }
        .stat-label {
          font-size: 12px;
          color: #6b7280;
          margin-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Video Approved!</h1>
          <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Congratulations!</p>
        </div>
        
        <div class="content">
          <div class="success-banner">
            <div class="success-icon">
              <svg class="checkmark" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12L11 14L15 10" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2 style="color: #065f46; margin: 0;">Your Video Has Been Approved!</h2>
            <p style="color: #047857; margin: 10px 0 0;">Great work on creating quality content</p>
          </div>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Hello <strong>${data.recipientName}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Excellent news! Your video has been reviewed and approved. ${
              data.publishStatus === 'published' 
                ? 'It is now live and available to viewers.' 
                : data.publishStatus === 'scheduled'
                ? `It is scheduled to be published on ${data.publishDate}.`
                : 'It has been saved as a draft for future publishing.'
            }
          </p>
          
          <div class="video-info">
            <h2>📹 ${data.videoTitle}</h2>
            <div class="info-row">
              <span class="info-label">Approved by:</span>
              <span class="info-value">${data.approvedBy}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Approval Date:</span>
              <span class="info-value">${data.approvalDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Final Version:</span>
              <span class="info-value">Version ${data.finalVersion}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value">
                <span class="status-badge status-${data.publishStatus}">${data.publishStatus}</span>
              </span>
            </div>
            ${data.publishDate && data.publishStatus === 'scheduled' ? `
            <div class="info-row">
              <span class="info-label">Publish Date:</span>
              <span class="info-value">${data.publishDate}</span>
            </div>
            ` : ''}
          </div>
          
          ${data.reviewNotes ? `
          <div class="notes-section">
            <h3>💬 Reviewer's Feedback:</h3>
            <p style="color: #1e3a8a; margin: 0; line-height: 1.6;">${data.reviewNotes}</p>
          </div>
          ` : ''}
          
          <div class="celebration">
            <h3>🏆 Achievement Unlocked!</h3>
            <p style="color: #78350f; margin: 10px 0;">
              Your content has passed quality review and contributes to our platform's excellence.
            </p>
          </div>
          
          <div class="action-buttons">
            ${data.publishStatus === 'published' ? `
              <a href="${data.viewUrl}" class="btn btn-primary">View Live Video</a>
            ` : ''}
            <a href="${data.dashboardUrl}" class="btn btn-secondary">Go to Dashboard</a>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">✅</div>
              <div class="stat-label">Approved</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.finalVersion}</div>
              <div class="stat-label">Versions Created</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">100%</div>
              <div class="stat-label">Quality Score</div>
            </div>
          </div>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6; margin-top: 20px; background-color: #f3f4f6; padding: 15px; border-radius: 5px;">
            <strong>What's Next?</strong><br>
            ${data.publishStatus === 'published' ? `
              • Your video is now live and accessible to viewers<br>
              • Monitor analytics and engagement in your dashboard<br>
              • Consider creating related content to build on this success
            ` : data.publishStatus === 'scheduled' ? `
              • Your video will automatically publish on ${data.publishDate}<br>
              • You'll receive a notification when it goes live<br>
              • Use this time to prepare promotional materials
            ` : `
              • Your video is saved as a draft<br>
              • You can publish it anytime from your dashboard<br>
              • Consider scheduling it for optimal viewer engagement
            `}
          </p>
        </div>
        
        <div class="footer">
          <p>Keep up the great work! Your content makes a difference.</p>
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