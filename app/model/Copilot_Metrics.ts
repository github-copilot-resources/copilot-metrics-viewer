
/**
 * TypeScript interfaces for type safety based on GitHub Copilot Usage Metrics API schema
 */

/**
 * Data structure for language-specific code completion metrics within an editor model
 */
interface CopilotIdeCodeCompletionsEditorModelLanguageData {
  /** Name of the language used for Copilot code completion suggestions, for the given editor */
  name: string;
  /** Number of users who accepted at least one Copilot code completion suggestion for the given editor, for the given language. Includes both full and partial acceptances */
  total_engaged_users: number;
  /** The number of Copilot code suggestions generated for the given editor, for the given language */
  total_code_suggestions: number;
  /** The number of Copilot code suggestions accepted for the given editor, for the given language. Includes both full and partial acceptances */
  total_code_acceptances: number;
  /** The number of lines of code suggested by Copilot code completions for the given editor, for the given language */
  total_code_lines_suggested: number;
  /** The number of lines of code accepted from Copilot code suggestions for the given editor, for the given language */
  total_code_lines_accepted: number;
}

/**
 * Data structure for editor model used in code completions
 */
interface CopilotIdeCodeCompletionsEditorModelData {
  /** Name of the model used for Copilot code completion suggestions. If the default model is used will appear as 'default' */
  name: string;
  /** Indicates whether a model is custom or default */
  is_custom_model: boolean;
  /** The training date for the custom model */
  custom_model_training_date?: string | null;
  /** Number of users who accepted at least one Copilot code completion suggestion for the given editor, for the given language and model. Includes both full and partial acceptances */
  total_engaged_users: number;
  /** Code completion metrics for active languages, for the given editor */
  languages?: CopilotIdeCodeCompletionsEditorModelLanguageData[];
}

/**
 * Data structure for editor used in code completions
 */
interface CopilotIdeCodeCompletionsEditorData {
  /** Name of the given editor */
  name: string;
  /** Number of users who accepted at least one Copilot code completion suggestion for the given editor. Includes both full and partial acceptances */
  total_engaged_users: number;
  /** List of model metrics for custom models and the default model */
  models?: CopilotIdeCodeCompletionsEditorModelData[];
}

/**
 * Data structure for language used in code completions
 */
interface CopilotIdeCodeCompletionsLanguageData {
  /** Name of the language used for Copilot code completion suggestions */
  name: string;
  /** Number of users who accepted at least one Copilot code completion suggestion for the given language. Includes both full and partial acceptances */
  total_engaged_users: number;
}

/**
 * Data structure for Copilot IDE code completions metrics
 */
interface CopilotIdeCodeCompletionsData {
  /** Number of users who accepted at least one Copilot code suggestion, across all active editors. Includes both full and partial acceptances */
  total_engaged_users: number;
  /** Code completion metrics for active languages */
  languages?: CopilotIdeCodeCompletionsLanguageData[];
  /** Copilot code completion metrics for active editors */
  editors?: CopilotIdeCodeCompletionsEditorData[];
}

/**
 * Data structure for IDE chat editor model
 */
interface CopilotIdeChatEditorModelData {
  /** Name of the model used for Copilot Chat. If the default model is used will appear as 'default' */
  name: string;
  /** Indicates whether a model is custom or default */
  is_custom_model: boolean;
  /** The training date for the custom model */
  custom_model_training_date?: string | null;
  /** The number of users who prompted Copilot Chat in the given editor and model */
  total_engaged_users: number;
  /** The total number of chats initiated by users in the given editor and model */
  total_chats: number;
  /** The number of times users accepted a code suggestion from Copilot Chat using the 'Insert Code' UI element, for the given editor */
  total_chat_insertion_events: number;
  /** The number of times users copied a code suggestion from Copilot Chat using the keyboard, or the 'Copy' UI element, for the given editor */
  total_chat_copy_events: number;
}

