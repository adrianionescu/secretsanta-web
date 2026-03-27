import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionService } from '../../services/session.service';
import { Pair, SessionModel } from '@secret-santa/shared';

@Component({
  selector: 'app-session-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-list.component.html',
  styleUrls: ['./session-list.component.css'],
})
export class SessionListComponent implements OnInit {
  private readonly sessionService = inject(SessionService);

  sessions: SessionModel[] = [];
  loading = false;
  error = '';
  confirmDeleteName: string | null = null;
  copiedKey: string | null = null;

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.sessionService.listSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load sessions.';
        this.loading = false;
      }
    });
  }

  deleteSession(name: string) {
    this.confirmDeleteName = name;
  }

  confirmDelete() {
    if (!this.confirmDeleteName) return;
    const name = this.confirmDeleteName;
    this.confirmDeleteName = null;
    this.sessionService.deleteSession(name).subscribe({
      next: () => this.load(),
      error: (err) => { this.error = err.message || 'Failed to delete session.'; }
    });
  }

  cancelDelete() {
    this.confirmDeleteName = null;
  }

  formatMessage(pair: Pair): string {
    return `Draga ${pair.giver} tu esti numarul ${pair.giverId} si oferi cadou numarului ${pair.receiverId}`;
  }

  copyMessage(pair: Pair, key: string) {
    navigator.clipboard.writeText(this.formatMessage(pair)).then(() => {
      this.copiedKey = key;
      setTimeout(() => { this.copiedKey = null; }, 2000);
    });
  }

  parsePairs(pairsJson: string): Pair[] {
    return this.sessionService.parsePairs(pairsJson);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  exportSession(session: SessionModel) {
    const pairs = this.parsePairs(session.pairs);
    const lines = [
      `Session: ${session.name}`,
      `Date: ${this.formatDate(session.createdAt)}`,
      `Participants: ${session.participants.join(', ')}`,
      '',
      'Pairs:',
      ...pairs.map(p => `${p.giver} (${p.giverId}) -> ${p.receiver} (${p.receiverId})`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportAllSessions() {
    const blocks = this.sessions.map(session => {
      const pairs = this.parsePairs(session.pairs);
      return [
        `Session: ${session.name}`,
        `Date: ${this.formatDate(session.createdAt)}`,
        `Participants: ${session.participants.join(', ')}`,
        '',
        'Pairs:',
        ...pairs.map(p => `${p.giver} (${p.giverId}) -> ${p.receiver} (${p.receiverId})`),
      ].join('\n');
    });
    const blob = new Blob([blocks.join('\n\n---\n\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sessions.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      const sessions = this.parseSessionsFile(reader.result as string);
      if (sessions.length === 0) {
        this.error = 'No valid sessions found in file.';
        return;
      }
      this.error = '';
      let imported = 0;
      const errors: string[] = [];
      const importNext = (index: number) => {
        if (index >= sessions.length) {
          if (imported > 0) this.load();
          if (errors.length > 0) this.error = errors.join(' | ');
          return;
        }
        const s = sessions[index];
        this.sessionService.saveSession(s.name, s.participants, s.pairs).subscribe({
          next: () => { imported++; importNext(index + 1); },
          error: (err) => {
            errors.push(`"${s.name}": ${err.error?.message || err.message || 'Failed'}`);
            importNext(index + 1);
          }
        });
      };
      importNext(0);
    };
    reader.readAsText(file);
  }

  private parseSessionsFile(content: string): Array<{ name: string; participants: string[]; pairs: string }> {
    return content.split(/\n---\n/)
      .map(block => this.parseSessionBlock(block.trim()))
      .filter((s): s is { name: string; participants: string[]; pairs: string } => s !== null);
  }

  private parseSessionBlock(block: string): { name: string; participants: string[]; pairs: string } | null {
    const lines = block.split('\n').map(l => l.trim());

    const nameLine = lines.find(l => l.startsWith('Session: '));
    const participantsLine = lines.find(l => l.startsWith('Participants: '));
    const pairsStart = lines.indexOf('Pairs:');

    if (!nameLine || !participantsLine || pairsStart === -1) return null;

    const name = nameLine.slice('Session: '.length).trim();
    const participants = participantsLine.slice('Participants: '.length)
      .split(',').map(p => p.trim()).filter(p => p.length > 0);

    const pairRegex = /^(.+) \((\d{4})\) -> (.+) \((\d{4})\)$/;
    const pairs: Pair[] = [];
    for (const line of lines.slice(pairsStart + 1)) {
      if (!line) continue;
      const match = line.match(pairRegex);
      if (!match) return null;
      pairs.push({ giver: match[1].trim(), giverId: match[2], receiver: match[3].trim(), receiverId: match[4] });
    }

    if (!name || participants.length === 0 || pairs.length === 0) return null;

    return { name, participants, pairs: JSON.stringify(pairs) };
  }
}
