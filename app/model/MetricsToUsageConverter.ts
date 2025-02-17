import { Metrics, BreakdownData } from "@/model/Metrics";
import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import type { ModelActivityData } from "@/model/ModelActivityData";
import type { ReferenceData } from "@/model/ReferenceData";

/**
 * Converts new format to old format which App expects to display charts
 * @param copilotMetrics metrics in "new" January 2025 format from /metrics API
 * @returns metrics in old - 2024 /usage API format
 */
export const convertToUsageMetrics = (
  copilotMetrics: CopilotMetrics[]
): { usage: Metrics[]; refData: ReferenceData } => {
  try {
    const refData: ReferenceData = {
      languages: [],
      editors: ["dotcom"],
      models: [],
    };

    const usageData: Metrics[] = copilotMetrics.map((metric) => {
      const breakdown: BreakdownData[] = [];
      const model_activity: ModelActivityData[] = [];

      metric.copilot_ide_code_completions?.editors?.forEach((editor) => {
        addIfMissing(refData.editors, editor.name);
        editor.models?.forEach((model) => {
          addIfMissing(refData.models, model.name);

          model_activity.push({
            editor: editor.name,
            name: model.name,
            source: "code",
            total_engaged_users: model.total_engaged_users,
            is_custom_model: model.is_custom_model,
            custom_model_training_date:
              model.custom_model_training_date ?? null,
            total_actions: model.languages.reduce(
              (sum, language) => sum + language.total_code_acceptances,
              0
            ),
          });

          model.languages?.forEach((language) => {
            addIfMissing(refData.languages, language.name);

            breakdown.push(
              new BreakdownData({
                language: language.name,
                editor: editor.name,
                model: model.name,
                is_custom_model: model.is_custom_model,
                custom_model_training_date:
                  model.custom_model_training_date ?? null,
                suggestions_count: language.total_code_suggestions,
                acceptances_count: language.total_code_acceptances,
                lines_suggested: language.total_code_lines_suggested,
                lines_accepted: language.total_code_lines_accepted,
                active_users: language.total_engaged_users,
              })
            );
          });
        });
      });

      metric.copilot_dotcom_chat?.models?.forEach((model) => {
        addIfMissing(refData.models, model.name);

        model_activity.push({
          editor: "dotcom",
          source: "chat",
          name: model.name,
          total_engaged_users: model.total_engaged_users,
          is_custom_model: model.is_custom_model,
          custom_model_training_date: model.custom_model_training_date ?? null,
          total_actions: model.total_chats,
        });
      });

      metric.copilot_ide_chat?.editors?.forEach((editor) => {
        addIfMissing(refData.editors, editor.name);

        editor.models?.forEach((model) => {
          addIfMissing(refData.models, model.name);

          model_activity.push({
            editor: editor.name,
            name: model.name,
            source: "chat",
            total_engaged_users: model.total_engaged_users,
            is_custom_model: model.is_custom_model,
            custom_model_training_date:
              model.custom_model_training_date ?? null,
            total_actions:
              model.total_chat_insertion_events + model.total_chat_copy_events,
          });
        });
      });

      metric.copilot_dotcom_pull_requests?.repositories?.forEach((repo) => {
        repo.models?.forEach((model) => {
          addIfMissing(refData.models, model.name);

          model_activity.push({
            editor: "dotcom",
            source: "pr",
            name: model.name,
            total_engaged_users: model.total_engaged_users,
            is_custom_model: model.is_custom_model,
            custom_model_training_date: model.custom_model_training_date,
            total_actions: model.total_pr_summaries_created,
          });
        });
      });

      const totalChatInsertions =
        metric.copilot_ide_chat?.editors?.reduce(
          (sum, editor) =>
            sum +
            editor.models?.reduce(
              (sum, model) => sum + model.total_chat_insertion_events,
              0
            ),
          0
        ) || 0;

      const totalChatCopies =
        metric.copilot_ide_chat?.editors?.reduce(
          (sum, editor) =>
            sum +
            editor.models?.reduce(
              (sum, model) => sum + model.total_chat_copy_events,
              0
            ),
          0
        ) || 0;

      // console.log(`Date: ${metric.date}`);
      // console.log(`Total Chat Insertions: ${totalChatInsertions}`);
      // console.log(`Total Chat Copies: ${totalChatCopies}`);

      return new Metrics({
        day: metric.date,
        total_suggestions_count: breakdown.reduce(
          (sum, item) => sum + item.suggestions_count,
          0
        ),
        total_acceptances_count: breakdown.reduce(
          (sum, item) => sum + item.acceptances_count,
          0
        ),
        total_lines_suggested: breakdown.reduce(
          (sum, item) => sum + item.lines_suggested,
          0
        ),
        total_lines_accepted: breakdown.reduce(
          (sum, item) => sum + item.lines_accepted,
          0
        ),
        total_active_users: metric.total_active_users || 0,
        total_chat_acceptances: totalChatInsertions + totalChatCopies,
        total_chat_turns:
          metric.copilot_ide_chat?.editors?.reduce(
            (sum, editor) =>
              sum +
              editor.models?.reduce((sum, model) => sum + model.total_chats, 0),
            0
          ) || 0,
        total_active_chat_users:
          metric.copilot_ide_chat?.total_engaged_users || 0,
        breakdown: breakdown,
        model_activity: model_activity,
      });
    });

    return { usage: usageData, refData: refData };
  } catch (error) {
    console.error("Error converting metrics to usage format:", error);
    return { usage: [], refData: { languages: [], editors: [], models: [] } };
  }
};

function addIfMissing(arr: string[], item: string) {
  if (arr.indexOf(item) === -1) {
    arr.push(item);
  }
}