/**
 * Data structure for IDE chat editor
 */
interface CopilotIdeChatEditorData {
  /** Name of the given editor */
  name: string;
  /** The number of users who prompted Copilot Chat in the specified editor */
  total_engaged_users: number;
  /** List of model metrics for custom models and the default model */
  models?: CopilotIdeChatEditorModelData[];
}

/**
 * Data structure for Copilot IDE chat metrics
 */
interface CopilotIdeChatData {
  /** Total number of users who prompted Copilot Chat in the IDE */
  total_engaged_users: number;
  /** Copilot Chat metrics, for active editors */
  editors?: CopilotIdeChatEditorData[];
}

/**
 * Data structure for Copilot dotcom chat model
 */
interface CopilotDotcomChatModelData {
  /** Name of the model used for Copilot Chat. If the default model is used will appear as 'default' */
  name: string;
  /** Indicates whether a model is custom or default */
  is_custom_model: boolean;
  /** The training date for the custom model (if applicable) */
  custom_model_training_date?: string | null;
  /** Total number of users who prompted Copilot Chat on github.com at least once for each model */
  total_engaged_users: number;
  /** Total number of chats initiated by users on github.com */
  total_chats: number;
}

/**
 * Data structure for Copilot dotcom chat metrics
 */
interface CopilotDotcomChatData {
  /** Total number of users who prompted Copilot Chat on github.com at least once */
  total_engaged_users: number;
  /** List of model metrics for a custom models and the default model */
  models?: CopilotDotcomChatModelData[];
}

/**
 * Data structure for Copilot dotcom pull requests repository model
 */
interface CopilotDotcomPullRequestsRepositoryModelData {
  /** Name of the model used for Copilot pull request summaries. If the default model is used will appear as 'default' */
  name: string;
  /** Indicates whether a model is custom or default */
  is_custom_model: boolean;
  /** The training date for the custom model */
  custom_model_training_date?: string | null;
  /** The number of pull request summaries generated using Copilot for Pull Requests in the given repository */
  total_pr_summaries_created: number;
  /** The number of users who generated pull request summaries using Copilot for Pull Requests in the given repository and model */
  total_engaged_users: number;
}

/**
 * Data structure for Copilot dotcom pull requests repository
 */
interface CopilotDotcomPullRequestsRepositoryData {
  /** Repository name */
  name: string;
  /** The number of users who generated pull request summaries using Copilot for Pull Requests in the given repository */
  total_engaged_users: number;
  /** List of model metrics for custom models and the default model */
  models?: CopilotDotcomPullRequestsRepositoryModelData[];
}

/**
 * Data structure for Copilot dotcom pull requests metrics
 */
interface CopilotDotcomPullRequestsData {
  /** The number of users who used Copilot for Pull Requests on github.com to generate a pull request summary at least once */
  total_engaged_users: number;
  /** Repositories in which users used Copilot for Pull Requests to generate pull request summaries */
  repositories?: CopilotDotcomPullRequestsRepositoryData[];
}

/**
 * Data structure for Copilot metrics for a given day
 */
interface CopilotMetricsData {
  /** The date for which the usage metrics are aggregated, in `YYYY-MM-DD` format */
  date: string;
  /** The total number of Copilot users with activity belonging to any Copilot feature, globally, for the given day. Includes passive activity such as receiving a code suggestion, as well as engagement activity such as accepting a code suggestion or prompting chat. Does not include authentication events. Is not limited to the individual features detailed on the endpoint */
  total_active_users: number;
  /** The total number of Copilot users who engaged with any Copilot feature, for the given day. Examples include but are not limited to accepting a code suggestion, prompting Copilot chat, or triggering a PR Summary. Does not include authentication events. Is not limited to the individual features detailed on the endpoint */
  total_engaged_users: number;
  /** Usage metrics for Copilot editor code completions in the IDE */
  copilot_ide_code_completions?: CopilotIdeCodeCompletionsData | null;
  /** Usage metrics for Copilot Chat in the IDE */
  copilot_ide_chat?: CopilotIdeChatData | null;
  /** Usage metrics for Copilot Chat in GitHub.com */
  copilot_dotcom_chat?: CopilotDotcomChatData | null;
  /** Usage metrics for Copilot for pull requests */
  copilot_dotcom_pull_requests?: CopilotDotcomPullRequestsData | null;
}

