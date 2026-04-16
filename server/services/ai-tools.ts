/**
 * AI Tool Definitions for GitHub Models API tool-calling
 *
 * Each tool mirrors a dashboard tab / data exploration capability.
 * Schemas follow the OpenAI function-calling format.
 */

export interface AiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
        items?: { type: string };
      }>;
      required?: string[];
    };
  };
}

/**
 * All available AI tools the LLM can call to explore Copilot metrics.
 */
export const aiTools: AiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_metrics_summary',
      description:
        'Get an overall summary of Copilot usage metrics for the current date range. ' +
        'Returns total active users, acceptance rates, lines suggested/accepted, and chat usage totals.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_language_breakdown',
      description:
        'Get Copilot code completion metrics broken down by programming language. ' +
        'Returns suggestions, acceptances, lines suggested/accepted, and active users per language.',
      parameters: {
        type: 'object',
        properties: {
          top_n: {
            type: 'string',
            description: 'Number of top languages to return, sorted by suggestions count. Default is "10".',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_editor_breakdown',
      description:
        'Get Copilot code completion metrics broken down by editor/IDE. ' +
        'Returns suggestions, acceptances, lines suggested/accepted, and active users per editor (e.g. VS Code, JetBrains, Neovim).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_chat_metrics',
      description:
        'Get Copilot Chat usage metrics including total chat turns, active chat users, ' +
        'chat acceptances, and breakdown by editor.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_seat_analysis',
      description:
        'Get Copilot seat allocation and utilization data. ' +
        'Returns total seats, active vs inactive seats, last activity dates, and plan types.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_metrics',
      description:
        'Get per-user Copilot usage metrics. Returns each user\'s activity counts, ' +
        'code generation events, acceptance events, and lines of code metrics. ' +
        'Optionally filter to a specific user login.',
      parameters: {
        type: 'object',
        properties: {
          user_login: {
            type: 'string',
            description: 'Optional: filter to a specific GitHub user login.',
          },
          top_n: {
            type: 'string',
            description: 'Number of top users to return, sorted by activity. Default is "20".',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trend_data',
      description:
        'Get time-series trend data for a specific metric over the date range. ' +
        'Returns day-by-day values useful for analyzing trends, growth, and patterns.',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            description: 'The metric to get trend data for.',
            enum: [
              'active_users',
              'acceptance_rate',
              'suggestions_count',
              'acceptances_count',
              'lines_suggested',
              'lines_accepted',
              'chat_turns',
              'chat_active_users',
            ],
          },
        },
        required: ['metric'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_agent_activity',
      description:
        'Get Copilot agent mode and pull request metrics. ' +
        'Returns PR creation/review/merge stats, Copilot-authored PRs, and agent usage data.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

/**
 * Build the system prompt for the AI chat, optionally including current page context.
 */
export function buildSystemPrompt(context: {
  currentTab?: string;
  scope?: string;
  identifier?: string;
  dateRange?: { since?: string; until?: string };
}): string {
  const parts = [
    'You are an expert analyst for GitHub Copilot usage metrics.',
    'You help users understand their organization\'s Copilot adoption, trends, and performance.',
    'You have access to tools that let you explore the metrics data. Use them to answer questions accurately.',
    'Always cite specific numbers when possible. Identify patterns and provide actionable insights.',
    'Keep responses concise but informative.',
  ];

  if (context.scope || context.identifier) {
    parts.push(`\nCurrent context: scope="${context.scope || 'organization'}", identifier="${context.identifier || 'unknown'}".`);
  }

  if (context.dateRange?.since || context.dateRange?.until) {
    parts.push(`Date range: ${context.dateRange.since || 'start'} to ${context.dateRange.until || 'now'}.`);
  }

  if (context.currentTab) {
    parts.push(`The user is currently viewing the "${context.currentTab}" tab in the dashboard.`);
  }

  return parts.join('\n');
}

/**
 * Get suggested starter questions based on the current tab context.
 */
export function getSuggestedQuestions(currentTab?: string): string[] {
  const general = [
    'What is our overall Copilot adoption trend?',
    'Which areas have the most room for improvement?',
  ];

  switch (currentTab) {
    case 'organization':
    case 'enterprise':
    case 'team':
      return [
        'Summarize our Copilot usage over this period',
        'What is our acceptance rate trend?',
        ...general,
      ];
    case 'languages':
      return [
        'Which programming language has the highest acceptance rate?',
        'Which languages are underperforming in Copilot adoption?',
        ...general,
      ];
    case 'editors':
      return [
        'Which IDE has the most active Copilot users?',
        'Compare VS Code and JetBrains Copilot usage',
        ...general,
      ];
    case 'copilot chat':
      return [
        'How actively is Copilot Chat being used?',
        'What is the trend in chat turns over time?',
        ...general,
      ];
    case 'seat analysis':
      return [
        'How many seats are unused or inactive?',
        'What is our seat utilization rate?',
        ...general,
      ];
    case 'user metrics':
      return [
        'Who are the most active Copilot users?',
        'How many users have zero activity?',
        ...general,
      ];
    case 'agent activity':
    case 'pull requests':
      return [
        'How many PRs were created by Copilot?',
        'What is the Copilot PR merge rate?',
        ...general,
      ];
    default:
      return general;
  }
}
