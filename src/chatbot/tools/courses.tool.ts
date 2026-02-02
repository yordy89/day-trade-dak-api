import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

// Note: These interfaces should match your actual video/course schemas
// Adjust based on your actual schema structure

export interface CourseInfo {
  id: string;
  title: string;
  description: string;
  category: string;
  duration?: string;
  level?: string;
  isAvailable: boolean;
  thumbnailUrl?: string;
  moduleCount?: number;
}

export interface UserCourseProgress {
  courseId: string;
  courseTitle: string;
  progress: number; // 0-100
  completedLessons: number;
  totalLessons: number;
  lastAccessedAt?: Date;
}

export interface CoursesToolParams {
  category?: string;
  level?: string;
  limit?: number;
  userId?: string;
}

@Injectable()
export class CoursesTool {
  private readonly logger = new Logger(CoursesTool.name);

  constructor(
    @InjectModel('Video') private videoModel: Model<any>,
  ) {}

  /**
   * Tool definition for Claude function calling
   */
  static getToolDefinition() {
    return {
      name: 'get_courses',
      description:
        'Get information about academy courses, tutorials, and educational content. Use this to answer questions about available courses, course content, levels, and categories.',
      input_schema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description:
              'Filter by course category (e.g., basics, technical_analysis, psychology)',
          },
          level: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced'],
            description: 'Filter by difficulty level',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of courses to return',
            default: 10,
          },
        },
        required: [],
      },
    };
  }

  /**
   * Tool definition for user progress
   */
  static getUserProgressToolDefinition() {
    return {
      name: 'get_user_course_progress',
      description:
        "Get the user's progress in academy courses. Use this when users ask about their learning progress, completed courses, or what to learn next.",
      input_schema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'The user ID to get progress for',
          },
        },
        required: ['userId'],
      },
    };
  }

  /**
   * Execute the courses tool - get available courses
   */
  async execute(params: CoursesToolParams): Promise<CourseInfo[]> {
    try {
      const { category, level, limit = 10 } = params;

      const query: any = { isActive: true };

      if (category) {
        query.category = category;
      }

      if (level) {
        query.level = level;
      }

      // Assuming videos are organized as courses/modules
      // Adjust this query based on your actual video schema
      const videos = await this.videoModel
        .find(query)
        .sort({ order: 1, createdAt: 1 })
        .limit(limit)
        .exec();

      return videos.map((video: any) => this.formatCourse(video));
    } catch (error) {
      this.logger.error(`Courses tool error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get course categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const categories = await this.videoModel.distinct('category', {
        isActive: true,
      });
      return categories;
    } catch (error) {
      this.logger.error(`Get categories error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get a specific course by ID
   */
  async getCourseById(courseId: string): Promise<CourseInfo | null> {
    try {
      const video = await this.videoModel.findById(courseId).exec();
      return video ? this.formatCourse(video) : null;
    } catch (error) {
      this.logger.error(`Get course by ID error: ${error.message}`);
      return null;
    }
  }

  /**
   * Get user progress (placeholder - implement based on your schema)
   */
  async getUserProgress(userId: string): Promise<UserCourseProgress[]> {
    try {
      // This is a placeholder implementation
      // You'll need to adjust based on how user progress is tracked in your system
      // For now, returning empty array
      this.logger.log(`Getting progress for user ${userId}`);

      // Example implementation if you have a progress tracking collection:
      // const progress = await this.progressModel.find({ userId: new Types.ObjectId(userId) });
      // return progress.map(p => this.formatProgress(p));

      return [];
    } catch (error) {
      this.logger.error(`Get user progress error: ${error.message}`);
      return [];
    }
  }

  /**
   * Format course for response
   */
  private formatCourse(video: any): CourseInfo {
    return {
      id: video._id.toString(),
      title: video.title || video.name,
      description: video.description || '',
      category: video.category || 'general',
      duration: video.duration,
      level: video.level || 'beginner',
      isAvailable: video.isActive ?? true,
      thumbnailUrl: video.thumbnailUrl || video.thumbnail,
      moduleCount: video.moduleCount || 1,
    };
  }

  /**
   * Format courses for chatbot context
   */
  formatForContext(courses: CourseInfo[]): string {
    if (courses.length === 0) {
      return 'No courses found matching your criteria.';
    }

    return courses
      .map((course, index) => {
        return `
${index + 1}. **${course.title}**
   - Category: ${course.category}
   - Level: ${course.level}
   ${course.duration ? `- Duration: ${course.duration}` : ''}
   ${course.description ? `- Description: ${course.description.slice(0, 150)}...` : ''}`;
      })
      .join('\n');
  }

  /**
   * Format user progress for chatbot context
   */
  formatProgressForContext(progress: UserCourseProgress[]): string {
    if (progress.length === 0) {
      return 'You haven\'t started any courses yet. Would you like me to recommend some courses to get started?';
    }

    return progress
      .map((p, index) => {
        const progressBar = this.createProgressBar(p.progress);
        return `
${index + 1}. **${p.courseTitle}**
   - Progress: ${progressBar} ${p.progress}%
   - Completed: ${p.completedLessons}/${p.totalLessons} lessons
   ${p.lastAccessedAt ? `- Last accessed: ${new Date(p.lastAccessedAt).toLocaleDateString()}` : ''}`;
      })
      .join('\n');
  }

  /**
   * Create a simple text progress bar
   */
  private createProgressBar(progress: number): string {
    const filled = Math.floor(progress / 10);
    const empty = 10 - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }
}
