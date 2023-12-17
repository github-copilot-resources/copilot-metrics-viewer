class Breakdown {
    language: string;
    editor: string;
    suggestions_count: number;
    acceptances_count: number;
    lines_suggested: number;
    lines_accepted: number;
    active_users: number;
  
    constructor(data: any) {
      this.language = data.language;
      this.editor = data.editor;
      this.suggestions_count = data.suggestions_count;
      this.acceptances_count = data.acceptances_count;
      this.lines_suggested = data.lines_suggested;
      this.lines_accepted = data.lines_accepted;
      this.active_users = data.active_users;
    }
  }
  
  export class Metrics {
    total_suggestions_count: number;
    total_acceptances_count: number;
    total_lines_suggested: number;
    total_lines_accepted: number;
    total_active_users: number;
    day: string;
    breakdown: Breakdown[];
  
    constructor(data: any) {
      this.total_suggestions_count = data.total_suggestions_count;
      this.total_acceptances_count = data.total_acceptances_count;
      this.total_lines_suggested = data.total_lines_suggested;
      this.total_lines_accepted = data.total_lines_accepted;
      this.total_active_users = data.total_active_users;
      this.day = data.day;
      this.breakdown = data.breakdown.map((item: any) => new Breakdown(item));
    }
  }