/**
 * Represents activity data for a model with its associated editor.
 *
 * @remarks
 * This type is used when converting new metrics to the legacy /usage API format.
 * It aggregates details about a model's activity including:
 * - The name of the editor associated with the model.
 * - The model's name.
 * - The total number of engaged users for the model.
 * - Whether the model is custom.
 * - The training date of the custom model (if applicable).
 * - The total number of actions performed by the model.
 */
export interface ModelActivityData {
    /** The name of the editor associated with the model. */
    editor: string;
    /** The name of the model. */
    name: string;
    /** The total number of engaged users for the model. */
    total_engaged_users: number;
    /** Indicates if the model is custom. */
    is_custom_model: boolean;
    /** The training date of the custom model, or null if not applicable. */
    custom_model_training_date?: string | null;
    /** The total number of actions performed using the model. */
    total_actions: number;
    /** The source of the model activity, either 'code', 'chat' or 'pr. */
    source: 'code' | 'chat' | 'pr';
  }