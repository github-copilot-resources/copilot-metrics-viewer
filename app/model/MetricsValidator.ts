import type { CopilotMetrics } from '@/model/Copilot_Metrics';

export class MetricsValidator {
  metrics: CopilotMetrics[];

  constructor(metrics: CopilotMetrics[]) {
    this.metrics = metrics;
  }

  checkContinuousDates(): string[] {
    if (!this.metrics || this.metrics.length === 0) {
      return [];
    }

    const dates = this.metrics
      .filter(metric => metric && metric.date)
      .map(metric => new Date(metric.date))
      .filter(date => !isNaN(date.getTime()));
    
    if (dates.length === 0) {
      return [];
    }

    dates.sort((a, b) => a.getTime() - b.getTime());
  
    const missingDates: string[] = [];
    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];
      
      if (prevDate && currDate) {
        const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    
        if (diffDays > 1) {
          for (let d = 1; d < diffDays; d++) {
            const missingDate = new Date(prevDate.getTime() + d * (1000 * 60 * 60 * 24));
            const dateString = missingDate.toISOString().split('T')[0];
            if (dateString) {
              missingDates.push(dateString);
            }
          }
        }
      }
    }
    return missingDates;
  }

  validateCodeCompletions(): { date: string, editor: string, language: string }[] {
    const invalidEntries: { date: string, editor: string, language: string }[] = [];

    this.metrics.forEach(metric => {
      if (metric && metric.copilot_ide_code_completions?.editors) {
        metric.copilot_ide_code_completions.editors.forEach(editor => {
          if (editor && editor.models) {
            editor.models.forEach(model => {
              if (model && model.languages) {
                model.languages.forEach(language => {
                  if (language && (
                    language.total_code_acceptances > language.total_code_suggestions ||
                    language.total_code_lines_accepted > language.total_code_lines_suggested
                  )) {
                    invalidEntries.push({
                      date: metric.date,
                      editor: editor.name,
                      language: language.name
                    });
                  }
                });
              }
            });
          }
        });
      }
    });

    return invalidEntries;
  }

  validateChatEngagedUsers(): { date: string, editor: string, total_engaged_users: number }[] {
    const invalidEntries: { date: string, editor: string, total_engaged_users: number }[] = [];

    this.metrics.forEach(metric => {
      if (metric && metric.copilot_ide_chat?.editors) {
        metric.copilot_ide_chat.editors.forEach(editor => {
          if (editor && editor.models) {
            const totalModelEngagedUsers = editor.models.reduce((sum, model) => 
              sum + (model?.total_engaged_users || 0), 0);
            if (totalModelEngagedUsers < (editor.total_engaged_users || 0)) {
              invalidEntries.push({
                date: metric.date,
                editor: editor.name,
                total_engaged_users: editor.total_engaged_users
              });
            }
          }
        });
      }
    });

    return invalidEntries;
  }

  checkAllMetrics() {
    const nonContinuousDates = this.checkContinuousDates();
    const invalidCodeCompletions = this.validateCodeCompletions();
    const invalidChatEngagedUsers = this.validateChatEngagedUsers();

    return {
      nonContinuousDates,
      invalidCodeCompletions,
      invalidChatEngagedUsers
    };
  }
}