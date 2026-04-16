const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const SYSTEM_USER_EMAIL = 'system@local'

const DEFAULT_PRIORITY_CONFIGS = [
  { category: 'P1', baseWeight: 100, agingFactor: 2.0, slaHours: 24, lockTimeoutMinutes: 5 },
  { category: 'P2', baseWeight: 75, agingFactor: 1.5, slaHours: 48, lockTimeoutMinutes: 5 },
  { category: 'P3', baseWeight: 50, agingFactor: 1.0, slaHours: 72, lockTimeoutMinutes: 5 },
  { category: 'P4', baseWeight: 25, agingFactor: 0.5, slaHours: 120, lockTimeoutMinutes: 5 },
]

async function main() {
  const systemUser = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: {
      email: SYSTEM_USER_EMAIL,
      name: 'System',
    },
  })

  for (const config of DEFAULT_PRIORITY_CONFIGS) {
    await prisma.priorityConfig.upsert({
      where: { category: config.category },
      update: {
        baseWeight: config.baseWeight,
        agingFactor: config.agingFactor,
        slaHours: config.slaHours,
        lockTimeoutMinutes: config.lockTimeoutMinutes,
        updatedById: systemUser.id,
      },
      create: {
        ...config,
        updatedById: systemUser.id,
      },
    })
  }

  console.log('Seeded priority configs for P1-P4')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
