/**
 * AI Chat Endpoint — POST /api/ai/chat
 *
 * Orchestrates the tool-calling loop between the client, GitHub Models API,
 * and the local tool executor. Returns a streaming or non-streaming LLM response.
 *
 * Flow:
 *   1. Client sends { question, conversationHistory?, currentTab?, queryParams?, dashboardData? }
 *   2. We build messages + tool definitions and call GitHub Models API
 *   3. If the LLM responds with tool_calls, we execute them and loop
 *   4. When the LLM returns a text response, we stream it back
 */

import { aiTools, buildSystemPrompt } from '../../services/ai-tools';
import { executeTool, type ToolCallRequest } from '../../services/ai-tool-executor';
import { isMockMode } from '../../services/github-copilot-usage-api-mock';
import { generateMockChatResponse } from '../../services/ai-chat-mock';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ChatRequest {
  question: string;
  conversationHistory?: ChatMessage[];
  currentTab?: string;
  queryParams?: Record<string, string>;
  userToken?: string;
  dashboardData?: {
    metrics?: unknown[];
    seats?: unknown[];
    totalSeats?: number;
    userMetrics?: unknown[];
    reportData?: unknown[];
  };
}

const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions';
const MAX_TOOL_ROUNDS = 5;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);

  // Feature gate check
  if (!config.public.enableAiChat && config.public.enableAiChat !== 'true') {
    throw createError({
      statusCode: 403,
      statusMessage: 'AI Chat is not enabled. Set NUXT_PUBLIC_ENABLE_AI_CHAT=true to enable.',
    });
  }

  const body = await readBody<ChatRequest>(event);
  if (!body?.question?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Question is required.',
    });
  }

  // Mock mode: return canned responses without calling GitHub Models API
  if (isMockMode()) {
    const mockCachedData = {
      metrics: body.dashboardData?.metrics as any,
      originalMetrics: undefined,
      reportData: body.dashboardData?.reportData as any,
      seats: body.dashboardData?.seats as any,
      totalSeats: body.dashboardData?.totalSeats,
      userMetrics: body.dashboardData?.userMetrics as any,
    };
    return generateMockChatResponse(body.question, body.currentTab, mockCachedData);
  }

  // Use dedicated AI token if set, then fall back to GitHub token, then user-provided token
  const aiToken = (config as Record<string, unknown>).aiToken as string;
  const userToken = body.userToken?.trim();
  const githubToken = aiToken || config.githubToken || userToken;
  if (!githubToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'missing_token',
      data: {
        code: 'missing_token',
        message: 'No AI token configured. An administrator can set NUXT_AI_TOKEN in the server environment, or you can provide a personal GitHub token with models:read scope.',
      },
    });
  }

  const model = (config as Record<string, unknown>).aiModel as string || 'gpt-4o';
  const maxRounds = parseInt(String((config as Record<string, unknown>).aiMaxToolRounds || MAX_TOOL_ROUNDS), 10);

  // Build the system prompt with page context
  const systemPrompt = buildSystemPrompt({
    currentTab: body.currentTab,
    scope: body.queryParams?.scope,
    identifier: body.queryParams?.githubOrg || body.queryParams?.githubEnt,
    dateRange: {
      since: body.queryParams?.since,
      until: body.queryParams?.until,
    },
  });

  // Build message history
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history if provided (skip system messages — we provide our own)
  if (body.conversationHistory?.length) {
    for (const msg of body.conversationHistory) {
      if (msg.role !== 'system') {
        messages.push(msg);
      }
    }
  }

  // Add the current question
  messages.push({ role: 'user', content: body.question });

  // Prepare cached data from the dashboard for tool execution
  const cachedData = {
    metrics: body.dashboardData?.metrics as any,
    originalMetrics: undefined,
    reportData: body.dashboardData?.reportData as any,
    seats: body.dashboardData?.seats as any,
    totalSeats: body.dashboardData?.totalSeats,
    userMetrics: body.dashboardData?.userMetrics as any,
  };

  // Tool-calling loop
  let round = 0;
  let lastResponse: ChatCompletionResponse | null = null;
  const toolsUsed: string[] = [];

  while (round < maxRounds) {
    round++;

    try {
      lastResponse = await callGitHubModels(githubToken, model, messages, aiTools);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`GitHub Models API error (round ${round}):`, message);

      if (message.includes('401') || message.includes('403') || message.includes('no_access')) {
        throw createError({
          statusCode: 401,
          statusMessage: 'invalid_token',
          data: {
            code: 'invalid_token',
            message: 'GitHub Models API rejected the token. Ensure your token is a personal (not org-scoped) fine-grained PAT with the "models:read" permission.',
          },
        });
      }
      if (message.includes('429')) {
        throw createError({
          statusCode: 429,
          statusMessage: 'GitHub Models API rate limit exceeded. Please try again later.',
        });
      }

      throw createError({
        statusCode: 502,
        statusMessage: `GitHub Models API error: ${message}`,
      });
    }

    const choice = lastResponse.choices?.[0];
    if (!choice) {
      throw createError({ statusCode: 502, statusMessage: 'No response from GitHub Models API.' });
    }

    // If the LLM wants to call tools, execute them
    if (choice.finish_reason === 'tool_calls' || choice.message.tool_calls?.length) {
      // Add the assistant's tool-call message to the conversation
      messages.push({
        role: 'assistant',
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
      });

      // Execute each tool call
      for (const tc of choice.message.tool_calls || []) {
        let args: Record<string, string> = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          // If arguments aren't valid JSON, pass empty
        }

        const toolRequest: ToolCallRequest = {
          name: tc.function.name,
          arguments: args,
        };

        toolsUsed.push(tc.function.name);
        const result = await executeTool(toolRequest, cachedData, event);

        // Add tool result to conversation
        messages.push({
          role: 'tool',
          content: result.data,
          tool_call_id: tc.id,
        });
      }

      // Continue the loop — the LLM will process tool results
      continue;
    }

    // LLM returned a text response — we're done
    return {
      answer: choice.message.content || 'I wasn\'t able to generate a response. Please try rephrasing your question.',
      toolsUsed,
      rounds: round,
      usage: lastResponse.usage,
    };
  }

  // If we exhausted all rounds, return the last response
  const lastContent = lastResponse?.choices?.[0]?.message?.content;
  return {
    answer: lastContent || 'I reached the maximum number of analysis steps. Please try a more specific question.',
    toolsUsed,
    rounds: round,
    usage: lastResponse?.usage,
  };
});

/**
 * Call the GitHub Models API (OpenAI-compatible chat completions).
 */
async function callGitHubModels(
  token: string,
  model: string,
  messages: ChatMessage[],
  tools: typeof aiTools,
): Promise<ChatCompletionResponse> {
  const response = await fetch(GITHUB_MODELS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`${response.status} ${response.statusText}: ${errorText}`);
  }

  return response.json() as Promise<ChatCompletionResponse>;
}
