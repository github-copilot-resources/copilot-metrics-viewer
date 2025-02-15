/**
 * Represents usage metrics for Copilot for a given day.
 *
 * @remarks
 * This class conforms to the "Copilot Usage Metrics" schema:
 * - date: The date for which the usage metrics are aggregated, in `YYYY-MM-DD` format.
 * - total_active_users: The total number of Copilot users with any activity.
 * - total_engaged_users: The total number of users who engaged with any Copilot feature.
 * - copilot_ide_code_completions: Usage metrics for Copilot editor code completions.
 * - copilot_ide_chat: Usage metrics for Copilot Chat in the IDE.
 * - copilot_dotcom_chat: Usage metrics for Copilot Chat on GitHub.com.
 * - copilot_dotcom_pull_requests: Usage metrics for Copilot for pull requests.
 */
export class CopilotMetrics {
  /** The date for which the usage metrics are aggregated, in `YYYY-MM-DD` format. */
  date: string;
  /** The total number of Copilot users with any activity. */
  total_active_users: number;
  /** The total number of users who engaged with any Copilot feature. */
  total_engaged_users: number;
  /** Usage metrics for Copilot editor code completions. */
  copilot_ide_code_completions?: CopilotIdeCodeCompletions | null;
  /** Usage metrics for Copilot Chat in the IDE. */
  copilot_ide_chat?: CopilotIdeChat | null;
  /** Usage metrics for Copilot Chat on GitHub.com. */
  copilot_dotcom_chat?: CopilotDotcomChat | null;
  /** Usage metrics for Copilot for pull requests. */
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

/**
 * Usage metrics for Copilot IDE code completions.
 *
 * @remarks
 * - total_engaged_users: Number of users accepting code suggestions.
 * - languages: List of languages with their respective metrics.
 * - editors: List of editors with detailed model and language metrics.
 */
export class CopilotIdeCodeCompletions {
  /** Number of users accepting code suggestions. */
  total_engaged_users: number;
  /** List of languages with their respective metrics. */
  languages: CopilotIdeCodeCompletionsLanguage[];
  /** List of editors with detailed model and language metrics. */
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

/**
 * Usage metrics for a given language in IDE code completions.
 *
 * @remarks
 * - name: The language name.
 * - total_engaged_users: Number of users for the language.
 */
export class CopilotIdeCodeCompletionsLanguage {
  /** The language name. */
  name: string;
  /** Number of users for the language. */
  total_engaged_users: number;

  constructor(data: any) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
  }
}

/**
 * Usage metrics for a Copilot IDE code completions editor.
 *
 * @remarks
 * - name: Editor name.
 * - total_engaged_users: Number of users for the editor.
 * - models: Metrics for each model used in the editor.
 */
export class CopilotIdeCodeCompletionsEditor {
  /** Editor name. */
  name: string;
  /** Number of users for the editor. */
  total_engaged_users: number;
  /** Metrics for each model used in the editor. */
  models: CopilotIdeCodeCompletionsEditorModel[];

  constructor(data: any) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map((model: any) => new CopilotIdeCodeCompletionsEditorModel(model))
      : [];
  }
}

/**
 * Usage metrics for a model used in IDE code completions.
 *
 * @remarks
 * - name: Model name. Will be 'default' if the default model is used.
 * - is_custom_model: Indicates if the model is custom.
 * - custom_model_training_date: Training date if custom.
 * - total_engaged_users: Number of users for the model.
 * - languages: Metrics for each language in the given model.
 */
export class CopilotIdeCodeCompletionsEditorModel {
  /** Model name. Will be 'default' if the default model is used. */
  name: string;
  /** Indicates if the model is custom. */
  is_custom_model: boolean;
  /** Training date if custom. */
  custom_model_training_date?: string | null;
  /** Number of users for the model. */
  total_engaged_users: number;
  /** Metrics for each language in the given model. */
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

/**
 * Usage metrics for a language within an IDE code completions editor model.
 *
 * @remarks
 * - name: Language name.
 * - total_engaged_users: Number of users for the language.
 * - total_code_suggestions: Number of code suggestions.
 * - total_code_acceptances: Number of accepted suggestions.
 * - total_code_lines_suggested: Lines suggested.
 * - total_code_lines_accepted: Lines accepted.
 */
export class CopilotIdeCodeCompletionsEditorModelLanguage {
  /** Language name. */
  name: string;
  /** Number of users for the language. */
  total_engaged_users: number;
  /** Number of code suggestions. */
  total_code_suggestions: number;
  /** Number of accepted suggestions. */
  total_code_acceptances: number;
  /** Lines suggested. */
  total_code_lines_suggested: number;
  /** Lines accepted. */
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

/**
 * Usage metrics for Copilot IDE chat.
 *
 * @remarks
 * - total_engaged_users: Total users prompting chat.
 * - editors: List of editors with detailed chat and model metrics.
 */
export class CopilotIdeChat {
  /** Total users prompting chat. */
  total_engaged_users: number;
  /** List of editors with detailed chat and model metrics. */
  editors: CopilotIdeChatEditor[];

