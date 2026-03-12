import type { CopilotMetrics } from "@/model/Copilot_Metrics";
import type { Metrics } from "@/model/Metrics";
import type { ReportDayTotals } from "../../server/services/github-copilot-usage-api";

interface MetricsApiResponse {
    metrics: Metrics[]; // Replace `any` with the actual type of metrics
    usage: CopilotMetrics[];   // Replace `any` with the actual type of usage
    reportData?: ReportDayTotals[];  // Raw report data from new API (for agent/PR dashboards)
}