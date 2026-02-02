import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ExtractedContent {
  title: string;
  content: string;
  description?: string;
  url: string;
}

@Injectable()
export class UrlCrawlerService {
  private readonly logger = new Logger(UrlCrawlerService.name);

  async extractContent(url: string): Promise<ExtractedContent> {
    this.logger.log(`Extracting content from URL: ${url}`);

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 30000,
        maxRedirects: 5,
      });

      const html = response.data;
      const $ = cheerio.load(html) as unknown as cheerio.CheerioAPI;

      // Remove unwanted elements
      $(
        'script, style, nav, footer, header, aside, iframe, noscript, svg, [role="navigation"], [role="banner"], [role="contentinfo"], .nav, .navbar, .footer, .header, .sidebar, .menu, .advertisement, .ad, .cookie-banner, .popup',
      ).remove();

      // Try to get the title
      let title = this.extractTitle($);

      // Try to get meta description
      const description =
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        '';

      // Extract main content
      const content = this.extractMainContent($);

      if (!content || content.trim().length < 50) {
        throw new Error(
          'Could not extract meaningful content from the page. The page may be JavaScript-rendered or require authentication.',
        );
      }

      this.logger.log(
        `Successfully extracted ${content.length} characters from ${url}`,
      );

      return {
        title: title || this.extractTitleFromUrl(url),
        content: content.trim(),
        description: description || undefined,
        url,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ENOTFOUND') {
          throw new Error(`Could not reach the URL: ${url}. Please check if the URL is correct.`);
        }
        if (error.response?.status === 404) {
          throw new Error(`Page not found (404): ${url}`);
        }
        if (error.response?.status === 403) {
          throw new Error(`Access forbidden (403): ${url}. The page may require authentication.`);
        }
        throw new Error(`Failed to fetch URL: ${error.message}`);
      }
      throw error;
    }
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    // Try different title sources in order of preference
    const titleSources = [
      $('h1').first().text(),
      $('meta[property="og:title"]').attr('content'),
      $('title').text(),
      $('[class*="title"]').first().text(),
      $('[class*="heading"]').first().text(),
    ];

    for (const title of titleSources) {
      if (title && title.trim().length > 0 && title.trim().length < 200) {
        return title.trim();
      }
    }

    return '';
  }

  private extractMainContent($: cheerio.CheerioAPI): string {
    // Try to find main content container
    const mainSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.article-content',
      '.page-content',
      '#content',
      '#main',
    ];

    let mainContent = '';

    // Try main content selectors first
    for (const selector of mainSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        mainContent = this.cleanText(element.text());
        if (mainContent.length > 100) {
          break;
        }
      }
    }

    // If no main content found, try to extract from body
    if (mainContent.length < 100) {
      // Get all text content from body
      mainContent = this.cleanText($('body').text());
    }

    return mainContent;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .replace(/\t+/g, ' ') // Replace tabs with space
      .trim();
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Get the last segment of the path
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        // Convert kebab-case or snake_case to Title Case
        return lastSegment
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());
      }

      return urlObj.hostname;
    } catch {
      return 'Untitled Document';
    }
  }

  async isUrlAccessible(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 10000,
        maxRedirects: 5,
      });
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    }
  }
}
