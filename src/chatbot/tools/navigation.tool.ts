import { Injectable, Logger } from '@nestjs/common';

export interface NavigationItem {
  path: string;
  label: string;
  description: string;
  requiredModule?: string;
  icon?: string;
}

export interface NavigationGuide {
  topic: string;
  steps: string[];
  relatedPaths: NavigationItem[];
}

export interface NavigationToolParams {
  topic?: string;
  path?: string;
}

@Injectable()
export class NavigationTool {
  private readonly logger = new Logger(NavigationTool.name);

  // Platform navigation structure
  private readonly navigationMap: NavigationItem[] = [
    {
      path: '/academy',
      label: 'Dashboard',
      description: 'Main dashboard with overview of your trading journey, missions, and progress.',
    },
    {
      path: '/academy/support-videos',
      label: 'Academy Videos',
      description: 'Educational videos and tutorials for learning trading concepts.',
    },
    {
      path: '/academy/master-course',
      label: 'Master Course',
      description: 'Comprehensive trading master course with structured curriculum.',
      requiredModule: 'MASTER_COURSE',
    },
    {
      path: '/academy/trading-journal',
      label: 'Trading Journal',
      description: 'Log and analyze your trades. Track your trading performance and patterns.',
      requiredModule: 'TRADING_JOURNAL',
    },
    {
      path: '/academy/mentorship',
      label: 'Mentorship',
      description: 'One-on-one mentorship sessions with experienced traders.',
      requiredModule: 'MENTORSHIP',
    },
    {
      path: '/academy/live',
      label: 'Live Sessions',
      description: 'Join live trading sessions and webinars with the community.',
    },
    {
      path: '/academy/events',
      label: 'Events',
      description: 'Upcoming events, workshops, and community gatherings.',
    },
    {
      path: '/academy/settings',
      label: 'Settings',
      description: 'Manage your account settings, preferences, and notifications.',
    },
    {
      path: '/academy/subscription',
      label: 'Subscription',
      description: 'View and manage your subscription plan and billing.',
    },
  ];

  // Common how-to guides
  private readonly guides: NavigationGuide[] = [
    {
      topic: 'logging a trade',
      steps: [
        '1. Navigate to Trading Journal from the sidebar',
        '2. Click the "Add Trade" button in the top right',
        '3. Fill in the trade details: symbol, entry/exit prices, position size',
        '4. Add your pre-trade analysis and emotions',
        '5. Click "Save Trade" to log your trade',
      ],
      relatedPaths: [
        {
          path: '/academy/trading-journal',
          label: 'Trading Journal',
          description: 'Access your trading journal',
        },
      ],
    },
    {
      topic: 'watching academy videos',
      steps: [
        '1. Click on "Academy Videos" in the sidebar',
        '2. Browse courses by category or search for a specific topic',
        '3. Click on a video to start watching',
        '4. Track your progress as you complete videos',
      ],
      relatedPaths: [
        {
          path: '/academy/support-videos',
          label: 'Academy Videos',
          description: 'Browse all educational content',
        },
      ],
    },
    {
      topic: 'joining a live session',
      steps: [
        '1. Go to "Live Sessions" from the sidebar',
        '2. Check the schedule for upcoming sessions',
        '3. Click "Join" when a session is live',
        '4. Make sure your camera and microphone are working',
      ],
      relatedPaths: [
        {
          path: '/academy/live',
          label: 'Live Sessions',
          description: 'Join live trading sessions',
        },
      ],
    },
    {
      topic: 'booking a mentorship session',
      steps: [
        '1. Navigate to "Mentorship" from the sidebar',
        '2. View available time slots on the calendar',
        '3. Select a time that works for you',
        '4. Confirm your booking',
        '5. You\'ll receive a confirmation email with meeting details',
      ],
      relatedPaths: [
        {
          path: '/academy/mentorship',
          label: 'Mentorship',
          description: 'Book mentorship sessions',
        },
      ],
    },
    {
      topic: 'managing subscription',
      steps: [
        '1. Go to "Settings" from the sidebar',
        '2. Click on "Subscription" tab',
        '3. View your current plan and billing details',
        '4. Upgrade or modify your subscription as needed',
      ],
      relatedPaths: [
        {
          path: '/academy/subscription',
          label: 'Subscription',
          description: 'Manage your subscription',
        },
      ],
    },
    {
      topic: 'completing missions',
      steps: [
        '1. Visit your Dashboard to see current missions',
        '2. Click on a mission to see the requirements',
        '3. Complete the required actions (watch videos, log trades, etc.)',
        '4. Missions auto-complete when requirements are met',
        '5. Earn rewards and unlock achievements',
      ],
      relatedPaths: [
        {
          path: '/academy',
          label: 'Dashboard',
          description: 'View your missions',
        },
      ],
    },
  ];

