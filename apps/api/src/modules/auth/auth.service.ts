import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginInput, SessionUser } from '@imob/shared';
import { hashPassword, verifyPassword } from '../../common/auth/password.js';
import type { SessionTokenPayload } from '../../common/auth/session.js';
import { InvalidCredentialsError } from '../../common/errors/domain-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface LoginResult {
  user: SessionUser;
  token: string;
}

@Injectable()
export class AuthService {
  // Usado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails existem.
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginInput): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordHash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await verifyPassword(passwordHash, password);
    if (!user || !valid) throw new InvalidCredentialsError();

    const payload: SessionTokenPayload = { sub: user.id };
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: await this.jwt.signAsync(payload),
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword('dummy-password-for-timing');
    return this.dummyHash;
  }
}
