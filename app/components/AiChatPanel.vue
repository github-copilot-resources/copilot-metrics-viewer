<template>
  <Teleport to="body">
    <div class="ai-chat-panel" style="position: fixed; bottom: 16px; right: 16px; z-index: 2147483647;">
      <!-- Floating Action Button -->
      <v-btn
        v-if="!isOpen"
        class="ai-chat-fab"
        color="indigo"
        icon
        size="large"
        elevation="6"
        style="position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;"
        @click="isOpen = true"
      >
        <v-icon>mdi-robot-outline</v-icon>
        <v-tooltip activator="parent" :z-index="2147483647" location="left">Ask AI about metrics</v-tooltip>
      </v-btn>

      <!-- Chat Dialog -->
      <v-card
        v-if="isOpen"
        class="ai-chat-card"
        elevation="12"
        rounded="lg"
        style="z-index: 2147483647; background: #ffffff;"
      >
      <!-- Header -->
      <v-toolbar color="indigo" density="compact" flat>
        <v-icon class="ml-3">mdi-robot-outline</v-icon>
        <v-toolbar-title class="text-body-1 font-weight-medium">
          AI Metrics Assistant
        </v-toolbar-title>
        <v-spacer />
        <v-btn v-if="userToken" icon size="small" variant="text" @click="clearUserToken" title="Disconnect token">
          <v-icon size="small">mdi-key-remove</v-icon>
          <v-tooltip activator="parent" :z-index="2147483647" location="bottom">Disconnect personal token</v-tooltip>
        </v-btn>
        <v-btn icon size="small" variant="text" @click="clearConversation">
          <v-icon size="small">mdi-delete-outline</v-icon>
          <v-tooltip activator="parent" :z-index="2147483647" location="bottom">Clear conversation</v-tooltip>
        </v-btn>
        <v-btn icon size="small" variant="text" @click="isOpen = false">
          <v-icon size="small">mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <!-- Messages -->
      <div ref="messagesContainer" class="ai-chat-messages">
        <!-- Welcome message -->
        <div v-if="messages.length === 0 && !tokenSetupNeeded" class="ai-chat-welcome">
          <v-icon size="48" color="grey-lighten-1" class="mb-3">mdi-robot-happy-outline</v-icon>
          <p class="text-body-2 text-grey-darken-1 mb-4">
            Ask me anything about your Copilot metrics!
          </p>

          <!-- Suggested questions -->
          <div class="ai-chat-suggestions">
            <v-chip
              v-for="(q, i) in suggestedQuestions"
              :key="i"
              size="small"
              variant="outlined"
              color="indigo"
              class="ma-1"
              @click="askQuestion(q)"
            >
              {{ q }}
            </v-chip>
          </div>
        </div>

        <!-- Token setup guide -->
        <div v-if="tokenSetupNeeded" class="ai-chat-token-setup pa-3">
          <v-icon size="40" color="warning" class="mb-2">mdi-key-alert</v-icon>
          <p class="text-body-2 font-weight-medium mb-2">AI Token Required</p>
          <p class="text-body-2 text-grey-darken-1 mb-3">
            {{ tokenErrorMessage }}
          </p>

          <v-expansion-panels variant="accordion" class="mb-3">
            <v-expansion-panel>
              <v-expansion-panel-title class="text-body-2 py-2">
                <v-icon size="small" class="mr-2">mdi-server</v-icon>
                Option 1: Server environment variable
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <p class="text-caption text-grey-darken-1 mb-2">
                  An administrator can set the <code>NUXT_AI_TOKEN</code> environment variable on the server
                  with a GitHub fine-grained PAT that has <strong>Models → Read</strong> permission.
                </p>
                <p class="text-caption text-grey-darken-1">
                  The token must be scoped to a <strong>personal account</strong> (not an organization).
                </p>
              </v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel>
              <v-expansion-panel-title class="text-body-2 py-2">
                <v-icon size="small" class="mr-2">mdi-account-key</v-icon>
                Option 2: Provide your personal token
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <p class="text-caption text-grey-darken-1 mb-2">
                  Create a
                  <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener" class="text-indigo">
                    fine-grained personal access token
                  </a>
                  scoped to your <strong>personal account</strong> with <strong>Models → Read</strong> permission.
                </p>
                <v-text-field
                  v-model="userTokenInput"
                  type="password"
                  placeholder="github_pat_..."
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="mb-2"
                  prepend-inner-icon="mdi-key"
                />
                <v-btn
                  color="indigo"
                  size="small"
                  block
                  :disabled="!userTokenInput.trim()"
                  @click="saveUserToken"
                >
                  Save &amp; connect
                </v-btn>
                <p class="text-caption text-grey-darken-2 mt-2">
                  <v-icon size="x-small">mdi-information-outline</v-icon>
                  Token is stored in your browser session only and sent securely to the server per request.
                </p>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>

        <!-- Message bubbles -->
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          :class="['ai-chat-message', msg.role === 'user' ? 'ai-chat-message-user' : 'ai-chat-message-assistant']"
        >
          <div class="ai-chat-bubble">
            <div v-if="msg.role === 'assistant'" class="ai-chat-bubble-content" v-html="formatMarkdown(msg.content)" />
            <div v-else class="ai-chat-bubble-content">{{ msg.content }}</div>
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="isLoading" class="ai-chat-message ai-chat-message-assistant">
          <div class="ai-chat-bubble ai-chat-loading">
            <v-progress-circular size="16" width="2" indeterminate color="indigo" class="mr-2" />
            <span class="text-body-2 text-grey-darken-1">
              {{ loadingText }}
            </span>
          </div>
        </div>

        <!-- Error message -->
        <v-alert
          v-if="errorMessage"
          type="error"
          density="compact"
          variant="tonal"
          class="ma-2"
          closable
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>
      </div>

      <!-- Input -->
      <v-divider />
      <div class="ai-chat-input pa-2">
        <v-text-field
          v-model="inputText"
          placeholder="Ask about your Copilot metrics..."
          variant="outlined"
          density="compact"
          hide-details
          :disabled="isLoading"
          @keyup.enter="sendMessage"
        >
          <template #append-inner>
            <v-btn
              icon
              size="small"
              variant="text"
              color="indigo"
              :disabled="!inputText.trim() || isLoading"
              @click="sendMessage"
            >
              <v-icon>mdi-send</v-icon>
            </v-btn>
          </template>
        </v-text-field>
      </div>
    </v-card>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { getSuggestedQuestions } from '../../server/services/ai-tools';