  /**
   * Tool definition for Claude function calling
   */
  static getToolDefinition() {
    return {
      name: 'get_navigation_help',
      description:
        'Get help with navigating the platform. Use this to answer questions about where to find features, how to perform actions, and platform guidance.',
      input_schema: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description:
              'The topic or feature the user needs help with (e.g., "trading journal", "mentorship", "live sessions")',
          },
          path: {
            type: 'string',
            description: 'Specific path to get information about',
          },
        },
        required: [],
      },
    };
  }

  /**
   * Execute navigation help
   */
  async execute(params: NavigationToolParams): Promise<{
    navigation: NavigationItem[];
    guide?: NavigationGuide;
  }> {
    const { topic, path } = params;

    let navigation: NavigationItem[] = [];
    let guide: NavigationGuide | undefined;

    if (path) {
      // Get info about a specific path
      const item = this.navigationMap.find(
        (n) => n.path === path || n.path.includes(path),
      );
      if (item) {
        navigation = [item];
      }
    } else if (topic) {
      // Search for relevant navigation items and guides
      const searchTerm = topic.toLowerCase();

      navigation = this.navigationMap.filter(
        (n) =>
          n.label.toLowerCase().includes(searchTerm) ||
          n.description.toLowerCase().includes(searchTerm) ||
          n.path.toLowerCase().includes(searchTerm),
      );

      guide = this.guides.find(
        (g) =>
          g.topic.toLowerCase().includes(searchTerm) ||
          searchTerm.includes(g.topic.toLowerCase()),
      );
    } else {
      // Return all navigation items
      navigation = this.navigationMap;
    }

    return { navigation, guide };
  }

  /**
   * Get all available features
   */
  getAllFeatures(): NavigationItem[] {
    return this.navigationMap;
  }

  /**
   * Get guide by topic
   */
  getGuideByTopic(topic: string): NavigationGuide | undefined {
    const searchTerm = topic.toLowerCase();
    return this.guides.find(
      (g) =>
        g.topic.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(g.topic.toLowerCase()),
    );
  }

  /**
   * Format navigation for chatbot context
   */
  formatForContext(result: {
    navigation: NavigationItem[];
    guide?: NavigationGuide;
  }): string {
    let response = '';

    if (result.guide) {
      response += `## How to: ${result.guide.topic}\n\n`;
      response += result.guide.steps.join('\n');
      response += '\n\n';
    }

    if (result.navigation.length > 0) {
      response += '## Relevant Pages:\n\n';
      result.navigation.forEach((item) => {
        response += `- **${item.label}** (${item.path})\n`;
        response += `  ${item.description}\n`;
        if (item.requiredModule) {
          response += `  _Requires: ${item.requiredModule} subscription_\n`;
        }
        response += '\n';
      });
    }

    return response || 'I couldn\'t find specific navigation help for that topic. Try asking about a specific feature like "trading journal", "academy videos", or "live sessions".';
  }

  /**
   * Get quick navigation suggestions
   */
  getQuickSuggestions(): string[] {
    return [
      'How do I log a trade?',
      'Where can I find the academy videos?',
      'How do I join a live session?',
      'How do I book a mentorship call?',
      'Where can I manage my subscription?',
    ];
  }
}
