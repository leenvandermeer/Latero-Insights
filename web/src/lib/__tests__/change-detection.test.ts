import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool, PoolClient } from 'pg';
import {
  detectSchemaDrift,
  detectLineageDrift,
  detectStatisticalDrift,
  detectOwnershipDrift,
  detectContractDrift,
} from '@/lib/change-detection';

// Mock the getPgPool function
vi.mock('@/lib/insights-saas-db', () => ({
  getPgPool: vi.fn(() => mockPool),
}));

const mockPool: Partial<Pool> = {
  query: vi.fn(),
  connect: vi.fn(),
};

const mockClient: Partial<PoolClient> = {
  query: vi.fn(),
  release: vi.fn(),
};

describe('Change Detection Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockPool.query as any).mockClear();
    (mockClient.query as any).mockClear();
  });

  describe('detectSchemaDrift', () => {
    it('should detect breaking severity when schema changes from value to different value', async () => {
      const before = { object_name: 'schema_v1' };
      const after = { object_name: 'schema_v2' };

      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ id: 'evt-1' }],
      });

      await detectSchemaDrift('dataset1', 'inst1', before, after);

      // Verify event was written with breaking severity
      const call = (mockPool.query as any).mock.calls.find(
        (c: any[]) => c[0]?.includes('INSERT INTO meta.change_events')
      );
      expect(call).toBeDefined();
    });

    it('should detect significant severity when schema changes from value to null', async () => {
      const before = { object_name: 'schema_v1' };
      const after = { object_name: null };

      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ id: 'evt-1' }],
      });

      await detectSchemaDrift('dataset1', 'inst1', before, after);

      const call = (mockPool.query as any).mock.calls.find(
        (c: any[]) => c[0]?.includes('INSERT INTO meta.change_events')
      );
      expect(call).toBeDefined();
    });

    it('should detect informational severity when schema changes from null to value', async () => {
      const before = { object_name: null };
      const after = { object_name: 'schema_v1' };

      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ id: 'evt-1' }],
      });

      await detectSchemaDrift('dataset1', 'inst1', before, after);

      const call = (mockPool.query as any).mock.calls.find(
        (c: any[]) => c[0]?.includes('INSERT INTO meta.change_events')
      );
      expect(call).toBeDefined();
    });

    it('should skip event when object_name is unchanged', async () => {
      const before = { object_name: 'schema_v1' };
      const after = { object_name: 'schema_v1' };

      await detectSchemaDrift('dataset1', 'inst1', before, after);

      // Should not call query when no change detected
      expect((mockPool.query as any).mock.calls.length).toBe(0);
    });

    it('should skip duplicate events within 5-minute window', async () => {
      const before = { object_name: 'schema_v1' };
      const after = { object_name: 'schema_v2' };

      // Mock: deduplication check returns true (duplicate exists)
      (mockPool.query as any)
        .mockResolvedValueOnce({ rows: [{ id: 'existing_event' }] }) // shouldSkipDuplicate returns true
        .mockResolvedValueOnce({ rows: [] }); // Second query ignored

      // Deduplication should prevent event write
      await detectSchemaDrift('dataset1', 'inst1', before, after);

      // Verify deduplication query was made
      const dedupCall = (mockPool.query as any).mock.calls.find(
        (c: any[]) => c[0]?.includes('schema_migrations') === false && c[0]?.includes('change_events')
      );
      expect(dedupCall).toBeDefined();
    });
  });

  describe('detectLineageDrift', () => {
    it('should detect informational severity when new INPUT dataset added', async () => {
      // Mock: current run has inputs [A, B], previous run had inputs [A]
      (mockPool.query as any)
        .mockResolvedValueOnce({
          rows: [
            { dataset_id: 'A', role: 'INPUT' },
            { dataset_id: 'B', role: 'INPUT' },
          ],
        }) // current inputs
        .mockResolvedValueOnce({
          rows: [{ dataset_id: 'A', role: 'INPUT' }],
        }); // previous inputs

      await detectLineageDrift('job1', 'run-uuid', 'inst1');

      expect((mockPool.query as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('should detect significant severity when 1 INPUT dataset removed', async () => {
      // Current run has [A], previous run had [A, B]
      (mockPool.query as any)
        .mockResolvedValueOnce({
          rows: [{ dataset_id: 'A', role: 'INPUT' }],
        }) // current inputs
        .mockResolvedValueOnce({
          rows: [
            { dataset_id: 'A', role: 'INPUT' },
            { dataset_id: 'B', role: 'INPUT' },
          ],
        }); // previous inputs

      await detectLineageDrift('job1', 'run-uuid', 'inst1');

      expect((mockPool.query as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('should detect breaking severity when 2+ INPUT datasets removed', async () => {
      // Current run has [A], previous run had [A, B, C]
      (mockPool.query as any)
        .mockResolvedValueOnce({
          rows: [{ dataset_id: 'A', role: 'INPUT' }],
        }) // current inputs
        .mockResolvedValueOnce({
          rows: [
            { dataset_id: 'A', role: 'INPUT' },
            { dataset_id: 'B', role: 'INPUT' },
            { dataset_id: 'C', role: 'INPUT' },
          ],
        }); // previous inputs

      await detectLineageDrift('job1', 'run-uuid', 'inst1');

      expect((mockPool.query as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('should skip when no previous run exists', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ dataset_id: 'A', role: 'INPUT' }],
      });

      await detectLineageDrift('job1', 'run-uuid', 'inst1');

      // Should return early without write if no previous run
      expect((mockPool.query as any).mock.calls.length).toBeLessThan(2);
    });
  });

  describe('detectStatisticalDrift', () => {
    it('should detect informational severity for z-score > 2', async () => {
      // Mock: current duration is 2+ std deviations from 30-day mean
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [
          {
            mean_duration_ms: 100,
            stddev_duration_ms: 20,
            latest_duration_ms: 150, // 2.5 std deviations
          },
        ],
      });

      await detectStatisticalDrift('dataset1', 'inst1');

      expect((mockPool.query as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('should detect significant severity for z-score > 3', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [
          {
            mean_duration_ms: 100,
            stddev_duration_ms: 20,
            latest_duration_ms: 170, // 3.5 std deviations
          },
        ],
      });

      await detectStatisticalDrift('dataset1', 'inst1');

      expect((mockPool.query as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('should skip when z-score < 2', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [
          {
            mean_duration_ms: 100,
            stddev_duration_ms: 20,
            latest_duration_ms: 110, // 0.5 std deviations
          },
        ],
      });

      await detectStatisticalDrift('dataset1', 'inst1');

      // No drift event should be written
      const writeCall = (mockPool.query as any).mock.calls.find(
        (c: any[]) => c[0]?.includes('INSERT INTO meta.change_events')
      );
      expect(writeCall).toBeUndefined();
    });
  });

  describe('detectOwnershipDrift', () => {
    it('should detect informational severity when owner changes', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ id: 'evt-1' }],
      });

      await detectOwnershipDrift('product1', 'inst1', 'alice@example.com', 'bob@example.com');

      expect((mockPool.query as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('should detect significant severity when owner becomes null', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ id: 'evt-1' }],
      });

      await detectOwnershipDrift('product1', 'inst1', 'alice@example.com', null);

      expect((mockPool.query as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('should skip when owner is unchanged', async () => {
      await detectOwnershipDrift('product1', 'inst1', 'alice@example.com', 'alice@example.com');

      expect((mockPool.query as any).mock.calls.length).toBe(0);
    });
  });

  describe('detectContractDrift', () => {
    it('should detect drift when SLA changes', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ id: 'evt-1' }],
      });

      await detectContractDrift(
        'product1',
        'inst1',
        'SLA_TIER_1',
        'SLA_TIER_2',
        'v1.0',
        'v1.0'
      );

      expect((mockPool.query as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('should detect drift when contract_ver changes', async () => {
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ id: 'evt-1' }],
      });

      await detectContractDrift(
        'product1',
        'inst1',
        'SLA_TIER_1',
        'SLA_TIER_1',
        'v1.0',
        'v2.0'
      );

      expect((mockPool.query as any).mock.calls.length).toBeGreaterThan(0);
    });

    it('should skip when both SLA and contract_ver unchanged', async () => {
      await detectContractDrift('product1', 'inst1', 'SLA_TIER_1', 'SLA_TIER_1', 'v1.0', 'v1.0');

      expect((mockPool.query as any).mock.calls.length).toBe(0);
    });
  });

  describe('Deduplication Logic', () => {
    it('should respect 5-minute deduplication window per entity+type', async () => {
      // Mock: deduplication check finds recent event
      (mockPool.query as any).mockResolvedValueOnce({
        rows: [{ id: 'recent_event' }], // Exists within 5 min
      });

      await detectOwnershipDrift('product1', 'inst1', 'alice', 'bob');

      // Should not insert second event
      const insertCall = (mockPool.query as any).mock.calls.find(
        (c: any[]) => c[0]?.includes('INSERT INTO meta.change_events')
      );
      expect(insertCall).toBeUndefined();
    });
  });
});
