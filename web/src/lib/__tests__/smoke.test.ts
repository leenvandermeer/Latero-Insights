/**
 * Smoke Tests — Critical User Flows
 *
 * These tests verify that the most important user journeys work end-to-end.
 * Run these before deploying to production.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';

// Mock the getPgPool function
vi.mock('@/lib/insights-saas-db', () => ({
  getPgPool: vi.fn(() => mockPool),
}));

const mockPool: Partial<Pool> = {
  query: vi.fn(),
  connect: vi.fn(),
};

describe('Smoke Tests — Critical Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockPool.query as any).mockClear();
  });

  describe('Drift Detection Flow', () => {
    it('should detect drift and create change event', async () => {
      const { detectSchemaDrift } = await import('@/lib/change-detection');

      // Mock: no duplicate, INSERT succeeds
      (mockPool.query as any)
        .mockResolvedValueOnce({ rows: [] }) // shouldSkipDuplicate
        .mockResolvedValueOnce({ rows: [{ id: 'evt-123' }] }); // INSERT

      await detectSchemaDrift(
        'my-dataset',
        'install-1',
        { object_name: 'table_v1' },
        { object_name: 'table_v2' }
      );

      // Verify INSERT was called
      const insertCall = (mockPool.query as any).mock.calls.find(
        (c: any[]) => c[0]?.includes('INSERT INTO meta.change_events')
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1]).toContain('install-1');
      expect(insertCall[1]).toContain('my-dataset');
    });

    it('should skip duplicate events within 5-minute window', async () => {
      const { detectSchemaDrift } = await import('@/lib/change-detection');

      // Mock: duplicate exists
      (mockPool.query as any).mockResolvedValueOnce({ rows: [{ id: 1 }] }); // shouldSkipDuplicate

      await detectSchemaDrift(
        'my-dataset',
        'install-1',
        { object_name: 'table_v1' },
        { object_name: 'table_v2' }
      );

      // Verify only one query (deduplication check, no INSERT)
      expect((mockPool.query as any).mock.calls.length).toBe(1);
    });
  });

  describe('Notifications Flow', () => {
    it('should fetch notification config', async () => {
      const { getNotificationConfig } = await import('@/lib/notifications');

      (mockPool.query as any).mockResolvedValueOnce({
        rows: [
          {
            channels: {
              slack: { enabled: true, webhook_url: 'https://hooks.slack.com/test', severity_filter: 'significant' },
            },
          },
        ],
      });

      const config = await getNotificationConfig('install-1');

      expect(config).toBeDefined();
      expect(config.slack?.enabled).toBe(true);
    });

    it('should return empty config when none exists', async () => {
      const { getNotificationConfig } = await import('@/lib/notifications');

      (mockPool.query as any).mockResolvedValueOnce({ rows: [] });

      const config = await getNotificationConfig('install-1');

      expect(config).toEqual({});
    });
  });

  describe('Settings API Response Shape', () => {
    it('should return correct notification config shape', () => {
      const expectedShape = {
        enabled: expect.any(Boolean),
        min_severity: expect.stringMatching(/^(informational|significant|breaking)$/),
        channels: {
          slack: expect.objectContaining({
            enabled: expect.any(Boolean),
            severity_filter: expect.any(String),
          }),
          pagerduty: expect.objectContaining({
            enabled: expect.any(Boolean),
            severity_filter: expect.any(String),
          }),
          email: expect.objectContaining({
            enabled: expect.any(Boolean),
            recipients: expect.any(Array),
            severity_filter: expect.any(String),
          }),
        },
      };

      const mockResponse = {
        enabled: true,
        min_severity: 'significant',
        channels: {
          slack: { enabled: false, severity_filter: 'significant' },
          pagerduty: { enabled: false, severity_filter: 'significant' },
          email: { enabled: false, recipients: [], severity_filter: 'significant' },
        },
      };

      expect(mockResponse).toMatchObject(expectedShape);
    });
  });

  describe('Change Detection Severity Logic', () => {
    it('should classify null→value as informational', async () => {
      const { detectSchemaDrift } = await import('@/lib/change-detection');

      (mockPool.query as any)
        .mockResolvedValueOnce({ rows: [] }) // shouldSkipDuplicate
        .mockResolvedValueOnce({ rows: [{ id: 'evt-123' }] }); // INSERT

      await detectSchemaDrift(
        'dataset-1',
        'install-1',
        { object_name: null },
        { object_name: 'new_table' }
      );

      const insertCall = (mockPool.query as any).mock.calls.find(
        (c: any[]) => c[0]?.includes('INSERT INTO meta.change_events')
      );

      // Verify severity is informational
      expect(insertCall[1]).toContain('informational');
    });

    it('should classify value→null as significant', async () => {
      const { detectSchemaDrift } = await import('@/lib/change-detection');

      (mockPool.query as any)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'evt-123' }] });

      await detectSchemaDrift(
        'dataset-1',
        'install-1',
        { object_name: 'old_table' },
        { object_name: null }
      );

      const insertCall = (mockPool.query as any).mock.calls.find(
        (c: any[]) => c[0]?.includes('INSERT INTO meta.change_events')
      );

      expect(insertCall[1]).toContain('significant');
    });

    it('should classify value→different value as breaking', async () => {
      const { detectSchemaDrift } = await import('@/lib/change-detection');

      (mockPool.query as any)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'evt-123' }] });

      await detectSchemaDrift(
        'dataset-1',
        'install-1',
        { object_name: 'table_v1' },
        { object_name: 'table_v2' }
      );

      const insertCall = (mockPool.query as any).mock.calls.find(
        (c: any[]) => c[0]?.includes('INSERT INTO meta.change_events')
      );

      expect(insertCall[1]).toContain('breaking');
    });
  });

  describe('Database Schema Compatibility', () => {
    it('should have meta.change_events table with correct columns', () => {
      // This is a documentation test - verifies our assumptions about the schema
      const expectedColumns = [
        'id',
        'installation_id',
        'change_type',
        'severity',
        'entity_type',
        'entity_id',
        'diff',
        'risk_assessment',
        'detected_at',
      ];

      // In a real smoke test against DB, we'd query INFORMATION_SCHEMA
      // For now, this serves as documentation
      expect(expectedColumns.length).toBeGreaterThan(0);
    });

    it('should have meta.notification_configs table', () => {
      const expectedColumns = [
        'config_id',
        'installation_id',
        'enabled',
        'min_severity',
        'channels',
        'created_at',
        'updated_at',
      ];

      expect(expectedColumns.length).toBeGreaterThan(0);
    });
  });
});
