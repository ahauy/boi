import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

@Injectable()
export class GoogleAuthVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  //! Exchange an authorization code from initCodeClient (popup mode) for an ID token, then verify it
  async verifyCode(code: string): Promise<GoogleProfile> {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    // Popup-mode codes are bound to the special "postmessage" redirect URI
    const codeClient = new OAuth2Client({ clientId, clientSecret, redirectUri: 'postmessage' });

    let idToken: string | null | undefined;
    try {
      const { tokens } = await codeClient.getToken(code);
      idToken = tokens.id_token;
    } catch {
      idToken = null;
    }

    if (!idToken) {
      throw new UnauthorizedException({
        code: 'OAUTH_INVALID_TOKEN',
        message: 'Không xác minh được tài khoản Google. Vui lòng thử lại.',
      });
    }

    return this.verify(idToken);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    // id_token do web tạo có aud = web client; app mobile (Android/iOS) tạo id_token với aud là
    // client ID nền tảng của chính nó — nếu chỉ nhận GOOGLE_CLIENT_ID thì mobile luôn bị từ chối
    const audience = [
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      ...(this.configService.get<string>('GOOGLE_MOBILE_CLIENT_IDS') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ];

    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('Missing sub claim');

      return {
        sub: payload.sub,
        email: payload.email ? payload.email.toLowerCase() : null,
        emailVerified: payload.email_verified === true,
        name: payload.name ?? null,
        picture: payload.picture ?? null,
      };
    } catch {
      throw new UnauthorizedException({
        code: 'OAUTH_INVALID_TOKEN',
        message: 'Không xác minh được tài khoản Google. Vui lòng thử lại.',
      });
    }
  }
}
