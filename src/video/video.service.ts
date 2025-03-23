import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Video, VideoDocument } from './video.schema';
import { VideoClass, VideoClassDocument } from './videoClass.schema';
import { CreateVideoDto, UpdateVideoDto } from './video.dto';
import { S3Service } from 'src/aws/s3/s3.service';

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    @InjectModel(VideoClass.name)
    private videoClassModel: Model<VideoClassDocument>,
    private readonly s3Service: S3Service,
  ) {}

  async findAll(): Promise<Video[]> {
    return this.videoModel.find({ isActive: true }).exec();
  }

  async create(createVideoDto: CreateVideoDto): Promise<Video> {
    const newVideo = new this.videoModel(createVideoDto);
    return newVideo.save();
  }

  async update(id: string, updateVideoDto: UpdateVideoDto): Promise<Video> {
    const updatedVideo = await this.videoModel.findByIdAndUpdate(
      id,
      updateVideoDto,
      { new: true },
    );
    if (!updatedVideo)
      throw new NotFoundException(`Video with ID ${id} not found`);
    return updatedVideo;
  }

  async getVideoWithSignedUrl(videoId: string) {
    const video = await this.videoClassModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const signedUrl = await this.s3Service.getSignedUrl(video.s3Key);
    const captionsUrl = video.captionsS3Key
      ? await this.s3Service.getSignedUrl(video.captionsS3Key)
      : null;

    return { ...video.toObject(), videoUrl: signedUrl, captionsUrl };
  }
}
