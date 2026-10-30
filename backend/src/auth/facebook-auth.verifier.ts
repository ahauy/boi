import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FacebookProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

interface FacebookDebugTokenResponse {
  data?: {
    app_id?: string;
    is_valid?: boolean;
    user_id?: string;
  };
}

interface FacebookMeResponse {
  id?: string;
  name?: string;
  email?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}

@Injectable()
export class FacebookAuthVerifier {
  private readonly logger = new Logger(FacebookAuthVerifier.name);

  constructor(private readonly configService: ConfigService) {}

  async verify(accessToken: string): Promise<FacebookProfile> {
    const appId = this.configService.get<string>('FACEBOOK_APP_ID');
    const appSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');

    try {
      if (appId && appSecret) {
        const debugUrl = new URL('https://graph.facebook.com/debug_token');
        debugUrl.searchParams.set('input_token', accessToken);
        debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`);

        const debugRes = await fetch(debugUrl.toString());
        if (!debugRes.ok) {
          // Graph API explains config problems here (e.g. app set as "Native or desktop app")
          throw new Error(`Failed to debug Facebook token: ${await debugRes.text()}`);
        }
        const debugBody = (await debugRes.json()) as FacebookDebugTokenResponse;
        if (
          !debugBody?.data?.is_valid ||
          String(debugBody.data.app_id) !== String(appId)
        ) {
          throw new Error('Invalid Facebook token audience or status');
        }
      }

      const meUrl = new URL('https://graph.facebook.com/me');
      meUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
      meUrl.searchParams.set('access_token', accessToken);

      const meRes = await fetch(meUrl.toString());
      if (!meRes.ok) {
        throw new Error(`Failed to fetch Facebook user profile: ${await meRes.text()}`);
      }

      const payload = (await meRes.json()) as FacebookMeResponse;
      if (!payload?.id) {
        throw new Error('Missing Facebook user id');
      }

      const normalizedEmail = payload.email ? payload.email.trim().toLowerCase() : null;

      return {
        sub: String(payload.id),
        email: normalizedEmail,
        emailVerified: Boolean(normalizedEmail),
        name: payload.name ?? null,
        picture: payload.picture?.data?.url ?? null,
      };
    } catch (error: any) {
      this.logger.warn(`Facebook token verification failed: ${error?.message ?? error}`);
      throw new UnauthorizedException({
        code: 'OAUTH_INVALID_TOKEN',
        message: 'Không xác minh được tài khoản Facebook. Vui lòng thử lại.',
      });
    }
  }
}
