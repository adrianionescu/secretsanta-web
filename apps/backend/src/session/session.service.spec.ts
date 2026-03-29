import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SessionService } from './session.service';
import { ISessionRepository, SESSION_REPOSITORY_TOKEN, SessionModel } from '@secret-santa/shared';

const mockRepo = (): jest.Mocked<ISessionRepository> => ({
  findAll: jest.fn(),
  findMostRecent: jest.fn(),
  existsByName: jest.fn(),
  save: jest.fn(),
  deleteByName: jest.fn(),
  deleteAll: jest.fn(),
});

describe('SessionService', () => {
  let service: SessionService;
  let repo: jest.Mocked<ISessionRepository>;

  beforeEach(async () => {
    repo = mockRepo();
    const module = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: SESSION_REPOSITORY_TOKEN, useValue: repo },
      ],
    }).compile();
    service = module.get(SessionService);
  });

  // ── generatePairs ──────────────────────────────────────────────────────────

  describe('generatePairs', () => {
    beforeEach(() => repo.findMostRecent.mockResolvedValue(null));

    it('produces one pair per participant', async () => {
      const participants = ['Alice', 'Bob', 'Carol'];
      const result = JSON.parse(await service.generatePairs(participants));
      expect(result).toHaveLength(3);
    });

    it('never pairs a participant with themselves', async () => {
      const participants = ['Alice', 'Bob', 'Carol', 'Dave'];
      for (let i = 0; i < 20; i++) {
        const pairs = JSON.parse(await service.generatePairs(participants));
        pairs.forEach((p: { giver: string; receiver: string }) =>
          expect(p.giver).not.toBe(p.receiver)
        );
      }
    });

    it('assigns unique animal IDs to all participants', async () => {
      const participants = ['Alice', 'Bob', 'Carol'];
      const pairs = JSON.parse(await service.generatePairs(participants));
      const ids = pairs.map((p: { giverId: string }) => p.giverId);
      expect(new Set(ids).size).toBe(participants.length);
    });

    it('avoids repeating giver→receiver pairs from the previous session', async () => {
      const participants = ['Alice', 'Bob', 'Carol', 'Dave'];
      const previous: SessionModel = {
        name: 'prev',
        createdAt: new Date().toISOString(),
        participants,
        pairs: JSON.stringify([
          { giver: 'Alice', receiver: 'Bob', giverId: 'panda rosu', receiverId: 'capybara' },
          { giver: 'Bob', receiver: 'Carol', giverId: 'capybara', receiverId: 'pisica' },
          { giver: 'Carol', receiver: 'Dave', giverId: 'pisica', receiverId: 'marmota' },
          { giver: 'Dave', receiver: 'Alice', giverId: 'marmota', receiverId: 'panda rosu' },
        ]),
      };
      repo.findMostRecent.mockResolvedValue(previous);

      for (let i = 0; i < 20; i++) {
        const pairs = JSON.parse(await service.generatePairs(participants));
        expect(pairs.find((p: { giver: string; receiver: string }) =>
          p.giver === 'Alice' && p.receiver === 'Bob'
        )).toBeUndefined();
      }
    });

    it('throws when participant count exceeds the animal ID pool', async () => {
      const tooMany = Array.from({ length: 11 }, (_, i) => `P${i}`);
      await expect(service.generatePairs(tooMany)).rejects.toThrow('Too many participants');
    });

    it('handles corrupt previous-session pairs gracefully', async () => {
      repo.findMostRecent.mockResolvedValue({
        name: 'bad', createdAt: '', participants: [], pairs: 'not-json',
      });
      const result = JSON.parse(await service.generatePairs(['Alice', 'Bob']));
      expect(result).toHaveLength(2);
    });
  });

  // ── saveSession ────────────────────────────────────────────────────────────

  describe('saveSession', () => {
    it('saves and returns the session', async () => {
      repo.existsByName.mockResolvedValue(false);
      const saved: SessionModel = {
        name: 'xmas', createdAt: '2024-12-01T00:00:00Z',
        participants: ['Alice', 'Bob'], pairs: '[]',
      };
      repo.save.mockResolvedValue(saved);

      const result = await service.saveSession('xmas', ['Alice', 'Bob'], '[]');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'xmas' }));
      expect(result).toEqual(saved);
    });

    it('uses the provided createdAt when supplied', async () => {
      repo.existsByName.mockResolvedValue(false);
      repo.save.mockImplementation(async (s) => s);

      const ts = '2024-01-01T00:00:00Z';
      const result = await service.saveSession('xmas', [], '[]', ts);
      expect(result.createdAt).toBe(ts);
    });

    it('generates a createdAt timestamp when not supplied', async () => {
      repo.existsByName.mockResolvedValue(false);
      repo.save.mockImplementation(async (s) => s);

      const result = await service.saveSession('xmas', [], '[]');
      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('throws BadRequestException when name already exists', async () => {
      repo.existsByName.mockResolvedValue(true);
      await expect(service.saveSession('xmas', [], '[]')).rejects.toThrow(BadRequestException);
    });
  });

  // ── delegation ─────────────────────────────────────────────────────────────

  describe('listSessions', () => {
    it('delegates to repository', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.listSessions();
      expect(repo.findAll).toHaveBeenCalled();
    });
  });

  describe('getLatestSession', () => {
    it('delegates to repository', async () => {
      repo.findMostRecent.mockResolvedValue(null);
      await service.getLatestSession();
      expect(repo.findMostRecent).toHaveBeenCalled();
    });
  });

  describe('deleteSession', () => {
    it('delegates to repository', async () => {
      repo.deleteByName.mockResolvedValue();
      await service.deleteSession('xmas');
      expect(repo.deleteByName).toHaveBeenCalledWith('xmas');
    });
  });

  describe('deleteAllSessions', () => {
    it('delegates to repository', async () => {
      repo.deleteAll.mockResolvedValue();
      await service.deleteAllSessions();
      expect(repo.deleteAll).toHaveBeenCalled();
    });
  });
});
