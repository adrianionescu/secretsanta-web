import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionService, Pair } from '../../services/session.service';
import { SessionModel } from '@secret-santa/shared';

export interface PairWithIds extends Pair {
  giverId: string;
  receiverId: string;
}

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
    if (!this.confirmDeleteName) {
      return;
    }
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

  parsePairsWithIds(sessionName: string, pairsJson: string): PairWithIds[] {
    const pairs = this.sessionService.parsePairs(pairsJson);
    const idMap = this.buildIdMap(sessionName, pairs);
    return pairs.map(p => ({
      ...p,
      giverId: idMap.get(p.giver) ?? '',
      receiverId: idMap.get(p.receiver) ?? '',
    }));
  }

  formatMessage(giver: string, giverId: string, receiverId: string): string {
    return `Draga ${giver} tu esti numarul ${giverId} si oferi cadou numarului ${receiverId}`;
  }

  copyMessage(giver: string, giverId: string, receiverId: string, key: string) {
    const message = this.formatMessage(giver, giverId, receiverId);
    navigator.clipboard.writeText(message).then(() => {
      this.copiedKey = key;
      setTimeout(() => { this.copiedKey = null; }, 2000);
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  private buildIdMap(sessionName: string, pairs: Pair[]): Map<string, string> {
    const people = [...new Set(pairs.flatMap(p => [p.giver, p.receiver]))].sort();

    let seed = 0;
    for (const ch of sessionName) {
      seed = Math.imul(seed, 31) + ch.charCodeAt(0);
    }

    const rand = this.seededRandom(seed);
    const used = new Set<number>();
    const map = new Map<string, string>();

    for (const person of people) {
      let num: number;
      do { num = 1000 + Math.floor(rand() * 9000); } while (used.has(num));
      used.add(num);
      map.set(person, String(num));
    }

    return map;
  }

  private seededRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = Math.imul(s, 1664525) + 1013904223 >>> 0;
      return s / 0x100000000;
    };
  }
}
