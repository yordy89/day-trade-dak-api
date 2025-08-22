export interface VideoEditedData {
  recipientName: string;
  videoTitle: string;
  editedBy: string;
  originalUploader: string;
  versionNumber: number;
  editNotes?: string;
  changes?: string;
  downloadUrl: string;
  compareUrl: string;
  dashboardUrl: string;
}

export const videoEditedTemplate = (data: VideoEditedData): string => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Video Edited - Ready for Review</title>
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
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
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
        .video-info {
          background-color: #f0fff4;
          border-left: 4px solid #48bb78;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .video-info h2 {
          color: #2f855a;
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
        .version-badge {
          display: inline-block;
          background-color: #48bb78;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: bold;
        }
        .notes-section {
          background-color: #e6fffa;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 3px solid #319795;
        }
        .notes-section h3 {
          color: #234e52;
          margin-top: 0;
          font-size: 16px;
        }
        .changes-section {
          background-color: #fef5e7;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 3px solid #f6ad55;
        }
        .changes-section h3 {
          color: #744210;
          margin-top: 0;
          font-size: 16px;
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
          background-color: #48bb78;
          color: white;
        }
        .btn-primary:hover {
          background-color: #38a169;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(72, 187, 120, 0.4);
        }
        .btn-secondary {
          background-color: #4299e1;
          color: white;
        }
        .btn-secondary:hover {
          background-color: #3182ce;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(66, 153, 225, 0.4);
        }
        .btn-tertiary {
          background-color: #805ad5;
          color: white;
        }
        .btn-tertiary:hover {
          background-color: #6b46c1;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(128, 90, 213, 0.4);
        }
        .footer {
          background-color: #f7f7f7;
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        .footer a {
          color: #48bb78;
          text-decoration: none;
        }
        .icon {
          width: 50px;
          height: 50px;
          margin: 0 auto 20px;
        }
        .timeline {
          margin: 20px 0;
          padding: 15px;
          background-color: #f8f9fa;
          border-radius: 5px;
        }
        .timeline-item {
          display: flex;
          align-items: center;
          margin: 10px 0;
        }
        .timeline-icon {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background-color: #48bb78;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 15px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7V12C2 16.5 4.23 20.68 7.62 23.15L12 24L16.38 23.15C19.77 20.68 22 16.5 22 12V7L12 2Z" fill="white" opacity="0.3"/>
              <path d="M9 12L11 14L15 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1>Video Edited Successfully</h1>
          <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Ready for Review</p>
        </div>
        
        <div class="content">
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Hello <strong>${data.recipientName}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            The video has been edited and is now ready for your review and approval.
          </p>
          
          <div class="video-info">
            <h2>✏️ ${data.videoTitle} <span class="version-badge">Version ${data.versionNumber}</span></h2>
            <div class="info-row">
              <span class="info-label">Edited by:</span>
              <span class="info-value">${data.editedBy}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Original uploader:</span>
              <span class="info-value">${data.originalUploader}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Version:</span>
              <span class="info-value">${data.versionNumber} (Edited)</span>
            </div>
          </div>
          
          ${data.editNotes ? `
          <div class="notes-section">
            <h3>✍️ Editor's Notes:</h3>
            <p style="color: #234e52; margin: 0; line-height: 1.6;">${data.editNotes}</p>
          </div>
          ` : ''}
          
          ${data.changes ? `
          <div class="changes-section">
            <h3>🔄 Changes Made:</h3>
            <p style="color: #744210; margin: 0; line-height: 1.6;">${data.changes}</p>
          </div>
          ` : ''}
          
          <div class="timeline">
            <h3 style="color: #333; margin-top: 0; font-size: 16px;">📊 Video Timeline:</h3>
            <div class="timeline-item">
              <div class="timeline-icon">1</div>
              <span>Original video uploaded by ${data.originalUploader}</span>
            </div>
            <div class="timeline-item">
              <div class="timeline-icon">2</div>
              <span>Video edited by ${data.editedBy}</span>
            </div>
            <div class="timeline-item">
              <div class="timeline-icon" style="background-color: #ed8936;">3</div>
              <span><strong>Awaiting your review</strong></span>
            </div>
          </div>
          
          <div class="action-buttons">
            <a href="${data.compareUrl}" class="btn btn-primary">Review Changes</a>
            <a href="${data.downloadUrl}" class="btn btn-secondary">Download Edited</a>
            <a href="${data.dashboardUrl}" class="btn btn-tertiary">Approve/Reject</a>
          </div>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6; margin-top: 20px;">
            <strong>Next Steps:</strong><br>
            1. Review the edited video and changes made<br>
            2. Compare with the original version if needed<br>
            3. Approve for publishing or request additional edits<br>
            4. The uploader will be notified of your decision
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from DayTradeDak Content Management System.</p>
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