/**
 * Usage metrics for a given language for the given editor for Copilot code completions
 */
export class CopilotIdeCodeCompletionsEditorModelLanguage {
  /** Name of the language used for Copilot code completion suggestions, for the given editor */
  name: string;
  /** Number of users who accepted at least one Copilot code completion suggestion for the given editor, for the given language. Includes both full and partial acceptances */
  total_engaged_users: number;
  /** The number of Copilot code suggestions generated for the given editor, for the given language */
  total_code_suggestions: number;
  /** The number of Copilot code suggestions accepted for the given editor, for the given language. Includes both full and partial acceptances */
  total_code_acceptances: number;
  /** The number of lines of code suggested by Copilot code completions for the given editor, for the given language */
  total_code_lines_suggested: number;
  /** The number of lines of code accepted from Copilot code suggestions for the given editor, for the given language */
  total_code_lines_accepted: number;

  /**
   * Creates an instance of CopilotIdeCodeCompletionsEditorModelLanguage
   * @param data - The raw data from the API
   */
  constructor(data: CopilotIdeCodeCompletionsEditorModelLanguageData) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
    this.total_code_suggestions = data.total_code_suggestions;
    this.total_code_acceptances = data.total_code_acceptances;
    this.total_code_lines_suggested = data.total_code_lines_suggested;
    this.total_code_lines_accepted = data.total_code_lines_accepted;
  }
}
/**
 * Model metrics for custom models and the default model used in code completions
 */
export class CopilotIdeCodeCompletionsEditorModel {
  /** Name of the model used for Copilot code completion suggestions. If the default model is used will appear as 'default' */
  name: string;
  /** Indicates whether a model is custom or default */
  is_custom_model: boolean;
  /** The training date for the custom model */
  custom_model_training_date?: string | null;
  /** Number of users who accepted at least one Copilot code completion suggestion for the given editor, for the given language and model. Includes both full and partial acceptances */
  total_engaged_users: number;
  /** Code completion metrics for active languages, for the given editor */
  languages: CopilotIdeCodeCompletionsEditorModelLanguage[];

  /**
   * Creates an instance of CopilotIdeCodeCompletionsEditorModel
   * @param data - The raw data from the API
   */
  constructor(data: CopilotIdeCodeCompletionsEditorModelData) {
    this.name = data.name;
    this.is_custom_model = data.is_custom_model;
    this.custom_model_training_date = data.custom_model_training_date || null;
    this.total_engaged_users = data.total_engaged_users;
    this.languages = data.languages
      ? data.languages.map(
          (lang: CopilotIdeCodeCompletionsEditorModelLanguageData) => new CopilotIdeCodeCompletionsEditorModelLanguage(lang)
        )
      : [];
  }
}
/**
 * Copilot code completion metrics for active editors
 */
export class CopilotIdeCodeCompletionsEditor {
  /** Name of the given editor */
  name: string;
  /** Number of users who accepted at least one Copilot code completion suggestion for the given editor. Includes both full and partial acceptances */
  total_engaged_users: number;
  /** List of model metrics for custom models and the default model */
  models: CopilotIdeCodeCompletionsEditorModel[];

  /**
   * Creates an instance of CopilotIdeCodeCompletionsEditor
   * @param data - The raw data from the API
   */
  constructor(data: CopilotIdeCodeCompletionsEditorData) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map((model: CopilotIdeCodeCompletionsEditorModelData) => new CopilotIdeCodeCompletionsEditorModel(model))
      : [];
  }
}