interface Props {
  currentTab?: string;
  queryParams?: Record<string, string>;
  metrics?: unknown[];
  seats?: unknown[];
  totalSeats?: number;
  userMetrics?: unknown[];
  reportData?: unknown[];
}

const props = withDefaults(defineProps<Props>(), {
  currentTab: undefined,
  queryParams: undefined,
  metrics: undefined,
  seats: undefined,
  totalSeats: undefined,
  userMetrics: undefined,
  reportData: undefined,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const isOpen = ref(false);
const inputText = ref('');
const messages = ref<ChatMessage[]>([]);
const isLoading = ref(false);
const loadingText = ref('Thinking...');
const errorMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const tokenSetupNeeded = ref(false);
const tokenErrorMessage = ref('');
const userTokenInput = ref('');
const userToken = ref('');

// Restore user token from sessionStorage
if (import.meta.client) {
  const stored = sessionStorage.getItem('ai-chat-user-token');
  if (stored) userToken.value = stored;
}

const suggestedQuestions = computed(() => getSuggestedQuestions(props.currentTab));

function clearConversation() {
  messages.value = [];
  errorMessage.value = '';
  tokenSetupNeeded.value = false;
}

function saveUserToken() {
  const token = userTokenInput.value.trim();
  if (!token) return;
  userToken.value = token;
  userTokenInput.value = '';
  tokenSetupNeeded.value = false;
  if (import.meta.client) {
    sessionStorage.setItem('ai-chat-user-token', token);
  }
}

function clearUserToken() {
  userToken.value = '';
  userTokenInput.value = '';
  if (import.meta.client) {
    sessionStorage.removeItem('ai-chat-user-token');
  }
}

function askQuestion(question: string) {
  inputText.value = question;
  sendMessage();
}

async function sendMessage() {
  const question = inputText.value.trim();
  if (!question || isLoading.value) return;

  inputText.value = '';
  errorMessage.value = '';

  // Add user message
  messages.value.push({ role: 'user', content: question });
  await scrollToBottom();

  isLoading.value = true;
  loadingText.value = 'Analyzing metrics...';

  try {
    // Build conversation history for context (limit to last 10 messages)
    const history = messages.value.slice(0, -1).slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const response = await $fetch('/api/ai/chat', {
      method: 'POST',
      body: {
        question,
        conversationHistory: history,
        currentTab: props.currentTab,
        queryParams: props.queryParams,
        userToken: userToken.value || undefined,
        dashboardData: {
          metrics: props.metrics,
          seats: props.seats,
          totalSeats: props.totalSeats,
          userMetrics: props.userMetrics,
          reportData: props.reportData,
        },
      },
    });

    const result = response as { answer: string; toolsUsed?: string[]; rounds?: number };

    messages.value.push({
      role: 'assistant',
      content: result.answer,
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; statusMessage?: string; data?: { statusMessage?: string; data?: { code?: string; message?: string } }; message?: string };
    const errorCode = err.data?.data?.code || err.statusMessage;
    const errorMsg = err.data?.data?.message || err.data?.statusMessage || err.message || 'An error occurred';

    if (errorCode === 'missing_token' || errorCode === 'invalid_token') {
      tokenSetupNeeded.value = true;
      tokenErrorMessage.value = errorMsg;
      // Remove the user's message that triggered the error so they can retry
      messages.value.pop();
    } else {
      errorMessage.value = errorMsg;
    }
  } finally {
    isLoading.value = false;
    await scrollToBottom();
  }
}

async function scrollToBottom() {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

function formatMarkdown(text: string): string {
  if (!text) return '';
  // Basic markdown formatting for assistant messages
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// Auto-scroll when messages change
watch(messages, () => scrollToBottom(), { deep: true });
</script>

<style scoped>
.ai-chat-panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
}

.ai-chat-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
}

.ai-chat-card {
  width: 420px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
}

.ai-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  min-height: 200px;
  max-height: 420px;
}

.ai-chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 12px;
  text-align: center;
}

.ai-chat-token-setup {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.ai-chat-token-setup .v-expansion-panels {
  width: 100%;
  text-align: left;
}

.ai-chat-token-setup code {
  background-color: rgba(0, 0, 0, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.85em;
}

.ai-chat-suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}

.ai-chat-message {
  margin-bottom: 8px;
  display: flex;
}

.ai-chat-message-user {
  justify-content: flex-end;
}

.ai-chat-message-assistant {
  justify-content: flex-start;
}

.ai-chat-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  line-height: 1.5;
}

.ai-chat-message-user .ai-chat-bubble {
  background-color: #3f51b5;
  color: white;
  border-bottom-right-radius: 4px;
}

.ai-chat-message-assistant .ai-chat-bubble {
  background-color: #f5f5f5;
  border-bottom-left-radius: 4px;
}

.ai-chat-loading {
  display: flex;
  align-items: center;
}

.ai-chat-bubble-content :deep(code) {
  background-color: rgba(0, 0, 0, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.85em;
}

.ai-chat-input {
  background-color: #ffffff;
}

@media (max-width: 480px) {
  .ai-chat-card {
    width: calc(100vw - 32px);
    max-height: calc(100vh - 100px);
  }
}
</style>
