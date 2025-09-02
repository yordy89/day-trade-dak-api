import * as puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';

export class PdfGenerator {
  private static getBrowserPath(): string | undefined {
    try {
      // Try to find Chrome/Chromium executable
      const possiblePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
        '/usr/bin/google-chrome', // Linux
        '/usr/bin/chromium-browser', // Linux
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', // Windows
      ];

      for (const path of possiblePaths) {
        try {
          // Check if path exists
          execSync(`ls "${path}" 2>/dev/null || dir "${path}" 2>nul`, { stdio: 'pipe' });
          return path;
        } catch {
          // Path doesn't exist, continue
        }
      }
    } catch {
      // Fallback to undefined
    }
    return undefined;
  }

  static async generatePdfFromHtml(html: string): Promise<Buffer> {
    let browser = null;
    
    try {
      const browserPath = this.getBrowserPath();
      
      if (!browserPath) {
        // If no browser found, return HTML as fallback
        console.warn('No Chrome/Chromium browser found for PDF generation');
        return Buffer.from(html);
      }

      browser = await puppeteer.launch({
        executablePath: browserPath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      });

      return pdf;
    } catch (error) {
      console.error('PDF generation error:', error);
      // Fallback to returning HTML
      return Buffer.from(html);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  static generateHtmlForUsersExport(headers: string[], rows: any[][], totalUsers: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            line-height: 1.6;
            padding: 20px;
          }
          
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #16a34a;
          }
          
          .header h1 {
            color: #16a34a;
            margin-bottom: 10px;
            font-size: 28px;
          }
          
          .header .info {
            color: #666;
            font-size: 14px;
          }
          
          .summary {
            background-color: #f5f5f5;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
            display: flex;
            justify-content: space-around;
          }
          
          .summary-item {
            text-align: center;
          }
          
          .summary-item .value {
            font-size: 24px;
            font-weight: bold;
            color: #16a34a;
          }
          
          .summary-item .label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
          }
          
          thead {
            background-color: #16a34a;
            color: white;
          }
          
          th {
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
            white-space: nowrap;
          }
          
          td {
            padding: 10px 8px;
            border-bottom: 1px solid #e0e0e0;
          }
          
          tbody tr:hover {
            background-color: #f9f9f9;
          }
          
          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          
          .footer .brand {
            font-weight: bold;
            color: #16a34a;
          }
          
          @media print {
            body {
              padding: 0;
            }
            
            .header {
              margin-bottom: 20px;
            }
            
            table {
              font-size: 10px;
            }
            
            th, td {
              padding: 6px 4px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>DayTradeDak Users Export</h1>
          <div class="info">
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
        </div>
        
        <div class="summary">
          <div class="summary-item">
            <div class="value">${totalUsers}</div>
            <div class="label">Total Users</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell || '-'}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p><span class="brand">DayTradeDak Admin</span> - Users Export Report</p>
          <p>© ${new Date().getFullYear()} DayTradeDak. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
  }
}