/**
 * Code completion metrics for active languages
 */
export class CopilotIdeCodeCompletionsLanguage {
  /** Name of the language used for Copilot code completion suggestions */
  name: string;
  /** Number of users who accepted at least one Copilot code completion suggestion for the given language. Includes both full and partial acceptances */
  total_engaged_users: number;

  /**
   * Creates an instance of CopilotIdeCodeCompletionsLanguage
   * @param data - The raw data from the API
   */
  constructor(data: CopilotIdeCodeCompletionsLanguageData) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
  }
}
/**
 * Usage metrics for Copilot editor code completions in the IDE
 */
export class CopilotIdeCodeCompletions {
  /** Number of users who accepted at least one Copilot code suggestion, across all active editors. Includes both full and partial acceptances */
  total_engaged_users: number;
  /** Code completion metrics for active languages */
  languages: CopilotIdeCodeCompletionsLanguage[];
  /** Copilot code completion metrics for active editors */
  editors: CopilotIdeCodeCompletionsEditor[];

  /**
   * Creates an instance of CopilotIdeCodeCompletions
   * @param data - The raw data from the API
   */
  constructor(data: CopilotIdeCodeCompletionsData) {
    this.total_engaged_users = data.total_engaged_users;
    this.languages = data.languages
      ? data.languages.map((lang: CopilotIdeCodeCompletionsLanguageData) => new CopilotIdeCodeCompletionsLanguage(lang))
      : [];
    this.editors = data.editors
      ? data.editors.map((editor: CopilotIdeCodeCompletionsEditorData) => new CopilotIdeCodeCompletionsEditor(editor))
      : [];
  }


}

/**
 * Model metrics for custom models and the default model used in IDE chat
 */
export class CopilotIdeChatEditorModel {
  /** Name of the model used for Copilot Chat. If the default model is used will appear as 'default' */
  name: string;
  /** Indicates whether a model is custom or default */
  is_custom_model: boolean;
  /** The training date for the custom model */
  custom_model_training_date?: string | null;
  /** The number of users who prompted Copilot Chat in the given editor and model */
  total_engaged_users: number;
  /** The total number of chats initiated by users in the given editor and model */
  total_chats: number;
  /** The number of times users accepted a code suggestion from Copilot Chat using the 'Insert Code' UI element, for the given editor */
  total_chat_insertion_events: number;
  /** The number of times users copied a code suggestion from Copilot Chat using the keyboard, or the 'Copy' UI element, for the given editor */
  total_chat_copy_events: number;

  /**
   * Creates an instance of CopilotIdeChatEditorModel
   * @param data - The raw data from the API
   */
  constructor(data: CopilotIdeChatEditorModelData) {
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
 * Copilot Chat metrics for active editors
 */
export class CopilotIdeChatEditor {
  /** Name of the given editor */
  name: string;
  /** The number of users who prompted Copilot Chat in the specified editor */
  total_engaged_users: number;
  /** List of model metrics for custom models and the default model */
  models: CopilotIdeChatEditorModel[];

  /**
   * Creates an instance of CopilotIdeChatEditor
   * @param data - The raw data from the API
   */
  constructor(data: CopilotIdeChatEditorData) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map((model: CopilotIdeChatEditorModelData) => new CopilotIdeChatEditorModel(model))
      : [];
  }
}

/**
 * Usage metrics for Copilot Chat in the IDE
 */
export class CopilotIdeChat {
  /** Total number of users who prompted Copilot Chat in the IDE */
  total_engaged_users: number;
  /** Copilot Chat metrics, for active editors */
  editors: CopilotIdeChatEditor[];

