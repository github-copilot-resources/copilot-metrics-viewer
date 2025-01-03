export class Breakdown {
  name: string;
  acceptedPrompts: number;
  suggestedPrompts: number;
  suggestedLinesOfCode: number;
  acceptedLinesOfCode: number;
  acceptanceRateByCount: number;
  acceptanceRateByLines: number;

  constructor(data: any) {
    this.name = data.name;
    this.acceptedPrompts = data.acceptedPrompts;
    this.suggestedPrompts = data.suggestedPrompts;
    this.suggestedLinesOfCode = data.suggestedLinesOfCode;
    this.acceptedLinesOfCode = data.acceptedLinesOfCode;
    this.acceptanceRateByCount = data.acceptanceRateByCount;
    this.acceptanceRateByLines = data.acceptanceRateByLines;
  }
}
