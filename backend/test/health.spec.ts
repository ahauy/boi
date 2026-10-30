import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { HttpException, HttpStatus, INestApplication } from '@nestjs/common';
import { HealthController, HealthOkResponse } from '../src/health/health.controller';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';

describe('US-DEPLOY-03: HealthController & Health Endpoint', () => {
  describe('HealthController (Unit)', () => {
    let controller: HealthController;
    const mockConnection = {
      readyState: 1,
    };

    beforeAll(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          {
            provide: getConnectionToken(),
            useValue: mockConnection,
          },
        ],
      }).compile();

      controller = moduleRef.get<HealthController>(HealthController);
    });

    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should return { status: "ok", timestamp, database: "connected" } when DB is connected', () => {
      mockConnection.readyState = 1;
      const before = Date.now();
      const result = controller.getHealth() as HealthOkResponse;
      const after = Date.now();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.database).toBe('connected');
      expect(typeof result.timestamp).toBe('string');

      const timestampMillis = Date.parse(result.timestamp!);
      expect(Number.isNaN(timestampMillis)).toBe(false);
      expect(timestampMillis).toBeGreaterThanOrEqual(before - 1000);
      expect(timestampMillis).toBeLessThanOrEqual(after + 1000);
    });

    it('should throw HttpException 503 with { status: "error", database: "disconnected" } when DB disconnected', () => {
      mockConnection.readyState = 0;
      try {
        controller.getHealth();
        expect.unreachable('Should have thrown HttpException');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(httpErr.getResponse()).toEqual({
          status: 'error',
          database: 'disconnected',
        });
      } finally {
        mockConnection.readyState = 1;
      }
    });
  });

  describe('GET /api/v1/health (HTTP Integration)', () => {
    let app: INestApplication;
    let baseUrl: string;
    const mockConnection = { readyState: 1 };

    beforeAll(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          {
            provide: getConnectionToken(),
            useValue: mockConnection,
          },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      app.useGlobalFilters(new ApiExceptionFilter());
      app.setGlobalPrefix('api/v1');
      await app.listen(0);
      baseUrl = await app.getUrl();
    });

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    it('should return HTTP 200 with { status: "ok", timestamp, database: "connected" } when DB ready', async () => {
      mockConnection.readyState = 1;
      const res = await fetch(`${baseUrl}/api/v1/health`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const data = (await res.json()) as { status: string; timestamp: string; database: string };
      expect(data).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        database: 'connected',
      });
      expect(Number.isNaN(Date.parse(data.timestamp))).toBe(false);
    });

    it('should return HTTP 503 with { status: "error", database: "disconnected" } when DB disconnected', async () => {
      mockConnection.readyState = 0;
      const res = await fetch(`${baseUrl}/api/v1/health`);
      expect(res.status).toBe(503);

      const data = (await res.json()) as { status: string; database: string };
      expect(data).toEqual({
        status: 'error',
        database: 'disconnected',
      });
      mockConnection.readyState = 1;
    });

    it('should return HTTP 404 for un-prefixed /health route when global prefix is active', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(404);
    });
  });
});