  /**
   * Creates an instance of CopilotIdeChat
   * @param data - The raw data from the API
   */
  constructor(data: CopilotIdeChatData) {
    this.total_engaged_users = data.total_engaged_users;
    this.editors = data.editors
      ? data.editors.map((editor: CopilotIdeChatEditorData) => new CopilotIdeChatEditor(editor))
      : [];
  }
}

/**
 * Model metrics for custom models and the default model used in GitHub.com chat
 */
export class CopilotDotcomChatModel {
  /** Name of the model used for Copilot Chat. If the default model is used will appear as 'default' */
  name: string;
  /** Indicates whether a model is custom or default */
  is_custom_model: boolean;
  /** The training date for the custom model (if applicable) */
  custom_model_training_date?: string | null;
  /** Total number of users who prompted Copilot Chat on github.com at least once for each model */
  total_engaged_users: number;
  /** Total number of chats initiated by users on github.com */
  total_chats: number;

  /**
   * Creates an instance of CopilotDotcomChatModel
   * @param data - The raw data from the API
   */
  constructor(data: CopilotDotcomChatModelData) {
    this.name = data.name;
    this.is_custom_model = data.is_custom_model;
    this.custom_model_training_date = data.custom_model_training_date || null;
    this.total_engaged_users = data.total_engaged_users;
    this.total_chats = data.total_chats;
  }
}

/**
 * Model metrics for custom models and the default model used in pull request summaries
 */
export class CopilotDotcomPullRequestsRepositoryModel {
  /** Name of the model used for Copilot pull request summaries. If the default model is used will appear as 'default' */
  name: string;
  /** Indicates whether a model is custom or default */
  is_custom_model: boolean;
  /** The training date for the custom model */
  custom_model_training_date?: string | null;
  /** The number of pull request summaries generated using Copilot for Pull Requests in the given repository */
  total_pr_summaries_created: number;
  /** The number of users who generated pull request summaries using Copilot for Pull Requests in the given repository and model */
  total_engaged_users: number;

  /**
   * Creates an instance of CopilotDotcomPullRequestsRepositoryModel
   * @param data - The raw data from the API
   */
  constructor(data: CopilotDotcomPullRequestsRepositoryModelData) {
    this.name = data.name;
    this.is_custom_model = data.is_custom_model;
    this.custom_model_training_date = data.custom_model_training_date || null;
    this.total_pr_summaries_created = data.total_pr_summaries_created;
    this.total_engaged_users = data.total_engaged_users;
  }
}

/**
 * Repository metrics for Copilot pull request summaries
 */
export class CopilotDotcomPullRequestsRepository {
  /** Repository name */
  name: string;
  /** The number of users who generated pull request summaries using Copilot for Pull Requests in the given repository */
  total_engaged_users: number;
  /** List of model metrics for custom models and the default model */
  models: CopilotDotcomPullRequestsRepositoryModel[];

  /**
   * Creates an instance of CopilotDotcomPullRequestsRepository
   * @param data - The raw data from the API
   */
  constructor(data: CopilotDotcomPullRequestsRepositoryData) {
    this.name = data.name;
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map(
          (model: CopilotDotcomPullRequestsRepositoryModelData) => new CopilotDotcomPullRequestsRepositoryModel(model)
        )
      : [];
  }
}

export class CopilotDotcomPullRequests {
  total_engaged_users: number;
  repositories: CopilotDotcomPullRequestsRepository[];

  constructor(data: CopilotDotcomPullRequestsData) {
    this.total_engaged_users = data.total_engaged_users;
    this.repositories = data.repositories
      ? data.repositories.map(
          (repo: CopilotDotcomPullRequestsRepositoryData) => new CopilotDotcomPullRequestsRepository(repo)
        )
      : [];
  }
}

export class CopilotDotcomChat {
  total_engaged_users: number;
  models: CopilotDotcomChatModel[];

  constructor(data: CopilotDotcomChatData) {
    this.total_engaged_users = data.total_engaged_users;
    this.models = data.models
      ? data.models.map((model: CopilotDotcomChatModelData) => new CopilotDotcomChatModel(model))
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

  constructor(data: CopilotMetricsData) {
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