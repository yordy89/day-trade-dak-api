import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Video, VideoDocument } from './video.schema';
import { CreateVideoDto, UpdateVideoDto } from './video.dto';

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
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
}
