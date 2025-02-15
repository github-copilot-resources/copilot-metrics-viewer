import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import type { Metrics } from "@/model/Metrics";

interface MetricsApiResponse {
    /**
     * Metrics is the old - 2024 "usage" format
     */
    usage: Metrics[]; // Replace `any` with the actual type of metrics
    /**
     * Metrics in new - 2025 "metrics" format
     */
    metrics: CopilotMetrics[];   // Replace `any` with the actual type of usage
}