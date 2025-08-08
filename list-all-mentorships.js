const AWS = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new AWS.S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function listAllMentorships() {
  console.log('Fetching ALL mentorship folders (no page limit)...\n');
  
  let allContents = [];
  let continuationToken;
  let pageCount = 0;
  
  do {
    const command = new AWS.ListObjectsV2Command({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Prefix: 'hsl-daytradedak-videos/mentorias/',
      MaxKeys: 1000,
      ContinuationToken: continuationToken,
    });
    
    try {
      pageCount++;
      process.stdout.write(`Fetching page ${pageCount}... `);
      const response = await s3Client.send(command);
      
      if (response.Contents) {
        allContents = [...allContents, ...response.Contents];
        console.log(`Found ${response.Contents.length} objects (Total: ${allContents.length})`);
      }
      
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } catch (error) {
      console.error('Error:', error.message);
      break;
    }
  } while (continuationToken);
  
  console.log(`\nTotal objects found: ${allContents.length}`);
  console.log(`Total pages fetched: ${pageCount}`);
  
  // Group by mentorship folder
  const folders = new Map();
  
  allContents.forEach(obj => {
    const parts = obj.Key.split('/');
    if (parts.length >= 3) {
      const folder = parts[2];
      if (folder && folder !== '') {
        if (!folders.has(folder)) {
          folders.set(folder, {
            files: [],
            hasMaster: false,
            hasPlaylist: false
          });
        }
        
        folders.get(folder).files.push(obj.Key);
        
        if (obj.Key.includes('master.m3u8')) {
          folders.get(folder).hasMaster = true;
        }
        if (obj.Key.includes('playlist.m3u8')) {
          folders.get(folder).hasPlaylist = true;
        }
      }
    }
  });
  
  console.log(`\n=== All Mentorship Folders (${folders.size} total) ===\n`);
  
  const sortedFolders = Array.from(folders.keys()).sort();
  sortedFolders.forEach((folder, index) => {
    const data = folders.get(folder);
    const m3u8Count = data.files.filter(f => f.endsWith('.m3u8')).length;
    console.log(`${index + 1}. ${folder}`);
    console.log(`   - Files: ${data.files.length}`);
    console.log(`   - M3U8 files: ${m3u8Count}`);
    console.log(`   - Has master.m3u8: ${data.hasMaster ? 'YES' : 'NO'}`);
    console.log(`   - Has playlist.m3u8: ${data.hasPlaylist ? 'YES' : 'NO'}`);
  });
  
  // Count master.m3u8 files
  const masterFiles = allContents.filter(obj => obj.Key.includes('master.m3u8'));
  console.log(`\n=== Master.m3u8 Files Summary ===`);
  console.log(`Total master.m3u8 files found: ${masterFiles.length}`);
  
  console.log(`\nAll master.m3u8 files:`);
  masterFiles.forEach(file => {
    console.log(`  - ${file.Key}`);
  });
  
  // Identify folders without master.m3u8
  const foldersWithoutMaster = sortedFolders.filter(folder => !folders.get(folder).hasMaster);
  if (foldersWithoutMaster.length > 0) {
    console.log(`\n=== Folders WITHOUT master.m3u8 (${foldersWithoutMaster.length}) ===`);
    foldersWithoutMaster.forEach(folder => {
      console.log(`  - ${folder}`);
    });
  }
}

listAllMentorships().catch(console.error);