  constructor(data: any) {
    this.total_engaged_users = data.total_engaged_users;
    this.editors = data.editors
      ? data.editors.map((editor: any) => new CopilotIdeChatEditor(editor))
      : [];
  }
}

/**
 * Usage metrics for a Copilot IDE chat editor.
 *
 * @remarks
 * - name: Editor name.
 * - total_engaged_users: Users prompting chat in the editor.
 * - models: Metrics for each model in the editor.
 */
export class CopilotIdeChatEditor {
  /** Editor name. */
  name: string;
  /** Users prompting chat in the editor. */
  total_engaged_users: number;
  /** Metrics for each model in the editor. */
  models: CopilotIdeChatEditorModel[];

  constructor(data: any) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map((model: any) => new CopilotIdeChatEditorModel(model))
      : [];
  }
}

/**
 * Usage metrics for a model used in Copilot IDE chat.
 *
 * @remarks
 * - name: Model name. Will be 'default' if the default model is used.
 * - is_custom_model: Indicates if the model is custom.
 * - custom_model_training_date: Training date if custom.
 * - total_engaged_users: Number of users using this chat model.
 * - total_chats: Number of chat turns.
 * - total_chat_insertion_events: Number of times code suggestions were inserted.
 * - total_chat_copy_events: Number of times the suggestions were copied.
 */
export class CopilotIdeChatEditorModel {
  /** Model name. Will be 'default' if the default model is used. */
  name: string;
  /** Indicates if the model is custom. */
  is_custom_model: boolean;
  /** Training date if custom. */
  custom_model_training_date?: string | null;
  /** Number of users using this chat model. */
  total_engaged_users: number;
  /** Number of chat turns. */
  total_chats: number;
  /** Number of times code suggestions were inserted. */
  total_chat_insertion_events: number;
  /** Number of times the suggestions were copied. */
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

/**
 * Usage metrics for Copilot Chat on GitHub.com.
 *
 * @remarks
 * - total_engaged_users: Total users prompting chat on GitHub.com.
 * - models: Metrics for each model used on GitHub.com.
 */
export class CopilotDotcomChat {
  /** Total users prompting chat on GitHub.com. */
  total_engaged_users: number;
  /** Metrics for each model used on GitHub.com. */
  models: CopilotDotcomChatModel[];

  constructor(data: any) {
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map((model: any) => new CopilotDotcomChatModel(model))
      : [];
  }
}

/**
 * Usage metrics for a model in Copilot Chat on GitHub.com.
 *
 * @remarks
 * - name: Model name. Will be 'default' if the default model is used.
 * - is_custom_model: Indicates if the model is custom.
 * - custom_model_training_date: Training date if custom.
 * - total_engaged_users: Number of users for the model.
 * - total_chats: Total number of chats initiated.
 */
export class CopilotDotcomChatModel {
  /** Model name. Will be 'default' if the default model is used. */
  name: string;
  /** Indicates if the model is custom. */
  is_custom_model: boolean;
  /** Training date if custom. */
  custom_model_training_date?: string | null;
  /** Number of users for the model. */
  total_engaged_users: number;
  /** Total number of chats initiated. */
  total_chats: number;

  constructor(data: any) {
    this.name = data.name;
    this.is_custom_model = data.is_custom_model;
    this.custom_model_training_date = data.custom_model_training_date || null;
    this.total_engaged_users = data.total_engaged_users;
    this.total_chats = data.total_chats;
  }
}

/**
 * Usage metrics for Copilot for Pull Requests on GitHub.com.
 *
 * @remarks
 * - total_engaged_users: Total number of users using the PR feature.
 * - repositories: List of repositories with detailed PR metrics.
 */
export class CopilotDotcomPullRequests {
  /** Total number of users using the PR feature. */
  total_engaged_users: number;
  /** List of repositories with detailed PR metrics. */
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

/**
 * Usage metrics for a repository in Copilot for Pull Requests.
 *
 * @remarks
 * - name: Repository name.
 * - total_engaged_users: Number of users for the repository.
 * - models: Metrics for each model used in the repository.
 */
export class CopilotDotcomPullRequestsRepository {
  /** Repository name. */
  name: string;
  /** Number of users for the repository. */
  total_engaged_users: number;
  /** Metrics for each model used in the repository. */
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

/**
 * Usage metrics for a model used in Copilot for Pull Requests.
 *
 * @remarks
 * - name: Model name. Will be 'default' if the default model is used.
 * - is_custom_model: Indicates if the model is custom.
 * - custom_model_training_date: Training date if custom.
 * - total_pr_summaries_created: Number of PR summaries created.
 * - total_engaged_users: Number of users for the model.
 */
export class CopilotDotcomPullRequestsRepositoryModel {
  /** Model name. Will be 'default' if the default model is used. */
  name: string;
  /** Indicates if the model is custom. */
  is_custom_model: boolean;
  /** Training date if custom. */
  custom_model_training_date?: string | null;
  /** Number of PR summaries created. */
  total_pr_summaries_created: number;
  /** Number of users for the model. */
  total_engaged_users: number;

  constructor(data: any) {
    this.name = data.name;
    this.is_custom_model = data.is_custom_model;
    this.custom_model_training_date = data.custom_model_training_date || null;
    this.total_pr_summaries_created = data.total_pr_summaries_created;
    this.total_engaged_users = data.total_engaged_users;
  }
}