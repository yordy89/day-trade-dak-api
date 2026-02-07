import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GalleryItem, GalleryItemDocument, GalleryItemType } from './gallery-item.schema';
import { CreateGalleryItemDto, UpdateGalleryItemDto } from './dto/create-gallery-item.dto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@nestjs/common';

@Injectable()
export class CommunityGalleryService {
  private readonly logger = new Logger(CommunityGalleryService.name);
  private s3: S3Client;
  private bucketName: string;
  private cloudFrontDomain: string;
  private readonly FOLDER = 'community-gallery';

  constructor(
    @InjectModel(GalleryItem.name) private galleryModel: Model<GalleryItemDocument>,
    private configService: ConfigService,
  ) {
    this.s3 = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
    this.cloudFrontDomain = this.configService.get<string>('CLOUDFRONT_DOMAIN');
  }

  async findAll(includeInactive = false): Promise<GalleryItem[]> {
    const query = includeInactive ? {} : { isActive: true };
    return this.galleryModel.find(query).sort({ order: 1, createdAt: -1 }).exec();
  }

  async findByType(type: GalleryItemType, includeInactive = false): Promise<GalleryItem[]> {
    const query = includeInactive ? { type } : { type, isActive: true };
    return this.galleryModel.find(query).sort({ order: 1, createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<GalleryItem> {
    const item = await this.galleryModel.findById(id).exec();
    if (!item) {
      throw new NotFoundException(`Gallery item with ID ${id} not found`);
    }
    return item;
  }

  async uploadAndCreate(
    file: Express.Multer.File,
    dto: CreateGalleryItemDto,
  ): Promise<GalleryItem> {
    // Validate file type
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    
    if (!isImage && !isVideo) {
      throw new BadRequestException('File must be an image or video');
    }

    // Validate dto type matches file
    if (dto.type === GalleryItemType.IMAGE && !isImage) {
      throw new BadRequestException('File type does not match specified type (expected image)');
    }
    if (dto.type === GalleryItemType.VIDEO && !isVideo) {
      throw new BadRequestException('File type does not match specified type (expected video)');
    }

    // Generate unique filename
    const extension = file.originalname.split('.').pop();
    const filename = `${uuidv4()}.${extension}`;
    const key = `${this.FOLDER}/${dto.type}s/${filename}`;

    // Upload to S3
    try {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));

      this.logger.log(`Uploaded file to S3: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`);
      throw new BadRequestException('Failed to upload file');
    }

    // Get the max order
    const maxOrderItem = await this.galleryModel.findOne().sort({ order: -1 }).exec();
    const nextOrder = (maxOrderItem?.order ?? -1) + 1;

    // Create database entry
    const url = `https://${this.cloudFrontDomain}/${key}`;
    const galleryItem = new this.galleryModel({
      type: dto.type,
      url,
      key,
      title: dto.title,
      description: dto.description,
      order: dto.order ?? nextOrder,
      mimeType: file.mimetype,
      size: file.size,
    });

    return galleryItem.save();
  }

  async update(id: string, dto: UpdateGalleryItemDto): Promise<GalleryItem> {
    const item = await this.galleryModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    
    if (!item) {
      throw new NotFoundException(`Gallery item with ID ${id} not found`);
    }
    return item;
  }

  async reorder(itemIds: string[]): Promise<void> {
    const operations = itemIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { order: index },
      },
    }));
    await this.galleryModel.bulkWrite(operations);
  }

  async remove(id: string): Promise<void> {
    const item = await this.galleryModel.findById(id).exec();
    if (!item) {
      throw new NotFoundException(`Gallery item with ID ${id} not found`);
    }

    // Delete from S3
    try {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: item.key,
      }));
      this.logger.log(`Deleted file from S3: ${item.key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${error.message}`);
      // Continue with database deletion even if S3 fails
    }

    // Delete from database
    await this.galleryModel.findByIdAndDelete(id).exec();
  }

  async getStats(): Promise<{ total: number; images: number; videos: number }> {
    const [total, images, videos] = await Promise.all([
      this.galleryModel.countDocuments({ isActive: true }),
      this.galleryModel.countDocuments({ isActive: true, type: GalleryItemType.IMAGE }),
      this.galleryModel.countDocuments({ isActive: true, type: GalleryItemType.VIDEO }),
    ]);
    return { total, images, videos };
  }
}
