import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ISessionRepository,
  Pair,
  SESSION_REPOSITORY_TOKEN,
  SessionModel,
} from '@secret-santa/shared';

@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async generatePairs(participants: string[]): Promise<string> {
    const latest = await this.sessionRepository.findMostRecent();
    let previousPairs: Pair[] = [];
    if (latest) {
      try {
        previousPairs = JSON.parse(latest.pairs) as Pair[];
      } catch {
        previousPairs = [];
      }
    }
    const pairs = this.generatePairsWithConstraints(participants, previousPairs);
    return JSON.stringify(pairs);
  }

  async listSessions(): Promise<SessionModel[]> {
    return this.sessionRepository.findAll();
  }

  async getLatestSession(): Promise<SessionModel | null> {
    return this.sessionRepository.findMostRecent();
  }

  async deleteSession(name: string): Promise<void> {
    return this.sessionRepository.deleteByName(name);
  }

  async deleteAllSessions(): Promise<void> {
    return this.sessionRepository.deleteAll();
  }

  async saveSession(
    name: string,
    participants: string[],
    pairs: string,
    createdAt?: string,
  ): Promise<SessionModel> {
    const exists = await this.sessionRepository.existsByName(name);
    if (exists) {
      throw new BadRequestException(
        `A session with the name "${name}" already exists.`,
      );
    }

    const session: SessionModel = {
      name,
      createdAt: createdAt ?? new Date().toISOString(),
      pairs,
      participants,
    };

    return this.sessionRepository.save(session);
  }

  private generatePairsWithConstraints(
    participants: string[],
    previousPairs: Pair[],
  ): Pair[] {
    const prevSet = new Set(
      previousPairs.map((p) => `${p.giver}:${p.receiver}`),
    );
    const idMap = this.generateUniqueIds(participants);

    for (let attempt = 0; attempt < 100; attempt++) {
      const receivers = [...participants];
      // Fisher-Yates shuffle
      for (let i = receivers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
      }

      const pairs: Pair[] = participants.map((giver, i) => ({
        giver,
        receiver: receivers[i],
        giverId: idMap.get(giver) as string,
        receiverId: idMap.get(receivers[i]) as string,
      }));

      // Check: no self-pairing, no repeat from previous session
      const valid = pairs.every(
        (p) =>
          p.giver !== p.receiver && !prevSet.has(`${p.giver}:${p.receiver}`),
      );

      if (valid) return pairs;
    }

    throw new Error('Could not generate valid pairs after 100 attempts');
  }

  private generateUniqueIds(participants: string[]): Map<string, string> {
    const used = new Set<number>();
    const map = new Map<string, string>();
    for (const p of participants) {
      let num: number;
      do { num = 1000 + Math.floor(Math.random() * 9000); } while (used.has(num));
      used.add(num);
      map.set(p, String(num));
    }
    return map;
  }
}
