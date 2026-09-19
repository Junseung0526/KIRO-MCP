// Auth service: single-user password (bcrypt) stored in app_config, and JWT
// session issuance/verification. Secrets never leave this layer or get logged.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../prisma';
import { BadRequestError } from '../errors';

const CONFIG_ID = 1;
const BCRYPT_ROUNDS = 12;

async function getConfigRow() {
  return prisma.appConfig.findUnique({ where: { id: CONFIG_ID } });
}

export const authService = {
  // Whether an initial password has been set.
  async isInitialized(): Promise<boolean> {
    const row = await getConfigRow();
    return Boolean(row?.passwordHash);
  },

  // First-run password setup. Fails if already initialized.
  async setup(password: string): Promise<void> {
    if (await this.isInitialized()) {
      throw new BadRequestError('password already set; use login');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new BadRequestError('password must be at least 8 characters');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.appConfig.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID, passwordHash },
      update: { passwordHash },
    });
  },

  // Verify password; returns true on match.
  async verifyPassword(password: string): Promise<boolean> {
    const row = await getConfigRow();
    if (!row?.passwordHash) return false;
    if (typeof password !== 'string' || password.length === 0) return false;
    return bcrypt.compare(password, row.passwordHash);
  },

  // Change password (requires current password).
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const ok = await this.verifyPassword(currentPassword);
    if (!ok) throw new BadRequestError('current password is incorrect');
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new BadRequestError('new password must be at least 8 characters');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.appConfig.update({ where: { id: CONFIG_ID }, data: { passwordHash } });
  },

  issueToken(): string {
    return jwt.sign({ sub: 'owner' }, config.jwtSecret, {
      expiresIn: config.sessionTtlSeconds,
    });
  },

  verifyToken(token: string): boolean {
    try {
      jwt.verify(token, config.jwtSecret);
      return true;
    } catch {
      return false;
    }
  },
};
