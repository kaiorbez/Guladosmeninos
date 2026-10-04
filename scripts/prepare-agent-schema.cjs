// Add the nullable reference and its uniqueness constraint without deleting rows.
// Duplicate non-null references abort the transaction rather than discarding data.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(73401926)');
    await tx.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "agentRef" TEXT');
    await tx.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Order_agentRef_key" ON "Order" ("agentRef")');
  });
}
main().catch(error => {
  console.error('Safe agent schema preparation failed:', error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
