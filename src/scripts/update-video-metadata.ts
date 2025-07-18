import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { S3ServiceOptimized } from '../aws/s3/s3.service.optimized';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
    );
    return Math.round(parseFloat(stdout.trim()));
  } catch (error) {
    console.error(`Failed to get duration for ${filePath}:`, error);
    return 0;
  }
}

async function updateVideoMetadata() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const s3Service = app.get(S3ServiceOptimized);

  try {
    // Define the folders to process
    const folders = [
      'course-calss',
      'class-videos',
      'mentorias',
      'stock-videos',
      'PsicoTrading',
      'cursos-jorge/curso1',
    ];

    for (const folder of folders) {
      console.log(`\nProcessing folder: ${folder}`);

      // Get list of videos
      const videos = await s3Service.listVideos(folder);
      console.log(`Found ${videos.length} videos`);

      for (const video of videos) {
        console.log(`\nProcessing: ${video.key}`);

        // Check if metadata already exists
        const existingMetadata = await s3Service.getVideoMetadata(video.key);
        if (existingMetadata?.duration) {
          console.log(
            `  Duration already set: ${existingMetadata.duration} seconds`,
          );
          continue;
        }

        // Extract title from filename
        const filename = video.key.split('/').pop()!;
        const title = filename
          .replace(/\.[^/.]+$/, '') // Remove extension
          .replace(/_/g, ' ') // Replace underscores with spaces
          .replace(/\b\w/g, (l) => l.toUpperCase()); // Capitalize words

        // For local processing, you would need to:
        // 1. Download the video temporarily
        // 2. Use ffprobe to get duration
        // 3. Update S3 metadata
        // 4. Delete temporary file

        console.log(`  Would update metadata:`);
        console.log(`    Title: ${title}`);
        console.log(`    Key: ${video.key}`);

        // Uncomment to actually update metadata:
        // await s3Service.updateVideoMetadata(video.key, {
        //   title,
        //   duration: 900, // Example: 15 minutes
        // });
      }
    }
  } catch (error) {
    console.error('Error processing videos:', error);
  } finally {
    await app.close();
  }
}

// Run the script
updateVideoMetadata().catch(console.error);
