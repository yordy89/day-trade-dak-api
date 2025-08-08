const AWS = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new AWS.S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function debugS3Listing() {
  console.log('=== S3 Listing Debug ===\n');
  console.log('Environment variables:');
  console.log('- Bucket:', process.env.AWS_S3_BUCKET_NAME);
  console.log('- Mentorship folder:', process.env.AWS_S3_MENTORSHIP_FOLDER);
  console.log('- Region:', process.env.AWS_REGION);
  
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const prefix = process.env.AWS_S3_MENTORSHIP_FOLDER;
  
  console.log(`\nSearching in: ${bucketName}/${prefix}/\n`);
  
  let allContents = [];
  let continuationToken;
  let pageCount = 0;
  
  do {
    const command = new AWS.ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: `${prefix}/`,
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });
    
    try {
      console.log(`Fetching page ${pageCount + 1}...`);
      const response = await s3Client.send(command);
      
      console.log(`- IsTruncated: ${response.IsTruncated}`);
      console.log(`- KeyCount: ${response.KeyCount}`);
      console.log(`- Contents length: ${response.Contents?.length || 0}`);
      
      if (response.Contents) {
        allContents = [...allContents, ...response.Contents];
      }
      
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      pageCount++;
      
      if (pageCount > 20) {
        console.log('WARNING: Reached maximum page limit');
        break;
      }
    } catch (error) {
      console.error('Error fetching page:', error.message);
      break;
    }
  } while (continuationToken);
  
  console.log(`\n=== Summary ===`);
  console.log(`Total pages fetched: ${pageCount}`);
  console.log(`Total objects found: ${allContents.length}`);
  
  // Analyze by folder structure
  const folders = new Map();
  const m3u8Files = [];
  
  allContents.forEach(obj => {
    const parts = obj.Key.split('/');
    if (parts.length >= 3) {
      const mentoriaFolder = parts[2];
      if (!folders.has(mentoriaFolder)) {
        folders.set(mentoriaFolder, {
          totalFiles: 0,
          m3u8Files: [],
          masterFiles: [],
          playlistFiles: []
        });
      }
      
      const folderData = folders.get(mentoriaFolder);
      folderData.totalFiles++;
      
      if (obj.Key.endsWith('.m3u8')) {
        m3u8Files.push(obj.Key);
        folderData.m3u8Files.push(obj.Key);
        
        if (obj.Key.includes('master.m3u8')) {
          folderData.masterFiles.push(obj.Key);
        }
        if (obj.Key.includes('playlist.m3u8')) {
          folderData.playlistFiles.push(obj.Key);
        }
      }
    }
  });
  
  console.log(`\n=== Mentorship Folders Analysis ===`);
  console.log(`Unique mentorship folders: ${folders.size}`);
  
  const sortedFolders = Array.from(folders.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  sortedFolders.forEach(([folder, data]) => {
    console.log(`\n${folder}:`);
    console.log(`  - Total files: ${data.totalFiles}`);
    console.log(`  - .m3u8 files: ${data.m3u8Files.length}`);
    console.log(`  - master.m3u8 files: ${data.masterFiles.length}`);
    console.log(`  - playlist.m3u8 files: ${data.playlistFiles.length}`);
    
    if (data.masterFiles.length > 0) {
      console.log(`  - Master files:`);
      data.masterFiles.forEach(f => console.log(`    • ${f}`));
    }
  });
  
  // Check what the API filter would return
  console.log(`\n=== API Filter Simulation ===`);
  
  // Original filter (video files)
  const videoFiles = allContents.filter(
    (file) =>
      file.Key &&
      !file.Key.endsWith('/') &&
      (file.Key.endsWith('.mp4') || file.Key.endsWith('.mov') || file.Key.endsWith('.m3u8'))
  );
  console.log(`Video files (mp4/mov/m3u8): ${videoFiles.length}`);
  
  // Master filter
  const masterVideos = videoFiles.filter(video => {
    return video.Key.includes('master.m3u8');
  });
  console.log(`Master.m3u8 files after filter: ${masterVideos.length}`);
  
  console.log(`\nMaster videos that would be returned:`);
  masterVideos.forEach(video => {
    console.log(`  - ${video.Key}`);
  });
  
  // Debug: Check if there are files we're missing
  console.log(`\n=== Potential Issues ===`);
  
  // Check for different naming patterns
  const allM3u8 = allContents.filter(f => f.Key.endsWith('.m3u8'));
  const patterns = {
    master: allM3u8.filter(f => f.Key.includes('master')),
    playlist: allM3u8.filter(f => f.Key.includes('playlist')),
    other: allM3u8.filter(f => !f.Key.includes('master') && !f.Key.includes('playlist'))
  };
  
  console.log(`\nM3U8 file patterns:`);
  console.log(`- Files with 'master': ${patterns.master.length}`);
  console.log(`- Files with 'playlist': ${patterns.playlist.length}`);
  console.log(`- Other .m3u8 files: ${patterns.other.length}`);
  
  if (patterns.other.length > 0) {
    console.log(`\nOther .m3u8 files (first 5):`);
    patterns.other.slice(0, 5).forEach(f => console.log(`  - ${f.Key}`));
  }
  
  // Check for folders without master.m3u8
  console.log(`\n=== Folders without master.m3u8 ===`);
  sortedFolders.forEach(([folder, data]) => {
    if (data.m3u8Files.length > 0 && data.masterFiles.length === 0) {
      console.log(`${folder}: has ${data.m3u8Files.length} .m3u8 files but no master.m3u8`);
      if (data.m3u8Files.length > 0) {
        console.log(`  Sample files: ${data.m3u8Files.slice(0, 3).join(', ')}`);
      }
    }
  });
}

debugS3Listing().catch(console.error);