export class Breakdown {
  name: string;
  acceptedPrompts: number;
  suggestedPrompts: number;
  suggestedLinesOfCode: number;
  acceptedLinesOfCode: number;
  acceptanceRate: number; // Percentage
  acceptanceRateByCount: number; // Percentage

  constructor(data: any) {
    this.name = data.name;
    this.acceptedPrompts = data.acceptedPrompts;
    this.suggestedPrompts = data.suggestedPrompts;
    this.suggestedLinesOfCode = data.suggestedLinesOfCode;
    this.acceptedLinesOfCode = data.acceptedLinesOfCode;
    this.acceptanceRate = data.acceptanceRate; // Convert to percentage
    this.acceptanceRateByCount = data.acceptanceRateByCount; // Convert to percentage
  }
}