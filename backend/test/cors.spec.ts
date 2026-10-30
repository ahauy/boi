import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { createCorsOriginValidator } from '../src/main';

describe('US-DEPLOY-01: CORS Origin Validator', () => {
  describe('Production Mode', () => {
    const validator = createCorsOriginValidator('production', 'https://palmsight.app');

    it('allows matching single PUBLIC_BASE_URL', () => {
      let allowed: boolean | undefined;
      validator('https://palmsight.app', (err, allow) => {
        expect(err).toBeNull();
        allowed = allow;
      });
      expect(allowed).toBe(true);
    });

    it('allows matching PUBLIC_BASE_URL with trailing slash', () => {
      let allowed: boolean | undefined;
      validator('https://palmsight.app/', (err, allow) => {
        expect(err).toBeNull();
        allowed = allow;
      });
      expect(allowed).toBe(true);
    });

    it('allows server-to-server requests without origin header (origin === undefined)', () => {
      let allowed: boolean | undefined;
      validator(undefined, (err, allow) => {
        expect(err).toBeNull();
        allowed = allow;
      });
      expect(allowed).toBe(true);
    });

    it('allows origins matching comma-separated PUBLIC_BASE_URL', () => {
      const multiValidator = createCorsOriginValidator(
        'production',
        'https://palmsight.com, https://my-app.vercel.app'
      );

      let allowed1: boolean | undefined;
      multiValidator('https://palmsight.com', (err, allow) => {
        expect(err).toBeNull();
        allowed1 = allow;
      });
      expect(allowed1).toBe(true);

      let allowed2: boolean | undefined;
      multiValidator('https://my-app.vercel.app', (err, allow) => {
        expect(err).toBeNull();
        allowed2 = allow;
      });
      expect(allowed2).toBe(true);
    });

    it('allows *.vercel.app origins in production', () => {
      const vercelOrigins = [
        'https://palmsight.vercel.app',
        'https://palmsight-preview-123.vercel.app',
      ];

      for (const origin of vercelOrigins) {
        let allowed: boolean | undefined;
        validator(origin, (err, allow) => {
          expect(err).toBeNull();
          allowed = allow;
        });
        expect(allowed).toBe(true);
      }
    });

    it('rejects unauthorized origin in production with ForbiddenException / "not allowed by CORS"', () => {
      let receivedErr: unknown = null;
      validator('https://evil-site.com', (err) => {
        receivedErr = err;
      });
      expect(receivedErr).toBeInstanceOf(ForbiddenException);
      expect((receivedErr as ForbiddenException).message).toContain('not allowed by CORS');
    });

    it('rejects wildcard origin when PUBLIC_BASE_URL is *', () => {
      const wildcardValidator = createCorsOriginValidator('production', '*');
      let receivedErr: unknown = null;
      wildcardValidator('https://any-domain.com', (err) => {
        receivedErr = err;
      });
      expect(receivedErr).toBeInstanceOf(Error);
      expect((receivedErr as Error).message).toContain('CORS wildcard * is strictly forbidden in production');
    });

    it('rejects wildcard origin when PUBLIC_BASE_URL is empty', () => {
      const emptyValidator = createCorsOriginValidator('production', '');
      let receivedErr: unknown = null;
      emptyValidator('https://any-domain.com', (err) => {
        receivedErr = err;
      });
      expect(receivedErr).toBeInstanceOf(Error);
      expect((receivedErr as Error).message).toContain('CORS wildcard * is strictly forbidden in production');
    });
  });

  describe('Development Mode', () => {
    const validator = createCorsOriginValidator('development', 'http://localhost:5173');

    it('allows localhost:5173', () => {
      let allowed: boolean | undefined;
      validator('http://localhost:5173', (err, allow) => {
        expect(err).toBeNull();
        allowed = allow;
      });
      expect(allowed).toBe(true);
    });

    it('allows ngrok-free.app tunnel domains', () => {
      let allowed: boolean | undefined;
      validator('https://palmsight-dev.ngrok-free.app', (err, allow) => {
        expect(err).toBeNull();
        allowed = allow;
      });
      expect(allowed).toBe(true);
    });

    it('rejects unknown untrusted origins in development with ForbiddenException', () => {
      let receivedErr: unknown = null;
      validator('http://hacker.com', (err) => {
        receivedErr = err;
      });
      expect(receivedErr).toBeInstanceOf(ForbiddenException);
      expect((receivedErr as ForbiddenException).message).toContain('not allowed by CORS');
    });
  });
});
