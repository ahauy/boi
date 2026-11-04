import 'reflect-metadata';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { closeTestApp, createTestApp } from './test-helper';

describe('test-helper cleanup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps mongod data inside the dedicated test directory', () => {
    expect(tmpdir()).toBe(join(__dirname, '..', '.test-tmp'));
  });

  it('stops mongod when the app fails to start', async () => {
    const stop = vi.spyOn(MongoMemoryReplSet.prototype, 'stop');
    vi.spyOn(Test, 'createTestingModule').mockImplementation(() => {
      throw new Error('boot failed');
    });

    await expect(createTestApp()).rejects.toThrow('boot failed');

    expect(stop).toHaveBeenCalledTimes(1);
  }, 60000);

  it('closeTestApp tolerates an app that never started', async () => {
    await expect(closeTestApp(undefined)).resolves.toBeUndefined();
  });
});
