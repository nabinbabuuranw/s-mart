const { execSync } = require('child_process'); const path = require('path');
module.exports = async () => {
  require('./env.js');
  const root = path.resolve(__dirname, '../../..');
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate --schema prisma/schema.prisma', { cwd: root, env: process.env, stdio: 'pipe' });
  const { PrismaClient } = require('@prisma/client'); const { ROLE_DEFINITIONS, SETTING_DEFAULTS } = require('@smart/shared');
  const p = new PrismaClient();
  for (const [name, d] of Object.entries(ROLE_DEFINITIONS)) await p.role.create({ data: { name, label: d.label, isStaff: d.isStaff, system: true, permissions: d.permissions } });
  for (const [key, d] of Object.entries(SETTING_DEFAULTS)) await p.setting.create({ data: { key, value: d.value, isPublic: d.isPublic } });
  await p.$disconnect();
};
