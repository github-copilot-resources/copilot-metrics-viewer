import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import type { Metrics } from "@/model/Metrics";

interface MetricsApiResponse {
    metrics: Metrics[]; // Replace `any` with the actual type of metrics
    usage: CopilotMetrics[];   // Replace `any` with the actual type of usage
    valid_until: number; // Timestamp indicating when the data is valid until
}