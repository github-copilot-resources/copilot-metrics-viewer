import { Metrics, BreakdownData } from "@/model/Metrics";
import type { CopilotMetrics } from '@/model/Copilot_Metrics';

export const convertToMetrics = (copilotMetrics: CopilotMetrics[]): Metrics[] => {
  try {
    if (!copilotMetrics || copilotMetrics.length === 0) {
      return [];
    }

    const usageData: Metrics[] = copilotMetrics.map(metric => {
      if (!metric) {
        return new Metrics({
          day: '',
          total_suggestions_count: 0,
          total_acceptances_count: 0,
          total_lines_suggested: 0,
          total_lines_accepted: 0,
          total_active_users: 0,
          total_chat_acceptances: 0,
          total_chat_turns: 0,
          total_active_chat_users: 0,
          breakdown: []
        });
      }

      const breakdown: BreakdownData[] = [];

      metric.copilot_ide_code_completions?.editors?.forEach(editor => {
        if (editor && editor.models) {
          editor.models.forEach(model => {
            if (model && model.languages) {
              model.languages.forEach(language => {
                if (language) {
                  breakdown.push(new BreakdownData({
                    language: language.name,
                    editor: editor.name,
                    suggestions_count: language.total_code_suggestions || 0,
                    acceptances_count: language.total_code_acceptances || 0,
                    lines_suggested: language.total_code_lines_suggested || 0,
                    lines_accepted: language.total_code_lines_accepted || 0,
                    active_users: language.total_engaged_users || 0
                  }));
                }
              });
            }
          });
        }
      });

      const totalChatInsertions = metric.copilot_ide_chat?.editors?.reduce((sum, editor) => {
        if (editor && editor.models) {
          return sum + editor.models.reduce((modelSum, model) => {
            return modelSum + (model?.total_chat_insertion_events || 0);
          }, 0);
        }
        return sum;
      }, 0) || 0;

      const totalChatCopies = metric.copilot_ide_chat?.editors?.reduce((sum, editor) => {
        if (editor && editor.models) {
          return sum + editor.models.reduce((modelSum, model) => {
            return modelSum + (model?.total_chat_copy_events || 0);
          }, 0);
        }
        return sum;
      }, 0) || 0;

      const totalChatTurns = metric.copilot_ide_chat?.editors?.reduce((sum, editor) => {
        if (editor && editor.models) {
          return sum + editor.models.reduce((modelSum, model) => {
            return modelSum + (model?.total_chats || 0);
          }, 0);
        }
        return sum;
      }, 0) || 0;

      return new Metrics({
        day: metric.date,
        total_suggestions_count: breakdown.reduce((sum, item) => sum + (item.suggestions_count || 0), 0),
        total_acceptances_count: breakdown.reduce((sum, item) => sum + (item.acceptances_count || 0), 0),
        total_lines_suggested: breakdown.reduce((sum, item) => sum + (item.lines_suggested || 0), 0),
        total_lines_accepted: breakdown.reduce((sum, item) => sum + (item.lines_accepted || 0), 0),
        total_active_users: metric.total_active_users || 0,
        total_chat_acceptances: totalChatInsertions + totalChatCopies,
        total_chat_turns: totalChatTurns,
        total_active_chat_users: metric.copilot_ide_chat?.total_engaged_users || 0,
        breakdown: breakdown
      });
    });

    return usageData;
  } catch (error) {
    console.error('Error converting metrics to usage format:', error);
    return [];
  }
};