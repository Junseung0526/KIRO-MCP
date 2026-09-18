import { prisma } from './prisma';

// Idempotent seed: only inserts sample data when the table is empty.
async function main() {
  const count = await prisma.item.count();
  if (count > 0) {
    console.log(`[seed] items table already has ${count} rows, skipping seed`);
    return;
  }

  await prisma.item.createMany({
    data: [
      { name: 'First item', description: 'Seeded sample item #1' },
      { name: 'Second item', description: 'Seeded sample item #2' },
      { name: 'Third item', description: null },
    ],
  });
  console.log('[seed] inserted 3 sample items');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('[seed] failed:', err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
