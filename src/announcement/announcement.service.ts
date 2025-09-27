import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Announcement, AnnouncementDocument, AnnouncementStatus } from './announcement.schema';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementService {
  constructor(
    @InjectModel(Announcement.name) private announcementModel: Model<AnnouncementDocument>,
  ) {}

  async create(createAnnouncementDto: CreateAnnouncementDto, userId: string): Promise<AnnouncementDocument> {
    const createdAnnouncement = new this.announcementModel({
      ...createAnnouncementDto,
      createdBy: new Types.ObjectId(userId),
      lastModifiedBy: new Types.ObjectId(userId),
    });

    // If this announcement is set as active, deactivate all others
    if (createAnnouncementDto.isActive) {
      await this.deactivateAllAnnouncements();
    }

    return createdAnnouncement.save();
  }

  async findAll(query: any = {}): Promise<AnnouncementDocument[]> {
    return this.announcementModel
      .find(query)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<AnnouncementDocument> {
    const announcement = await this.announcementModel
      .findById(id)
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .exec();

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    return announcement;
  }

  async update(id: string, updateAnnouncementDto: UpdateAnnouncementDto, userId: string): Promise<AnnouncementDocument> {
    // If setting this announcement as active, deactivate all others first
    if (updateAnnouncementDto.isActive) {
      await this.deactivateAllAnnouncements();
    }

    const updatedAnnouncement = await this.announcementModel
      .findByIdAndUpdate(
        id,
        {
          ...updateAnnouncementDto,
          lastModifiedBy: new Types.ObjectId(userId),
        },
        { new: true }
      )
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .exec();

    if (!updatedAnnouncement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    return updatedAnnouncement;
  }

  async remove(id: string): Promise<void> {
    const result = await this.announcementModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }
  }

  async setActive(id: string, userId: string): Promise<AnnouncementDocument> {
    // Deactivate all announcements
    await this.deactivateAllAnnouncements();

    // Activate the specified announcement
    const announcement = await this.announcementModel
      .findByIdAndUpdate(
        id,
        {
          isActive: true,
          status: AnnouncementStatus.ACTIVE,
          lastModifiedBy: new Types.ObjectId(userId),
        },
        { new: true }
      )
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .exec();

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    return announcement;
  }

  async deactivate(id: string, userId: string): Promise<AnnouncementDocument> {
    const announcement = await this.announcementModel
      .findByIdAndUpdate(
        id,
        {
          isActive: false,
          lastModifiedBy: new Types.ObjectId(userId),
        },
        { new: true }
      )
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
      .exec();

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    return announcement;
  }

  async getActiveAnnouncement(): Promise<AnnouncementDocument | null> {
    const now = new Date();

    const announcement = await this.announcementModel
      .findOne({
        isActive: true,
        status: AnnouncementStatus.ACTIVE,
        startDate: { $lte: now },
        endDate: { $gte: now }
      })
      .exec();

    // Increment view count if announcement is found
    if (announcement) {
      await this.announcementModel.updateOne(
        { _id: announcement._id },
        { $inc: { viewCount: 1 } }
      );
    }

    return announcement;
  }

  async trackClick(id: string): Promise<void> {
    await this.announcementModel.updateOne(
      { _id: id },
      { $inc: { clickCount: 1 } }
    );
  }

  async trackDismiss(id: string): Promise<void> {
    await this.announcementModel.updateOne(
      { _id: id },
      { $inc: { dismissCount: 1 } }
    );
  }

  private async deactivateAllAnnouncements(): Promise<void> {
    await this.announcementModel.updateMany(
      { isActive: true },
      { isActive: false }
    );
  }

  async updateExpiredAnnouncements(): Promise<void> {
    const now = new Date();

    await this.announcementModel.updateMany(
      {
        status: { $ne: AnnouncementStatus.EXPIRED },
        endDate: { $lt: now }
      },
      {
        status: AnnouncementStatus.EXPIRED,
        isActive: false
      }
    );
  }

  async activateScheduledAnnouncements(): Promise<void> {
    const now = new Date();

    await this.announcementModel.updateMany(
      {
        status: AnnouncementStatus.SCHEDULED,
        startDate: { $lte: now },
        endDate: { $gte: now }
      },
      {
        status: AnnouncementStatus.ACTIVE
      }
    );
  }

  async getAnnouncementStats(id: string): Promise<any> {
    const announcement = await this.findOne(id);

    return {
      title: announcement.title,
      type: announcement.type,
      priority: announcement.priority,
      viewCount: announcement.viewCount,
      clickCount: announcement.clickCount,
      dismissCount: announcement.dismissCount,
      clickThroughRate: announcement.viewCount > 0
        ? (announcement.clickCount / announcement.viewCount * 100).toFixed(2) + '%'
        : '0%',
      dismissRate: announcement.viewCount > 0
        ? (announcement.dismissCount / announcement.viewCount * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}