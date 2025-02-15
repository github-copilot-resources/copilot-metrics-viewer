import { describe, test, expect } from 'vitest';
import { convertToUsageMetrics } from '@/model/MetricsToUsageConverter';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import { Metrics, BreakdownData } from '@/model/Metrics';

function omitModelActivity(metrics: Metrics[]): Metrics[] {
    return metrics.map(metric => {
        const { model_activity, ...rest } = metric;
        return rest;
    });
}

describe('convertToUsageMetrics', () => {
    test('should convert CopilotMetrics to Metrics correctly', () => {
        const copilotMetrics: CopilotMetrics[] = [
            {
                date: '2023-01-01',
                total_active_users: 10,
                total_engaged_users: 8,
                copilot_ide_code_completions: {
                    total_engaged_users: 5,
                    editors: [
                        {
                            name: 'VSCode',
                            total_engaged_users: 5,
                            models: [
                                {
                                    name: 'GPT-3',
                                    is_custom_model: true,
                                    total_engaged_users: 5,
                                    languages: [
                                        {
                                            name: 'JavaScript',
                                            total_code_suggestions: 100,
                                            total_code_acceptances: 50,
                                            total_code_lines_suggested: 200,
                                            total_code_lines_accepted: 100,
                                            total_engaged_users: 5
                                        },
                                        {
                                            name: 'Python',
                                            total_code_suggestions: 34,
                                            total_code_acceptances: 15,
                                            total_code_lines_suggested: 567,
                                            total_code_lines_accepted: 401,
                                            total_engaged_users: 4
                                        }
                                    ]
                                },
                                {
                                    name: 'default',
                                    is_custom_model: false,
                                    total_engaged_users: 5,
                                    languages: [
                                        {
                                            name: 'Python',
                                            total_code_suggestions: 50,
                                            total_code_acceptances: 25,
                                            total_code_lines_suggested: 100,
                                            total_code_lines_accepted: 50,
                                            total_engaged_users: 5
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                copilot_ide_chat: {
                    total_engaged_users: 3,
                    editors: [
                        {
                            name: 'VSCode',
                            total_engaged_users: 3,
                            models: [
                                {
                                    name: 'GPT-3',
                                    is_custom_model: true,
                                    total_engaged_users: 3,
                                    total_chats: 30,
                                    total_chat_insertion_events: 20,
                                    total_chat_copy_events: 10
                                },
                                {
                                    name: 'default',
                                    is_custom_model: false,
                                    total_engaged_users: 3,
                                    total_chats: 15,
                                    total_chat_insertion_events: 10,
                                    total_chat_copy_events: 5
                                }
                            ]
                        }
                    ]
                }
            }
        ];

        const expectedMetrics: Metrics[] = [
            new Metrics({
                day: '2023-01-01',
                total_suggestions_count: 184, // 100 + 34 + 50
                total_acceptances_count: 90,  // 50 + 15 + 25
                total_lines_suggested: 867,   // 200 + 567 + 100
                total_lines_accepted: 551,    // 100 + 401 + 50
                total_active_users: 10,
                total_chat_acceptances: 45,   // (20+10) + (10+5)
                total_chat_turns: 45,         // 30 + 15
                total_active_chat_users: 3,
                breakdown: [
                    new BreakdownData({
                        language: 'JavaScript',
                        editor: 'VSCode',
                        model: 'GPT-3',
                        suggestions_count: 100,
                        acceptances_count: 50,
                        lines_suggested: 200,
                        lines_accepted: 100,
                        active_users: 5
                    }),
                    new BreakdownData({
                        language: 'Python',
                        editor: 'VSCode',
                        model: 'GPT-3',
                        suggestions_count: 34,
                        acceptances_count: 15,
                        lines_suggested: 567,
                        lines_accepted: 401,
                        active_users: 4
                    }),
                    new BreakdownData({
                        language: 'Python',
                        editor: 'VSCode',
                        model: 'default',
                        suggestions_count: 50,
                        acceptances_count: 25,
                        lines_suggested: 100,
                        lines_accepted: 50,
                        active_users: 5
                    })
                ]
            })
        ];

        const result = convertToUsageMetrics(copilotMetrics);
        expect(omitModelActivity(result)).toEqual(omitModelActivity(expectedMetrics));
    });

    test('should handle empty input', () => {
        const result = convertToUsageMetrics([]);
        expect(result).toEqual([]);
    });

    test('should handle missing optional fields', () => {
        const copilotMetrics: CopilotMetrics[] = [
            {
                date: '2023-01-01',
                total_active_users: 0,
                total_engaged_users: 0,
                copilot_ide_code_completions: null,
                copilot_ide_chat: null
            }
        ];

        const expectedMetrics: Metrics[] = [
            new Metrics({
                day: '2023-01-01',
                total_suggestions_count: 0,
                total_acceptances_count: 0,
                total_lines_suggested: 0,
                total_lines_accepted: 0,
                total_active_users: 0,
                total_chat_acceptances: 0,
                total_chat_turns: 0,
                total_active_chat_users: 0,
                breakdown: []
            })
        ];

        const result = convertToUsageMetrics(copilotMetrics);
        expect(omitModelActivity(result)).toEqual(omitModelActivity(expectedMetrics));
    });

    test('should aggregate multiple languages in a single model', () => {
        const copilotMetrics: CopilotMetrics[] = [
            {
                date: '2023-02-01',
                total_active_users: 20,
                total_engaged_users: 15,
                copilot_ide_code_completions: {
                    total_engaged_users: 8,
                    editors: [
                        {
                            name: 'VSCode',
                            total_engaged_users: 8,
                            models: [
                                {
                                    name: 'GPT-3',
                                    is_custom_model: true,
                                    total_engaged_users: 4,
                                    languages: [
                                        {
                                            name: 'JavaScript',
                                            total_code_suggestions: 150,
                                            total_code_acceptances: 70,
                                            total_code_lines_suggested: 300,
                                            total_code_lines_accepted: 140,
                                            total_engaged_users: 4
                                        },
                                        {
                                            name: 'TypeScript',
                                            total_code_suggestions: 50,
                                            total_code_acceptances: 25,
                                            total_code_lines_suggested: 100,
                                            total_code_lines_accepted: 50,
                                            total_engaged_users: 4
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                copilot_ide_chat: {
                    total_engaged_users: 5,
                    editors: [
                        {
                            name: 'VSCode',
                            total_engaged_users: 5,
                            models: [
                                {
                                    name: 'default',
                                    is_custom_model: false,
                                    total_engaged_users: 5,
                                    total_chats: 20,
                                    total_chat_insertion_events: 15,
                                    total_chat_copy_events: 5
                                }
                            ]
                        }
                    ]
                }
            }
        ];

        const expectedMetrics: Metrics[] = [
            new Metrics({
                day: '2023-02-01',
                total_suggestions_count: 200, // 150 + 50
                total_acceptances_count: 95,  // 70 + 25
                total_lines_suggested: 400,   // 300 + 100
                total_lines_accepted: 190,    // 140 + 50
                total_active_users: 20,
                total_chat_acceptances: 20,   // 15 + 5
                total_chat_turns: 20,         // 20
                total_active_chat_users: 5,
                breakdown: [
                    new BreakdownData({
                        language: 'JavaScript',
                        editor: 'VSCode',
                        model: 'GPT-3',
                        suggestions_count: 150,
                        acceptances_count: 70,
                        lines_suggested: 300,
                        lines_accepted: 140,
                        active_users: 4
                    }),
                    new BreakdownData({
                        language: 'TypeScript',
                        editor: 'VSCode',
                        model: 'GPT-3',
                        suggestions_count: 50,
                        acceptances_count: 25,
                        lines_suggested: 100,
                        lines_accepted: 50,
                        active_users: 4
                    })
                ]
            })
        ];

        const result = convertToUsageMetrics(copilotMetrics);
        expect(omitModelActivity(result)).toEqual(omitModelActivity(expectedMetrics));
    });

    test('should convert multiple CopilotMetrics objects', () => {
        const copilotMetrics: CopilotMetrics[] = [
            {
                date: '2023-03-01',
                total_active_users: 15,
                total_engaged_users: 12,
                copilot_ide_code_completions: {
                    total_engaged_users: 7,
                    editors: [
                        {
                            name: 'WebStorm',
                            total_engaged_users: 7,
                            models: [
                                {
                                    name: 'GPT-3',
                                    is_custom_model: true,
                                    total_engaged_users: 7,
                                    languages: [
                                        {
                                            name: 'JavaScript',
                                            total_code_suggestions: 80,
                                            total_code_acceptances: 40,
                                            total_code_lines_suggested: 160,
                                            total_code_lines_accepted: 80,
                                            total_engaged_users: 7
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                copilot_ide_chat: {
                    total_engaged_users: 4,
                    editors: [
                        {
                            name: 'WebStorm',
                            total_engaged_users: 4,
                            models: [
                                {
                                    name: 'GPT-3',
                                    is_custom_model: true,
                                    total_engaged_users: 4,
                                    total_chats: 15,
                                    total_chat_insertion_events: 10,
                                    total_chat_copy_events: 5
                                }
                            ]
                        }
                    ]
                }
            },
            {
                date: '2023-03-02',
                total_active_users: 25,
                total_engaged_users: 20,
                copilot_ide_code_completions: {
                    total_engaged_users: 10,
                    editors: [
                        {
                            name: 'VSCode',
                            total_engaged_users: 10,
                            models: [
                                {
                                    name: 'default',
                                    is_custom_model: false,
                                    total_engaged_users: 10,
                                    languages: [
                                        {
                                            name: 'Python',
                                            total_code_suggestions: 120,
                                            total_code_acceptances: 60,
                                            total_code_lines_suggested: 240,
                                            total_code_lines_accepted: 120,
                                            total_engaged_users: 10
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                copilot_ide_chat: {
                    total_engaged_users: 6,
                    editors: [
                        {
                            name: 'VSCode',
                            total_engaged_users: 6,
                            models: [
                                {
                                    name: 'default',
                                    is_custom_model: false,
                                    total_engaged_users: 6,
                                    total_chats: 18,
                                    total_chat_insertion_events: 12,
                                    total_chat_copy_events: 6
                                }
                            ]
                        }
                    ]
                }
            }
        ];

        const expectedMetrics: Metrics[] = [
            new Metrics({
                day: '2023-03-01',
                total_suggestions_count: 80,
                total_acceptances_count: 40,
                total_lines_suggested: 160,
                total_lines_accepted: 80,
                total_active_users: 15,
                total_chat_acceptances: 15, // 10 + 5
                total_chat_turns: 15,
                total_active_chat_users: 4,
                breakdown: [
                    new BreakdownData({
                        language: 'JavaScript',
                        editor: 'WebStorm',
                        model: 'GPT-3',
                        suggestions_count: 80,
                        acceptances_count: 40,
                        lines_suggested: 160,
                        lines_accepted: 80,
                        active_users: 7
                    })
                ]
            }),
            new Metrics({
                day: '2023-03-02',
                total_suggestions_count: 120,
                total_acceptances_count: 60,
                total_lines_suggested: 240,
                total_lines_accepted: 120,
                total_active_users: 25,
                total_chat_acceptances: 18, // 12 + 6
                total_chat_turns: 18,
                total_active_chat_users: 6,
                breakdown: [
                    new BreakdownData({
                        language: 'Python',
                        editor: 'VSCode',
                        model: 'default',
                        suggestions_count: 120,
                        acceptances_count: 60,
                        lines_suggested: 240,
                        lines_accepted: 120,
                        active_users: 10
                    })
                ]
            })
        ];

        const result = convertToUsageMetrics(copilotMetrics);
        expect(omitModelActivity(result)).toEqual(omitModelActivity(expectedMetrics));
    });
});