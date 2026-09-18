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
      { name: 'Welcome Item', description: 'Seeded sample item #1 (getting started)' },
      { name: 'Second item', description: 'Seeded sample item #2' },
      { name: 'Search me', description: 'Contains the keyword search for testing search_items' },
      { name: 'No description item', description: null },
    ],
  });
  console.log('[seed] inserted sample items');
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
