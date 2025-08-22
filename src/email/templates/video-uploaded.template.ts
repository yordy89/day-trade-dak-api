export interface VideoUploadedData {
  recipientName: string;
  videoTitle: string;
  uploadedBy: string;
  fileSize: string;
  duration?: string;
  editNotes?: string;
  downloadUrl: string;
  previewUrl: string;
  dashboardUrl: string;
}

export const videoUploadedTemplate = (data: VideoUploadedData): string => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Video Uploaded - DayTradeDak</title>
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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          background-color: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .video-info h2 {
          color: #333;
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
        .notes-section {
          background-color: #fff8dc;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .notes-section h3 {
          color: #d4a000;
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
          background-color: #667eea;
          color: white;
        }
        .btn-primary:hover {
          background-color: #5a67d8;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
        }
        .btn-secondary {
          background-color: #48bb78;
          color: white;
        }
        .btn-secondary:hover {
          background-color: #38a169;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(72, 187, 120, 0.4);
        }
        .btn-tertiary {
          background-color: #ed8936;
          color: white;
        }
        .btn-tertiary:hover {
          background-color: #dd6b20;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(237, 137, 54, 0.4);
        }
        .footer {
          background-color: #f7f7f7;
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        .footer a {
          color: #667eea;
          text-decoration: none;
        }
        .icon {
          width: 50px;
          height: 50px;
          margin: 0 auto 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4V20M17 4V20M3 8H7M17 8H21M3 16H7M17 16H21M3 4H21V20H3V4Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1>New Video Uploaded</h1>
          <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Action Required</p>
        </div>
        
        <div class="content">
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Hello <strong>${data.recipientName}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            A new video has been uploaded to the DayTradeDak platform and requires your attention.
          </p>
          
          <div class="video-info">
            <h2>📹 ${data.videoTitle}</h2>
            <div class="info-row">
              <span class="info-label">Uploaded by:</span>
              <span class="info-value">${data.uploadedBy}</span>
            </div>
            <div class="info-row">
              <span class="info-label">File Size:</span>
              <span class="info-value">${data.fileSize}</span>
            </div>
            ${data.duration ? `
            <div class="info-row">
              <span class="info-label">Duration:</span>
              <span class="info-value">${data.duration}</span>
            </div>
            ` : ''}
          </div>
          
          ${data.editNotes ? `
          <div class="notes-section">
            <h3>📝 Notes from Uploader:</h3>
            <p style="color: #666; margin: 0; line-height: 1.6;">${data.editNotes}</p>
          </div>
          ` : ''}
          
          <div class="action-buttons">
            <a href="${data.previewUrl}" class="btn btn-primary">Preview Video</a>
            <a href="${data.downloadUrl}" class="btn btn-secondary">Download Video</a>
            <a href="${data.dashboardUrl}" class="btn btn-tertiary">Open Dashboard</a>
          </div>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6; margin-top: 20px;">
            <strong>Next Steps:</strong><br>
            1. Review the uploaded video<br>
            2. Download if editing is required<br>
            3. Upload the edited version when complete<br>
            4. Update the workflow status in the dashboard
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