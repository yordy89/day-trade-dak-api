// Test script to verify tracking is added when sending emails
const mongoose = require('mongoose');
require('dotenv').config();

// Import the campaign service functions
function addEmailTracking(htmlContent, campaignId, recipientEmail) {
  const apiUrl = process.env.API_URL || 'http://localhost:4000';
  const baseUrl = `${apiUrl}/api/v1`;
  const encodedEmail = encodeURIComponent(recipientEmail);
  
  console.log(`Adding tracking for: ${recipientEmail}`);
  console.log(`Base URL: ${baseUrl}`);
  
  // Add tracking pixel
  const trackingPixel = `<img src="${baseUrl}/email-marketing/tracking/open/${campaignId}/${encodedEmail}.png" width="1" height="1" style="display:block;border:0;" alt="" />`;
  
  let trackedContent = htmlContent;
  if (htmlContent.includes('</body>')) {
    trackedContent = htmlContent.replace('</body>', `${trackingPixel}</body>`);
  } else {
    trackedContent = htmlContent + trackingPixel;
  }
  
  // Wrap links for click tracking
  let linkCount = 0;
  trackedContent = trackedContent.replace(
    /href="([^"]+)"/g,
    (match, url) => {
      if (url.includes('unsubscribe') || url.includes('/tracking/') || url.startsWith('mailto:')) {
        return match;
      }
      
      const encodedUrl = encodeURIComponent(url);
      const linkId = Buffer.from(url).toString('base64').substring(0, 10);
      const trackedUrl = `${baseUrl}/email-marketing/tracking/click/${campaignId}/${encodedEmail}?url=${encodedUrl}&linkId=${linkId}`;
      
      linkCount++;
      console.log(`  Tracking link #${linkCount}: ${url}`);
      
      return `href="${trackedUrl}"`;
    }
  );
  
  // Add unsubscribe link
  if (!trackedContent.includes('unsubscribe')) {
    const unsubscribeUrl = `${baseUrl}/email-marketing/tracking/unsubscribe/${campaignId}/${encodedEmail}`;
    const unsubscribeLink = `<div style="text-align:center;margin-top:20px;font-size:12px;color:#666;">
      <a href="${unsubscribeUrl}" style="color:#666;text-decoration:underline;">Unsubscribe</a>
    </div>`;
    
    if (trackedContent.includes('</body>')) {
      trackedContent = trackedContent.replace('</body>', `${unsubscribeLink}</body>`);
    } else {
      trackedContent = trackedContent + unsubscribeLink;
    }
  }
  
  return trackedContent;
}

async function testTracking() {
  try {
    // Sample HTML content
    const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Test Email</title>
</head>
<body>
  <h1>Test Campaign</h1>
  <p>This is a test email with tracking.</p>
  <a href="https://daytradedak.com">Visit our website</a>
  <a href="https://daytradedak.com/register">Register now</a>
  <a href="mailto:support@daytradedak.com">Contact us</a>
</body>
</html>`;

    const campaignId = 'test-campaign-123';
    const recipientEmail = 'test@example.com';
    
    console.log('📧 Original HTML:');
    console.log('-------------------');
    console.log(sampleHtml);
    console.log('\n');
    
    console.log('🔧 Adding tracking...\n');
    const trackedHtml = addEmailTracking(sampleHtml, campaignId, recipientEmail);
    
    console.log('✅ Tracked HTML:');
    console.log('-------------------');
    console.log(trackedHtml);
    console.log('\n');
    
    // Verify tracking elements
    console.log('🔍 Verification:');
    const hasPixel = trackedHtml.includes('/email-marketing/tracking/open/');
    const hasTrackedLinks = trackedHtml.includes('/email-marketing/tracking/click/');
    const hasUnsubscribe = trackedHtml.includes('/email-marketing/tracking/unsubscribe/');
    
    console.log(`  • Has tracking pixel: ${hasPixel ? '✅' : '❌'}`);
    console.log(`  • Has tracked links: ${hasTrackedLinks ? '✅' : '❌'}`);
    console.log(`  • Has unsubscribe: ${hasUnsubscribe ? '✅' : '❌'}`);
    
    // Extract and display tracking URLs
    if (hasPixel) {
      const pixelMatch = trackedHtml.match(/<img[^>]*src="([^"]*tracking\/open[^"]+)"/);
      if (pixelMatch) {
        console.log(`\n📍 Tracking pixel URL:\n  ${pixelMatch[1]}`);
      }
    }
    
    if (hasTrackedLinks) {
      const linkMatches = trackedHtml.match(/href="([^"]*tracking\/click[^"]+)"/g);
      if (linkMatches) {
        console.log(`\n🔗 Tracked links (${linkMatches.length}):`);
        linkMatches.forEach((match, i) => {
          const url = match.match(/href="([^"]+)"/)[1];
          // Decode the target URL
          const targetMatch = url.match(/url=([^&]+)/);
          if (targetMatch) {
            const targetUrl = decodeURIComponent(targetMatch[1]);
            console.log(`  ${i + 1}. ${targetUrl}`);
            console.log(`     -> ${url.substring(0, 80)}...`);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTracking();