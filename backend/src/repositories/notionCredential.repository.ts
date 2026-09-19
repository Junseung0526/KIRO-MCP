// Repository for the single-row Notion credential. Isolates Prisma access so
// the service layer stays persistence-agnostic (future multi-user friendly).
import { NotionCredential } from '@prisma/client';
import { prisma } from '../prisma';

const CRED_ID = 1;

export const notionCredentialRepository = {
  find(): Promise<NotionCredential | null> {
    return prisma.notionCredential.findUnique({ where: { id: CRED_ID } });
  },

  upsert(encryptedToken: string, databaseId: string): Promise<NotionCredential> {
    return prisma.notionCredential.upsert({
      where: { id: CRED_ID },
      create: { id: CRED_ID, encryptedToken, databaseId },
      update: { encryptedToken, databaseId },
    });
  },

  async remove(): Promise<void> {
    await prisma.notionCredential.deleteMany({ where: { id: CRED_ID } });
  },
};
