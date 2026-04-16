const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const SYSTEM_USER_EMAIL = 'system@local'

const DEV_USERS = [
  { id: 'dev-user-alice', name: 'Alice', email: 'alice@dev.local' },
  { id: 'dev-user-bob', name: 'Bob', email: 'bob@dev.local' },
  { id: 'dev-user-carol', name: 'Carol', email: 'carol@dev.local' },
]

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

  for (const u of DEV_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { id: u.id, name: u.name, email: u.email },
    })
  }

  const SAMPLE_REQUESTS = [
    { title: 'Deploy payment service v3.2', description: 'Critical payment gateway upgrade', category: 'P1', requesterId: 'dev-user-alice' },
    { title: 'Hotfix: auth token expiry bug', description: 'Tokens expiring 1h early in prod', category: 'P1', requesterId: 'dev-user-bob' },
    { title: 'Rotate production API keys', description: 'Scheduled quarterly key rotation', category: 'P2', requesterId: 'dev-user-carol' },
    { title: 'Enable feature flag: new dashboard', description: 'Roll out redesigned dashboard to 100%', category: 'P2', requesterId: 'dev-user-alice' },
    { title: 'Update Node.js to v22 LTS', description: 'Runtime upgrade across all services', category: 'P3', requesterId: 'dev-user-bob' },
    { title: 'Add Datadog APM integration', description: 'Observability improvements', category: 'P3', requesterId: 'dev-user-carol' },
    { title: 'Bump eslint to v9', description: 'Dev tooling upgrade', category: 'P4', requesterId: 'dev-user-alice' },
    { title: 'Archive old audit logs (>2y)', description: 'Storage cost reduction', category: 'P4', requesterId: 'dev-user-bob' },
  ]

  for (const req of SAMPLE_REQUESTS) {
    await prisma.approvalRequest.create({ data: req })
  }

  console.log('Seeded priority configs for P1-P4')
  console.log(`Seeded ${SAMPLE_REQUESTS.length} sample approval requests`)
  console.log('Dev users ready:')
  DEV_USERS.forEach((u) => console.log(`  ${u.name}: id=${u.id}  email=${u.email}`))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
