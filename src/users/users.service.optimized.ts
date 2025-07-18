import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CustomLoggerService } from '../logger/logger.service';
import { CacheService } from '../cache/cache.service'; // Assuming Redis cache service

interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

@Injectable()
export class UsersServiceOptimized {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly SALT_ROUNDS = 10;
  private readonly SELECT_FIELDS = '-password -__v'; // Exclude sensitive fields by default

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly logger: CustomLoggerService,
    private readonly cache: CacheService,
  ) {
    // Create indexes for better query performance
    this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    try {
      const indexes = [
        { key: { email: 1 }, options: { unique: true, name: 'email_unique' } },
        {
          key: { stripeCustomerId: 1 },
          options: { sparse: true, name: 'stripe_customer_id' },
        },
        {
          key: { activeSubscriptions: 1 },
          options: { name: 'active_subscriptions_idx' },
        },
        { key: { createdAt: -1 }, options: { name: 'created_at_desc' } },
        {
          key: { email: 1, isActive: 1 },
          options: { name: 'email_active_compound' },
        },
        {
          key: { role: 1, createdAt: -1 },
          options: { name: 'role_created_compound' },
        },
      ];

      // Create regular indexes
      for (const index of indexes) {
        try {
          await this.userModel.collection.createIndex(
            index.key as any,
            index.options,
          );
        } catch (error: any) {
          // Ignore duplicate index errors
          if (
            error.code === 85 ||
            error.code === 86 ||
            error.message?.includes('already exists')
          ) {
            this.logger.debug(
              `Index ${index.options.name} already exists`,
              'UsersService',
            );
          } else {
            throw error;
          }
        }
      }

      // Create text index separately
      try {
        await this.userModel.collection.createIndex(
          { firstName: 'text', lastName: 'text', email: 'text' } as any,
          { name: 'user_text_search' },
        );
      } catch (error: any) {
        if (
          error.code === 85 ||
          error.code === 86 ||
          error.message?.includes('already exists')
        ) {
          this.logger.debug('Text search index already exists', 'UsersService');
        } else {
          throw error;
        }
      }

      this.logger.log('Database indexes verified successfully', 'UsersService');
    } catch (error: any) {
      // Don't fail the application startup due to index creation errors
      this.logger.warn(
        'Index creation completed with warnings',
        'UsersService',
      );
      this.logger.debug(error.message, 'UsersService');
    }
  }

  async create(
    createUserDto: CreateUserDto,
    session?: ClientSession,
  ): Promise<UserDocument> {
    const startTime = Date.now();

    try {
      // Check if user already exists
      const existingUser = await this.userModel
        .findOne({ email: createUserDto.email.toLowerCase() })
        .lean()
        .exec();

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(
        createUserDto.password,
        this.SALT_ROUNDS,
      );

      // Create user with transaction support
      const userDoc = new this.userModel({
        ...createUserDto,
        email: createUserDto.email.toLowerCase(),
        password: hashedPassword,
      });

      const savedUser = await userDoc.save({ session });

      // Remove password from response
      const user = savedUser.toObject();
      delete user.password;

      // Log performance metric
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_create', duration);
      this.logger.logBusinessEvent('user_created', {
        userId: user._id,
        email: user.email,
      });

      return user as UserDocument;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_create_failed', duration);
      this.logger.error(
        `Failed to create user: ${createUserDto.email}`,
        error.stack,
        'UsersService',
      );

      if (error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async findAll(
    options: PaginationOptions,
  ): Promise<PaginatedResult<UserDocument>> {
    const startTime = Date.now();
    const cacheKey = `users:page:${options.page}:limit:${options.limit}:sort:${options.sort}:${options.order}`;

    try {
      // Check cache first
      const cached =
        await this.cache.get<PaginatedResult<UserDocument>>(cacheKey);
      if (cached) {
        this.logger.debug('Users retrieved from cache', 'UsersService');
        return cached;
      }

      // Calculate pagination
      const page = Math.max(1, options.page);
      const limit = Math.min(100, Math.max(1, options.limit)); // Max 100 items per page
      const skip = (page - 1) * limit;

      // Build sort object
      const sort: any = {};
      if (options.sort) {
        sort[options.sort] = options.order === 'desc' ? -1 : 1;
      } else {
        sort.createdAt = -1; // Default sort by creation date
      }

      // Execute queries in parallel
      const [users, total] = await Promise.all([
        this.userModel
          .find()
          .select(this.SELECT_FIELDS)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean() // Use lean for better performance
          .exec(),
        this.userModel.countDocuments().exec(),
      ]);

      const result: PaginatedResult<UserDocument> = {
        data: users as UserDocument[],
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      };

      // Cache the result
      await this.cache.set(cacheKey, result, this.CACHE_TTL);

      // Log performance
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_users_findAll', duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_users_findAll_failed', duration);
      this.logger.error(
        'Failed to retrieve users',
        error.stack,
        'UsersService',
      );
      throw new InternalServerErrorException('Failed to retrieve users');
    }
  }

  async findById(
    userId: string,
    includePassword = false,
  ): Promise<UserDocument> {
    const startTime = Date.now();
    const cacheKey = `user:${userId}`;

    try {
      // Validate ObjectId
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      // Check cache first (only for non-password requests)
      if (!includePassword) {
        const cached = await this.cache.get<UserDocument>(cacheKey);
        if (cached) {
          this.logger.debug(
            `User ${userId} retrieved from cache`,
            'UsersService',
          );
          return cached;
        }
      }

      // Query with field selection
      const query = this.userModel.findById(userId);
      if (!includePassword) {
        query.select(this.SELECT_FIELDS);
      }

      const user = await query.lean().exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Cache the result (only non-password version)
      if (!includePassword) {
        await this.cache.set(cacheKey, user, this.CACHE_TTL);
      }

      // Log performance
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_findById', duration);

      return user as UserDocument;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_findById_failed', duration);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to find user by ID: ${userId}`,
        error.stack,
        'UsersService',
      );
      throw new InternalServerErrorException('Failed to retrieve user');
    }
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<UserDocument | null> {
    const startTime = Date.now();
    const normalizedEmail = email.toLowerCase();
    const cacheKey = `user:email:${normalizedEmail}`;

    try {
      // Check cache first (only for non-password requests)
      if (!includePassword) {
        const cached = await this.cache.get<UserDocument>(cacheKey);
        if (cached) {
          this.logger.debug(
            `User ${normalizedEmail} retrieved from cache`,
            'UsersService',
          );
          return cached;
        }
      }

      // Query with field selection
      const query = this.userModel.findOne({ email: normalizedEmail });
      if (!includePassword) {
        query.select(this.SELECT_FIELDS);
      }

      const user = await query.lean().exec();

      // Cache the result (only non-password version)
      if (!includePassword && user) {
        await this.cache.set(cacheKey, user, this.CACHE_TTL);
      }

      // Log performance
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_findByEmail', duration);

      return user as UserDocument | null;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_findByEmail_failed', duration);
      this.logger.error(
        `Failed to find user by email: ${normalizedEmail}`,
        error.stack,
        'UsersService',
      );
      throw new InternalServerErrorException('Failed to retrieve user');
    }
  }

  async update(
    userId: string,
    updateUserDto: UpdateUserDto,
    session?: ClientSession,
  ): Promise<UserDocument> {
    const startTime = Date.now();

    try {
      // Validate ObjectId
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      // Prepare update data
      const updateData: any = { ...updateUserDto };

      // Hash password if it's being updated
      if (updateData.password) {
        updateData.password = await bcrypt.hash(
          updateData.password,
          this.SALT_ROUNDS,
        );
      }

      // Update user and return new document
      const updatedUser = await this.userModel
        .findByIdAndUpdate(
          userId,
          { $set: updateData },
          {
            new: true,
            runValidators: true,
            session,
            select: this.SELECT_FIELDS,
          },
        )
        .lean()
        .exec();

      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }

      // Invalidate cache
      await this.invalidateUserCache(userId, updatedUser.email);

      // Log performance and business event
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_update', duration);
      this.logger.logBusinessEvent('user_updated', {
        userId,
        fields: Object.keys(updateData),
      });

      return updatedUser as UserDocument;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_update_failed', duration);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to update user: ${userId}`,
        error.stack,
        'UsersService',
      );
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async remove(userId: string, session?: ClientSession): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate ObjectId
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      // Find user first to get email for cache invalidation
      const user = await this.userModel
        .findById(userId)
        .select('email')
        .lean()
        .exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Delete user
      const result = await this.userModel
        .deleteOne({ _id: userId }, { session })
        .exec();

      if (result.deletedCount === 0) {
        throw new NotFoundException('User not found');
      }

      // Invalidate cache
      await this.invalidateUserCache(userId, user.email);

      // Log performance and business event
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_delete', duration);
      this.logger.logBusinessEvent('user_deleted', {
        userId,
        email: user.email,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_delete_failed', duration);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to delete user: ${userId}`,
        error.stack,
        'UsersService',
      );
      throw new InternalServerErrorException('Failed to delete user');
    }
  }

  async searchUsers(
    query: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<UserDocument>> {
    const startTime = Date.now();

    try {
      const page = Math.max(1, options.page);
      const limit = Math.min(100, Math.max(1, options.limit));
      const skip = (page - 1) * limit;

      // Use text search with score
      const searchQuery = {
        $text: { $search: query },
      };

      const [users, total] = await Promise.all([
        this.userModel
          .find(searchQuery, { score: { $meta: 'textScore' } })
          .select(this.SELECT_FIELDS)
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.userModel.countDocuments(searchQuery).exec(),
      ]);

      const result: PaginatedResult<UserDocument> = {
        data: users as UserDocument[],
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      };

      // Log performance
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_users_search', duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_users_search_failed', duration);
      this.logger.error(
        `Failed to search users with query: ${query}`,
        error.stack,
        'UsersService',
      );
      throw new InternalServerErrorException('Failed to search users');
    }
  }

  async getUserStats(): Promise<any> {
    const startTime = Date.now();
    const cacheKey = 'user:stats';

    try {
      // Check cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Use aggregation pipeline for efficient stats calculation
      const stats = await this.userModel
        .aggregate([
          {
            $facet: {
              totalUsers: [{ $count: 'count' }],
              usersByRole: [
                { $group: { _id: '$role', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
              ],
              usersBySubscription: [
                { $unwind: '$activeSubscriptions' },
                { $group: { _id: '$activeSubscriptions', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
              ],
              recentUsers: [
                { $sort: { createdAt: -1 } },
                { $limit: 5 },
                {
                  $project: {
                    _id: 1,
                    email: 1,
                    firstName: 1,
                    lastName: 1,
                    createdAt: 1,
                  },
                },
              ],
              userGrowth: [
                {
                  $group: {
                    _id: {
                      year: { $year: '$createdAt' },
                      month: { $month: '$createdAt' },
                    },
                    count: { $sum: 1 },
                  },
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 12 },
              ],
            },
          },
        ])
        .exec();

      const result = {
        totalUsers: stats[0]?.totalUsers[0]?.count || 0,
        usersByRole: stats[0]?.usersByRole || [],
        usersBySubscription: stats[0]?.usersBySubscription || [],
        recentUsers: stats[0]?.recentUsers || [],
        userGrowth: stats[0]?.userGrowth || [],
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, result, 3600);

      // Log performance
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_stats', duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logPerformanceMetric('db_user_stats_failed', duration);
      this.logger.error(
        'Failed to get user statistics',
        error.stack,
        'UsersService',
      );
      throw new InternalServerErrorException(
        'Failed to retrieve user statistics',
      );
    }
  }

  private async invalidateUserCache(
    userId: string,
    email: string,
  ): Promise<void> {
    const keys = [
      `user:${userId}`,
      `user:email:${email.toLowerCase()}`,
      'user:stats',
    ];

    try {
      await Promise.all(keys.map((key) => this.cache.del(key)));
      this.logger.debug(`Cache invalidated for user ${userId}`, 'UsersService');
    } catch (error) {
      this.logger.error(
        'Failed to invalidate cache',
        error.stack,
        'UsersService',
      );
    }
  }
}
