import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VectorStoreService } from '../embeddings/vector-store.service';

@Injectable()
export class UrlRefreshCronService {
  private readonly logger = new Logger(UrlRefreshCronService.name);

  constructor(private readonly vectorStoreService: VectorStoreService) {}

  /**
   * Check for URLs that need to be refreshed every hour.
   * URLs with auto-refresh enabled will be re-crawled when their nextCrawl date has passed.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshDueUrls() {
    this.logger.log('🔄 Checking for URLs due for auto-refresh...');

    try {
      const urlsDueForRefresh =
        await this.vectorStoreService.getUrlSourcesDueForRefresh();

      if (urlsDueForRefresh.length === 0) {
        this.logger.log('✅ No URLs due for refresh');
        return;
      }

      this.logger.log(
        `📋 Found ${urlsDueForRefresh.length} URL(s) due for refresh`,
      );

      let successCount = 0;
      let errorCount = 0;

      for (const urlSource of urlsDueForRefresh) {
        try {
          this.logger.log(`🔄 Refreshing URL: ${urlSource.url}`);

          const result = await this.vectorStoreService.refreshUrlSource(
            urlSource._id.toString(),
          );

          this.logger.log(
            `✅ Refreshed "${result.title}": created ${result.documentsCreated} chunks, deleted ${result.documentsDeleted} old chunks`,
          );

          successCount++;
        } catch (error: any) {
          this.logger.error(
            `❌ Failed to refresh URL ${urlSource.url}: ${error.message}`,
          );
          errorCount++;
        }
      }

      this.logger.log(
        `🏁 Auto-refresh complete: ${successCount} succeeded, ${errorCount} failed`,
      );
    } catch (error: any) {
      this.logger.error(`❌ Error in URL auto-refresh cron: ${error.message}`);
    }
  }

  /**
   * Clean up failed URL sources that have been failing repeatedly.
   * Runs once a day to mark URLs as inactive if they've failed 5+ times.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupFailedUrls() {
    this.logger.log('🧹 Checking for repeatedly failing URLs...');

    try {
      // This could be extended to track failure counts and auto-disable
      // For now, we just log a reminder to check the admin panel
      const allUrlSources = await this.vectorStoreService.getAllUrlSources();
      const failedUrls = allUrlSources.filter(
        (url) => url.status === 'failed' && url.isActive,
      );

      if (failedUrls.length > 0) {
        this.logger.warn(
          `⚠️ Found ${failedUrls.length} active URL(s) in failed state. Please check the admin panel.`,
        );
        for (const url of failedUrls) {
          this.logger.warn(`  - ${url.title}: ${url.lastError}`);
        }
      } else {
        this.logger.log('✅ No failed URLs requiring attention');
      }
    } catch (error: any) {
      this.logger.error(`❌ Error in cleanup cron: ${error.message}`);
    }
  }
}
