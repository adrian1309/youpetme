import { randomUUID } from 'node:crypto';

import type { PrismaService } from '../../../platform/database/prisma.service';

const MVP_SHELTER_ID = '00000000-0000-4000-8000-000000000001';

/** Integration-test rows written straight with Prisma: a user with a profile, and an animal. */
export async function seedUser(
  prisma: PrismaService,
  options: { role?: 'USER' | 'ADMIN'; firstName?: string } = {},
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = `user-${id}@example.com`;
  await prisma.user.create({
    data: {
      id,
      email,
      passwordHash: 'not-a-real-hash',
      role: options.role ?? 'USER',
      status: 'ACTIVE',
      termsAcceptedAt: new Date(),
      termsVersion: '2026-01',
      profile: {
        create: { id: randomUUID(), firstName: options.firstName ?? 'Ana', lastName: 'Ruiz' },
      },
    },
  });
  return { id, email };
}

export async function seedAnimal(
  prisma: PrismaService,
  status: 'AVAILABLE' | 'RESERVED' | 'ADOPTED' = 'AVAILABLE',
  name = 'Luna',
): Promise<string> {
  const id = randomUUID();
  await prisma.animal.create({
    data: {
      id,
      shelterId: MVP_SHELTER_ID,
      name,
      species: 'DOG',
      size: 'MEDIUM',
      ageGroup: 'ADULT',
      photoUrls: ['https://images.example.com/a.jpg'],
      status,
    },
  });
  return id;
}
