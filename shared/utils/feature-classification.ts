/**
 * Shared constants for classifying Copilot usage features.
 * Used by UI components, report transformers, and AI tools.
 */

/** Features that count as "chat" activity */
export const CHAT_FEATURES = [
  'chat_panel_agent_mode',
  'chat_panel_ask_mode',
  'chat_panel_edit_mode',
  'chat_panel_custom_mode',
  'chat_panel_unknown_mode',
  'chat_inline',
];

/** Features that count as "agent" activity */
export const AGENT_FEATURES = [
  'chat_panel_agent_mode',
  'agent_edit',
];

/** Features that count as "code completion" (inline suggestions) */
export const COMPLETION_FEATURES = ['code_completion'];

/** Human-readable labels for feature names */
export const FEATURE_LABELS: Record<string, string> = {
  code_completion: 'Code Completion',
  chat_panel_ask_mode: 'Chat (Ask)',
  chat_panel_agent_mode: 'Chat (Agent)',
  chat_panel_edit_mode: 'Chat (Edit)',
  chat_panel_custom_mode: 'Chat (Custom)',
  chat_panel_unknown_mode: 'Chat (Other)',
  chat_inline: 'Inline Chat',
  agent_edit: 'Agent Edit',
};
