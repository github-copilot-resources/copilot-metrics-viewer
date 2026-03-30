/**
 * Transforms data from the new Copilot Usage Metrics Report API format
 * into the CopilotMetrics format that the UI components expect.
 *
 * New API: { day_totals: [{ day, totals_by_ide, totals_by_feature, totals_by_language_feature, ... }] }
 * Old API: [{ date, copilot_ide_code_completions: { editors: [{ models: [{ languages }] }] }, ... }]
 *
 * Key mapping notes:
 * - code_generation_activity_count → total_code_suggestions (activities, not individual suggestions)
 * - code_acceptance_activity_count → total_code_acceptances (activities, not individual acceptances)
 * - Must filter by feature ('code_completion' for completions, 'chat_*' for chat, etc.)
 * - loc_added_sum includes ALL features; must scope to specific feature for accurate LOC
 */

import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { OrgReport, ReportDayTotals } from './github-copilot-usage-api';

const COMPLETION_FEATURES = ['code_completion'];
const CHAT_FEATURES = [
  'chat_panel_agent_mode', 'chat_panel_ask_mode', 'chat_panel_edit_mode',
  'chat_panel_custom_mode', 'chat_panel_unknown_mode', 'chat_inline',
];

export function sortReportDayTotalsByDay(dayTotals: ReportDayTotals[]): ReportDayTotals[] {
  return [...dayTotals].sort((left, right) => left.day.localeCompare(right.day));
}

export function sortCopilotMetricsByDate(metrics: CopilotMetrics[]): CopilotMetrics[] {
  return [...metrics].sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Transform an entire OrgReport into an array of CopilotMetrics records.
 */
export function transformReportToMetrics(report: OrgReport): CopilotMetrics[] {
  return sortReportDayTotalsByDay(report.day_totals).map(transformDayToMetrics);
}

/**
 * Transform a single day's report data into a CopilotMetrics record.
 */
export function transformDayToMetrics(day: ReportDayTotals): CopilotMetrics {
  return {
    date: day.day,
    total_active_users: day.daily_active_users,
    total_engaged_users: day.daily_active_users,
    copilot_ide_code_completions: buildCodeCompletions(day),
    copilot_ide_chat: buildIdeChat(day),
    copilot_dotcom_chat: buildDotcomChat(day),
    copilot_dotcom_pull_requests: buildPullRequests(day),
  };
}

/**
 * Build copilot_ide_code_completions from report data.
 * Only uses 'code_completion' feature for accurate suggestion/acceptance counts.
 */
function buildCodeCompletions(day: ReportDayTotals) {
  // Language breakdown scoped to code_completion feature only
  const completionLangs = (day.totals_by_language_feature || []).filter(
    lf => COMPLETION_FEATURES.includes(lf.feature)
  );

  // Model breakdown scoped to code_completion feature only
  const completionModels = (day.totals_by_model_feature || []).filter(
    mf => COMPLETION_FEATURES.includes(mf.feature)
  );

  // Build one editor entry per IDE, with model → language nesting
  const editors = (day.totals_by_ide || []).map(ide => {
    // Build models from model_feature data (code_completion only)
    const modelNames = [...new Set(completionModels.map(m => m.model))];
    const models = modelNames.map(modelName => {
      const modelData = completionModels.find(m => m.model === modelName);
      // totals_by_language_model has no feature field, so we can't filter it.
      // Use totals_by_language_feature (code_completion filtered) for per-language LOC.
      const languages = completionLangs.map(lf => ({
        name: lf.language,
        total_engaged_users: 0,
        total_code_suggestions: lf.code_generation_activity_count,
        total_code_acceptances: lf.code_acceptance_activity_count,
        total_code_lines_suggested: lf.loc_suggested_to_add_sum,
        total_code_lines_accepted: lf.loc_added_sum,
      }));

      return {
        name: modelName,
        is_custom_model: false,
        custom_model_training_date: null as string | null,
        total_engaged_users: 0,
        languages,
      };
    });

    // Fallback: if no model data, create a 'default' model from language features
    if (models.length === 0 && completionLangs.length > 0) {
      models.push({
        name: 'default',
        is_custom_model: false,
        custom_model_training_date: null,
        total_engaged_users: 0,
        languages: completionLangs.map(lf => ({
          name: lf.language,
          total_engaged_users: 0,
          total_code_suggestions: lf.code_generation_activity_count,
          total_code_acceptances: lf.code_acceptance_activity_count,
          total_code_lines_suggested: lf.loc_suggested_to_add_sum,
          total_code_lines_accepted: lf.loc_added_sum,
        })),
      });
    }

    return {
      name: ide.ide,
      total_engaged_users: 0,
      models,
    };
  });

  // Language summary from code_completion feature
  const languageSummary = completionLangs.map(lf => ({
    name: lf.language,
    total_engaged_users: 0,
  }));

  return {
    total_engaged_users: 0,
    languages: languageSummary,
    editors,
  };
}

/**
 * Build copilot_ide_chat from report data.
 * Maps chat_panel_* and chat_inline features from totals_by_feature.
 */
function buildIdeChat(day: ReportDayTotals) {
  // Chat model breakdown from model_feature data (chat features only)
  const chatModelFeatures = (day.totals_by_model_feature || []).filter(
    mf => CHAT_FEATURES.includes(mf.feature)
  );

  const editors = (day.totals_by_ide || []).map(ide => {
    // Aggregate by model across all chat features
    const modelNames = [...new Set(chatModelFeatures.map(mf => mf.model))];
    const models = modelNames.map(modelName => {
      const modelFeats = chatModelFeatures.filter(mf => mf.model === modelName);
      return {
        name: modelName,
        is_custom_model: false,
        total_engaged_users: 0,
        total_chats: modelFeats.reduce((s, f) => s + f.user_initiated_interaction_count, 0),
        total_chat_copy_events: modelFeats.reduce((s, f) => s + f.code_acceptance_activity_count, 0),
        total_chat_insertion_events: modelFeats.reduce((s, f) => s + f.code_generation_activity_count, 0),
      };
    });

    // Fallback: if no model data, create one from feature totals
    if (models.length === 0) {
      const chatFeatures = (day.totals_by_feature || []).filter(
        f => CHAT_FEATURES.includes(f.feature)
      );
      const totalChats = chatFeatures.reduce((s, f) => s + f.user_initiated_interaction_count, 0);
      if (totalChats > 0) {
        models.push({
          name: 'default',
          is_custom_model: false,
          total_engaged_users: 0,
          total_chats: totalChats,
          total_chat_copy_events: chatFeatures.reduce((s, f) => s + f.code_acceptance_activity_count, 0),
          total_chat_insertion_events: chatFeatures.reduce((s, f) => s + f.code_generation_activity_count, 0),
        });
      }
    }

    return {
      name: ide.ide,
      total_engaged_users: 0,
      models,
    };
  });

  return {
    total_engaged_users: day.monthly_active_chat_users || 0,
    editors,
  };
}

/**
 * Build copilot_dotcom_chat from report data.
 * The new API doesn't separate dotcom chat from IDE chat, so we return empty.
 */
function buildDotcomChat(_day: ReportDayTotals) {
  return {
    total_engaged_users: 0,
    models: [],
  };
}

/**
 * Build copilot_dotcom_pull_requests from report data.
 * The new API has a top-level `pull_requests` object, but we can't map it
 * into per-repository breakdowns. Return empty for now — PR data will be
 * shown in a dedicated new component.
 */
function buildPullRequests(_day: ReportDayTotals) {
  return {
    total_engaged_users: 0,
    repositories: [],
  };
}
