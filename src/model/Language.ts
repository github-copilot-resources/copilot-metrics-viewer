// Language model with name, accepted prompts, accepted lines of code and acceptance rate

export class Language {
  languageName: string;
  acceptedPrompts: number;
  suggestedLinesOfCode: number;
  acceptedLinesOfCode: number;
  acceptanceRate: number; // Percentage

  constructor(data: any) {
    this.languageName = data.name;
    this.acceptedPrompts = data.acceptedPrompts;
    this.suggestedLinesOfCode = data.suggestedLinesOfCode;
    this.acceptedLinesOfCode = data.acceptedLinesOfCode;
    this.acceptanceRate = data.acceptanceRate; // Convert to percentage
  }
}