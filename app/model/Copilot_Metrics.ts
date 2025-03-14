
export class CopilotIdeCodeCompletionsEditorModelLanguage {
  name: string;
  total_engaged_users: number;
  total_code_suggestions: number;
  total_code_acceptances: number;
  total_code_lines_suggested: number;
  total_code_lines_accepted: number;

  constructor(data: any) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
    this.total_code_suggestions = data.total_code_suggestions;
    this.total_code_acceptances = data.total_code_acceptances;
    this.total_code_lines_suggested = data.total_code_lines_suggested;
    this.total_code_lines_accepted = data.total_code_lines_accepted;
  }
}
export class CopilotIdeCodeCompletionsEditorModel {
  name: string;
  is_custom_model: boolean;
  custom_model_training_date?: string | null;
  total_engaged_users: number;
  languages: CopilotIdeCodeCompletionsEditorModelLanguage[];

  constructor(data: any) {
    this.name = data.name;
    this.is_custom_model = data.is_custom_model;
    this.custom_model_training_date = data.custom_model_training_date || null;
    this.total_engaged_users = data.total_engaged_users;
    this.languages = data.languages
      ? data.languages.map(
          (lang: any) => new CopilotIdeCodeCompletionsEditorModelLanguage(lang)
        )
      : [];
  }
}
export class CopilotIdeCodeCompletionsEditor {
  name: string;
  total_engaged_users: number;
  models: CopilotIdeCodeCompletionsEditorModel[];

  constructor(data: any) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map((model: any) => new CopilotIdeCodeCompletionsEditorModel(model))
      : [];
  }
}

export class CopilotIdeCodeCompletionsLanguage {
  name: string;
  total_engaged_users: number;

  constructor(data: any) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
  }
}
export class CopilotIdeCodeCompletions {
  total_engaged_users: number;
  languages: CopilotIdeCodeCompletionsLanguage[];
  editors: CopilotIdeCodeCompletionsEditor[];

  constructor(data: any) {
    this.total_engaged_users = data.total_engaged_users;
    this.languages = data.languages
      ? data.languages.map((lang: any) => new CopilotIdeCodeCompletionsLanguage(lang))
      : [];
    this.editors = data.editors
      ? data.editors.map((editor: any) => new CopilotIdeCodeCompletionsEditor(editor))
      : [];
  }


}

export class CopilotIdeChatEditorModel {
  name: string;
  is_custom_model: boolean;
  custom_model_training_date?: string | null;
  total_engaged_users: number;
  total_chats: number;
  total_chat_insertion_events: number;
  total_chat_copy_events: number;

  constructor(data: any) {
    this.name = data.name;
    this.is_custom_model = data.is_custom_model;
    this.custom_model_training_date = data.custom_model_training_date || null;
    this.total_engaged_users = data.total_engaged_users;
    this.total_chats = data.total_chats;
    this.total_chat_insertion_events = data.total_chat_insertion_events;
    this.total_chat_copy_events = data.total_chat_copy_events;
  }
}



export class CopilotIdeChatEditor {
  name: string;
  total_engaged_users: number;
  models: CopilotIdeChatEditorModel[];

  constructor(data: any) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map((model: any) => new CopilotIdeChatEditorModel(model))
      : [];
  }
}

export class CopilotIdeChat {
  total_engaged_users: number;
  editors: CopilotIdeChatEditor[];

  constructor(data: any) {
    this.total_engaged_users = data.total_engaged_users;
    this.editors = data.editors
      ? data.editors.map((editor: any) => new CopilotIdeChatEditor(editor))
      : [];
  }
}

export class CopilotDotcomChatModel {
  name: string;
  is_custom_model: boolean;
  custom_model_training_date?: string | null;
  total_engaged_users: number;
  total_chats: number;

  constructor(data: any) {
    this.name = data.name;
    this.is_custom_model = data.is_custom_model;
    this.custom_model_training_date = data.custom_model_training_date || null;
    this.total_engaged_users = data.total_engaged_users;
    this.total_chats = data.total_chats;
  }
}

export class CopilotDotcomPullRequestsRepositoryModel {
  name: string;
  is_custom_model: boolean;
  custom_model_training_date?: string | null;
  total_pr_summaries_created: number;
  total_engaged_users: number;

  constructor(data: any) {
    this.name = data.name;
    this.is_custom_model = data.is_custom_model;
    this.custom_model_training_date = data.custom_model_training_date || null;
    this.total_pr_summaries_created = data.total_pr_summaries_created;
    this.total_engaged_users = data.total_engaged_users;
  }
}

export class CopilotDotcomPullRequestsRepository {
  name: string;
  total_engaged_users: number;
  models: CopilotDotcomPullRequestsRepositoryModel[];

  constructor(data: any) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map(
          (model: any) => new CopilotDotcomPullRequestsRepositoryModel(model)
        )
      : [];
  }
}

export class CopilotDotcomPullRequests {
  total_engaged_users: number;
  repositories: CopilotDotcomPullRequestsRepository[];

  constructor(data: any) {
    this.total_engaged_users = data.total_engaged_users;
    this.repositories = data.repositories
      ? data.repositories.map(
          (repo: any) => new CopilotDotcomPullRequestsRepository(repo)
        )
      : [];
  }
}

export class CopilotDotcomChat {
  total_engaged_users: number;
  models: CopilotDotcomChatModel[];

  constructor(data: any) {
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map((model: any) => new CopilotDotcomChatModel(model))
      : [];
  }
}

export class CopilotMetrics {
  date: string; // The format is as :YYYY-MM-DD
  total_active_users: number;
  total_engaged_users: number;
  copilot_ide_code_completions?: CopilotIdeCodeCompletions | null;
  copilot_ide_chat?: CopilotIdeChat | null;
  copilot_dotcom_chat?: CopilotDotcomChat | null;
  copilot_dotcom_pull_requests?: CopilotDotcomPullRequests | null;

  constructor(data: any) {
    this.date = data.date;
    this.total_active_users = data.total_active_users;
    this.total_engaged_users = data.total_engaged_users;
    this.copilot_ide_code_completions = data.copilot_ide_code_completions
      ? new CopilotIdeCodeCompletions(data.copilot_ide_code_completions)
      : null;
    this.copilot_ide_chat = data.copilot_ide_chat
      ? new CopilotIdeChat(data.copilot_ide_chat)
      : null;
    this.copilot_dotcom_chat = data.copilot_dotcom_chat
      ? new CopilotDotcomChat(data.copilot_dotcom_chat)
      : null;
    this.copilot_dotcom_pull_requests = data.copilot_dotcom_pull_requests
      ? new CopilotDotcomPullRequests(data.copilot_dotcom_pull_requests)
      : null;
  }

}