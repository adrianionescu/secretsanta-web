import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionService, Pair } from '../../services/session.service';
import { SessionModel } from '@secret-santa/shared';

@Component({
  selector: 'app-session-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-list.component.html',
  styleUrls: ['./session-list.component.css'],
})
export class SessionListComponent implements OnInit {
  sessions: SessionModel[] = [];
  loading = false;
  error = '';

  constructor(private sessionService: SessionService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.load(); 
  }

  load() {
    this.loading = true;
    this.sessionService.listSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err.message || 'Failed to load sessions.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  parsePairs(pairsJson: string): Pair[] {
    return this.sessionService.parsePairs(pairsJson);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
}
