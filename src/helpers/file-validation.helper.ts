import { BadRequestException } from '@nestjs/common';

export class FileValidationHelper {
  private static readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  private static readonly ALLOWED_IMAGE_EXTENSIONS = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
  ];

  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // File signature magic numbers for validation
  private static readonly FILE_SIGNATURES: { [key: string]: number[][] } = {
    jpg: [
      [0xff, 0xd8, 0xff, 0xe0],
      [0xff, 0xd8, 0xff, 0xe1],
      [0xff, 0xd8, 0xff, 0xe2],
    ],
    png: [[0x89, 0x50, 0x4e, 0x47]],
    webp: [[0x52, 0x49, 0x46, 0x46]], // RIFF
  };

  static validateProfileImage(file: Express.Multer.File): void {
    // 1. Check if file exists
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // 2. Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size must not exceed ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // 3. Validate MIME type
    if (!this.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.ALLOWED_IMAGE_TYPES.join(', ')}`,
      );
    }

    // 4. Validate file extension
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (!this.ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Invalid file extension. Allowed extensions: ${this.ALLOWED_IMAGE_EXTENSIONS.join(', ')}`,
      );
    }

    // 5. Validate file signature (magic numbers) to prevent MIME type spoofing
    if (!this.validateFileSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'File signature does not match the declared MIME type. Possible file tampering detected.',
      );
    }
  }

  private static validateFileSignature(buffer: Buffer, mimetype: string): boolean {
    if (!buffer || buffer.length < 4) {
      return false;
    }

    const header = Array.from(buffer.slice(0, 4));

    // Check based on MIME type
    if (mimetype.includes('jpeg') || mimetype.includes('jpg')) {
      return this.FILE_SIGNATURES.jpg.some((signature) =>
        signature.every((byte, index) => header[index] === byte),
      );
    }

    if (mimetype.includes('png')) {
      return this.FILE_SIGNATURES.png.some((signature) =>
        signature.every((byte, index) => header[index] === byte),
      );
    }

    if (mimetype.includes('webp')) {
      // WebP starts with RIFF
      return header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
    }

    return false;
  }

  static sanitizeFileName(filename: string): string {
    // Remove potentially dangerous characters from filename
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 255); // Limit length
  }
}
