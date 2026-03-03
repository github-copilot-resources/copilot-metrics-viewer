/**
 * Transforms data from the new Copilot Usage Metrics Report API format
 * into the CopilotMetrics format that the UI components expect.
 *
 * New API: { day_totals: [{ day, totals_by_ide, totals_by_feature, totals_by_language_feature, ... }] }
 * Old API: [{ date, copilot_ide_code_completions: { editors: [{ models: [{ languages }] }] }, ... }]
 */

import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { OrgReport, ReportDayTotals } from './github-copilot-usage-api';

/**
 * Transform an entire OrgReport into an array of CopilotMetrics records.
 */
export function transformReportToMetrics(report: OrgReport): CopilotMetrics[] {
  return report.day_totals.map(transformDayToMetrics);
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
 * Maps totals_by_language_feature (feature=code_completion) into editors → models → languages.
 */
function buildCodeCompletions(day: ReportDayTotals) {
  const completionFeatures = ['code_completion'];
  const langFeatures = day.totals_by_language_feature.filter(
    lf => completionFeatures.includes(lf.feature)
  );
  const langModels = day.totals_by_language_model;

  // Group by IDE: each IDE gets one "default" model with language breakdowns
  const editors = day.totals_by_ide.map(ide => {
    // Build language breakdown from totals_by_language_feature for code_completion
    const languages = langFeatures.map(lf => ({
      name: lf.language,
      total_engaged_users: 0,
      total_code_suggestions: lf.code_generation_activity_count,
      total_code_acceptances: lf.code_acceptance_activity_count,
      total_code_lines_suggested: lf.loc_suggested_to_add_sum,
      total_code_lines_accepted: lf.loc_added_sum,
    }));

    // Build model breakdown from totals_by_language_model
    const modelNames = [...new Set(langModels.map(lm => lm.model))];
    const models = modelNames.map(modelName => {
      const modelLangs = langModels.filter(lm => lm.model === modelName);
      return {
        name: modelName,
        is_custom_model: modelName !== 'default',
        custom_model_training_date: null as string | null,
        total_engaged_users: 0,
        languages: modelLangs.map(ml => ({
          name: ml.language,
          total_engaged_users: 0,
          total_code_suggestions: ml.code_generation_activity_count,
          total_code_acceptances: ml.code_acceptance_activity_count,
          total_code_lines_suggested: ml.loc_suggested_to_add_sum,
          total_code_lines_accepted: ml.loc_added_sum,
        })),
      };
    });

    // If no models found, create a default one with language data
    if (models.length === 0 && languages.length > 0) {
      models.push({
        name: 'default',
        is_custom_model: false,
        custom_model_training_date: null,
        total_engaged_users: 0,
        languages,
      });
    }

    return {
      name: ide.ide,
      total_engaged_users: 0,
      models,
    };
  });

  // Build top-level language summary
  const languageSummary = langFeatures.map(lf => ({
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
 * Maps chat features (chat_panel_agent_mode, chat_panel_ask_mode, etc.) into IDE chat structure.
 */
function buildIdeChat(day: ReportDayTotals) {
  const chatFeatures = ['chat_panel_agent_mode', 'chat_panel_ask_mode', 'chat_panel_custom_mode'];
  const chatData = day.totals_by_feature.filter(f => chatFeatures.includes(f.feature));

  const totalChats = chatData.reduce((sum, f) => sum + f.user_initiated_interaction_count, 0);

  const editors = day.totals_by_ide.map(ide => {
    // Build models from totals_by_model_feature for chat features
    const chatModelFeatures = day.totals_by_model_feature.filter(
      mf => chatFeatures.includes(mf.feature)
    );
    const modelNames = [...new Set(chatModelFeatures.map(mf => mf.model))];

    const models = modelNames.map(modelName => {
      const modelFeats = chatModelFeatures.filter(mf => mf.model === modelName);
      return {
        name: modelName,
        is_custom_model: modelName !== 'default',
        total_engaged_users: 0,
        total_chats: modelFeats.reduce((s, f) => s + f.user_initiated_interaction_count, 0),
        total_chat_copy_events: 0,
        total_chat_insertion_events: 0,
      };
    });

    return {
      name: ide.ide,
      total_engaged_users: 0,
      models,
    };
  });

  return {
    total_engaged_users: 0,
    editors,
  };
}

/**
 * Build copilot_dotcom_chat from report data.
 * The new API doesn't separate dotcom chat, so we return an empty structure.
 */
function buildDotcomChat(_day: ReportDayTotals) {
  return {
    total_engaged_users: 0,
    models: [],
  };
}

/**
 * Build copilot_dotcom_pull_requests from report data.
 * The new API doesn't have per-repository PR data, so we return an empty structure.
 */
function buildPullRequests(_day: ReportDayTotals) {
  return {
    total_engaged_users: 0,
    repositories: [],
  };
}
