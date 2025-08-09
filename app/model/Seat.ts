export class Seat {
    login: string;
    id: number;
    team: string;
    created_at: string;
    last_activity_at: string;
    last_activity_editor: string;
    plan_type: string;

    constructor(data: any) {
        this.login = data.assignee ? data.assignee.login : 'deprecated';
        this.id = data.assignee ? data.assignee.id : 0;
        this.team = data.assigning_team ? data.assigning_team.name : '';
        this.created_at = data.created_at;
        this.last_activity_at = data.last_activity_at;
        this.last_activity_editor = data.last_activity_editor;
        this.plan_type = data.plan_type;
    }
}

export class TotalSeats {
    total_seats: number;
    seats: Seat[];

    constructor(data: any) {
        this.total_seats = data.total_seats;
        this.seats = data.seats.map((seat: any) => new Seat(seat));
    }
}