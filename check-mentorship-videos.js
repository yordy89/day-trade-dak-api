const AWS = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new AWS.S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function listMentorshipVideos() {
  let allContents = [];
  let continuationToken;
  
  do {
    const command = new AWS.ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Prefix: 'hsl-daytradedak-videos/mentorias/',
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });
    
    try {
      const response = await s3Client.send(command);
      if (response.Contents) {
        allContents = [...allContents, ...response.Contents];
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } catch (error) {
      console.error('Error:', error.message);
      break;
    }
  } while (continuationToken);
  
  console.log('Total objects found:', allContents.length);
  
  // Group by folder
  const folders = {};
  allContents.forEach(obj => {
    const parts = obj.Key.split('/');
    if (parts.length >= 3) {
      const folder = parts[2]; // Get the mentoria folder name
      if (!folders[folder]) folders[folder] = [];
      folders[folder].push(obj.Key);
    }
  });
  
  console.log('\nUnique mentoria folders found:', Object.keys(folders).length);
  console.log('\nAll mentoria folders:');
  Object.keys(folders).sort().forEach(folder => {
    const hasM3u8 = folders[folder].some(file => file.includes('.m3u8'));
    const hasMaster = folders[folder].some(file => file.includes('master.m3u8'));
    console.log(`  - ${folder} (${folders[folder].length} files, m3u8: ${hasM3u8}, master: ${hasMaster})`);
  });
  
  // Check master.m3u8 files
  const masterFiles = allContents.filter(obj => obj.Key.includes('master.m3u8'));
  console.log('\nmaster.m3u8 files found:', masterFiles.length);
  
  // Check playlist.m3u8 files 
  const playlistFiles = allContents.filter(obj => obj.Key.includes('playlist.m3u8'));
  console.log('playlist.m3u8 files found:', playlistFiles.length);
  
  // Filter videos like the service does
  const videoFiles = allContents.filter(
    (file) =>
      file.Key &&
      !file.Key.endsWith('/') &&
      (file.Key.endsWith('.mp4') || file.Key.endsWith('.mov') || file.Key.endsWith('.m3u8'))
  );
  
  console.log('\nTotal video files (mp4/mov/m3u8):', videoFiles.length);
  
  // Show what the API is returning
  const m3u8Files = videoFiles.filter(f => f.Key.endsWith('.m3u8'));
  console.log('\nTotal .m3u8 files:', m3u8Files.length);
  console.log('\nSample of returned videos:');
  m3u8Files.slice(0, 10).forEach(file => {
    console.log(`  - ${file.Key} (${file.Size} bytes)`);
  });
}

listMentorshipVideos();