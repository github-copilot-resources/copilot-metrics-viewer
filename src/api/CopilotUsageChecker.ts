// 首先，导入Metrics类
import { Metrics } from '../model/Metrics';

export class CopilotUsageChecker {
    private data: Metrics[];
    private missingDates: string[];
    private emptyBreakdowns: string[];
    private zeroActivityDays: string[];

    constructor(jsonText: string) {
        // Map to Metrics instances
        this.data = JSON.parse(jsonText).map((item: any) => new Metrics(item));
        this.missingDates = [];
        this.emptyBreakdowns = [];
        this.zeroActivityDays = [];
    }

    private parseISO(isoString: string): Date {
        return new Date(isoString);
    }

    private addDays(date: Date, days: number): Date {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    private differenceInCalendarDays(date1: Date, date2: Date): number {
        const diffTime = Math.abs(date2.getTime() - date1.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    private checkDatesContinuity(): void {
        const dates = this.data.map(item => this.parseISO(item.day)).sort((a, b) => a.getTime() - b.getTime());
        for (let i = 1; i < dates.length; i++) {
            const diff = this.differenceInCalendarDays(dates[i], dates[i - 1]);
            if (diff > 1) {
                let missingDate = this.addDays(dates[i - 1], 1);
                while (this.differenceInCalendarDays(dates[i], missingDate) > 0) {
                    this.missingDates.push(this.formatDate(missingDate));
                    missingDate = this.addDays(missingDate, 1);
                }
            }
        }
    }

    private checkEmptyBreakdowns(): void {
        this.data.forEach(item => { 
            if (!item.breakdown || item.breakdown.length === 0) {
                this.emptyBreakdowns.push(item.day);
            }
        });
    }

    private checkZeroActivityDays(): void {
        this.data.forEach(item => {
            //&& item.total_chat_turns === 0 && item.total_lines_suggested === 0, and just ignore the total_chat_turns now. will add it later.
            if (item.total_lines_suggested === 0 ) {
                this.zeroActivityDays.push(item.day);
            }
        });
    }

    public runChecks(): { missingDates: string[], emptyBreakdowns: string[], zeroActivityDays: string[], hasDataIssues: boolean } {
        this.checkDatesContinuity();
        this.checkEmptyBreakdowns();
        this.checkZeroActivityDays();
        const hasDataIssues = this.missingDates.length > 0 || this.emptyBreakdowns.length > 0 || this.zeroActivityDays.length > 0;
        return { missingDates: this.missingDates, emptyBreakdowns: this.emptyBreakdowns, zeroActivityDays: this.zeroActivityDays, hasDataIssues };
    }
}

// Usage example:
// const jsonText = '...'; // JSON text from enterprise_response_sample.json
// const checker = new CopilotUsageChecker(jsonText);
// const { missingDates, emptyBreakdowns, zeroActivityDays,hasDataIssues } = checker.runChecks();
// console.log("Missing dates:", missingDates);
// console.log("Days with empty breakdowns:", emptyBreakdowns);
// console.log("Days with zero activity:", zeroActivityDays);