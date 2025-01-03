import { Metrics, BreakdownData } from "../model/Metrics";
import { CopilotMetrics } from '../model/Copilot_Metrics';

export const convertToMetrics = (copilotMetrics: CopilotMetrics[]): Metrics[] => {
  try {
    const usageData: Metrics[] = copilotMetrics.map(metric => {
      const breakdown: BreakdownData[] = [];

      metric.copilot_ide_code_completions?.editors?.forEach(editor => {
        editor.models?.forEach(model => {
          model.languages?.forEach(language => {
            breakdown.push(new BreakdownData({
              language: language.name,
              editor: editor.name,
              suggestions_count: language.total_code_suggestions,
              acceptances_count: language.total_code_acceptances,
              lines_suggested: language.total_code_lines_suggested,
              lines_accepted: language.total_code_lines_accepted,
              active_users: language.total_engaged_users
            }));
          });
        });
      });

      const totalChatInsertions = metric.copilot_ide_chat?.editors?.reduce((sum, editor) => 
        sum + editor.models?.reduce((sum, model) => sum + model.total_chat_insertion_events, 0), 0) || 0;

      const totalChatCopies = metric.copilot_ide_chat?.editors?.reduce((sum, editor) => 
        sum + editor.models?.reduce((sum, model) => sum + model.total_chat_copy_events, 0), 0) || 0;

      console.log(`Date: ${metric.date}`);
      console.log(`Total Chat Insertions: ${totalChatInsertions}`);
      console.log(`Total Chat Copies: ${totalChatCopies}`);

      return new Metrics({
        day: metric.date,
        total_suggestions_count: breakdown.reduce((sum, item) => sum + item.suggestions_count, 0),
        total_acceptances_count: breakdown.reduce((sum, item) => sum + item.acceptances_count, 0),
        total_lines_suggested: breakdown.reduce((sum, item) => sum + item.lines_suggested, 0),
        total_lines_accepted: breakdown.reduce((sum, item) => sum + item.lines_accepted, 0),
        total_active_users: metric.total_active_users || 0,
        total_chat_acceptances: totalChatInsertions + totalChatCopies,
        total_chat_turns: metric.copilot_ide_chat?.editors?.reduce((sum, editor) => 
          sum + editor.models?.reduce((sum, model) => sum + model.total_chats, 0), 0) || 0,
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