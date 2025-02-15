import { describe, test, expect } from 'vitest';
import { convertToUsageMetrics } from '@/model/MetricsToUsageConverter';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { ModelActivityData } from '@/model/ModelActivityData';

describe('Metrics modelActivity', () => {
    test('should handle model activity correctly', () => {
        const copilotMetrics: CopilotMetrics[] = [
            {
                date: '2023-04-01',
                total_active_users: 30,
                total_engaged_users: 25,
                copilot_ide_code_completions: {
                    total_engaged_users: 15,
                    editors: [
                        {
                            name: 'VSCode',
                            total_engaged_users: 15,
                            models: [
                                {
                                    name: 'GPT-4',
                                    is_custom_model: true,
                                    total_engaged_users: 10,
                                    languages: [
                                        {
                                            name: 'JavaScript',
                                            total_code_suggestions: 200,
                                            total_code_acceptances: 100,
                                            total_code_lines_suggested: 400,
                                            total_code_lines_accepted: 200,
                                            total_engaged_users: 10
                                        }
                                    ]
                                },
                                {
                                    name: 'default',
                                    is_custom_model: false,
                                    total_engaged_users: 5,
                                    languages: [
                                        {
                                            name: 'TypeScript',
                                            total_code_suggestions: 100,
                                            total_code_acceptances: 50,
                                            total_code_lines_suggested: 200,
                                            total_code_lines_accepted: 100,
                                            total_engaged_users: 5
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                copilot_ide_chat: {
                    total_engaged_users: 10,
                    editors: [
                        {
                            name: 'VSCode',
                            total_engaged_users: 10,
                            models: [
                                {
                                    name: 'GPT-4',
                                    is_custom_model: true,
                                    total_engaged_users: 10,
                                    total_chats: 40,
                                    total_chat_insertion_events: 30,
                                    total_chat_copy_events: 20
                                }
                            ]
                        }
                    ]
                }
            }
        ];

        const expectedModelActivity: ModelActivityData[] = [
            {
                editor: 'VSCode',
                name: 'GPT-4',
                total_engaged_users: 10,
                is_custom_model: true,
                custom_model_training_date: null,
                total_actions: 100, // total_code_acceptances
                source: 'code'
            },
            {
                editor: 'VSCode',
                name: 'default',
                total_engaged_users: 5,
                is_custom_model: false,
                custom_model_training_date: null,
                total_actions: 50, // total_code_acceptances
                source: 'code'
            },
            {
                editor: 'VSCode',
                name: 'GPT-4',
                total_engaged_users: 10,
                is_custom_model: true,
                custom_model_training_date: null,
                total_actions: 50, // total_chat_insertion_events + total_chat_copy_events
                source: 'chat'
            }
        ];

        const result = convertToUsageMetrics(copilotMetrics);
        expect(result[0]?.model_activity).toEqual(expectedModelActivity);
    });
});
