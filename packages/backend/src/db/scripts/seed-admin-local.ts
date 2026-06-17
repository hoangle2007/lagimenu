/**
 * One-off / dev: platform admin row in `merchants` (auth uses email + bcrypt password).
 * Run: npx tsx src/db/scripts/seed-admin-local.ts
 */
import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

config({ path: resolve(__dirname, '../../../.env'), override: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function main() {
  const email = 'admin';
  const plainPassword = 'admin';
  const hash = await bcrypt.hash(plainPassword, 10);

  const [existing] = await sql`SELECT id FROM merchants WHERE email = ${email}`;

  if (existing) {
    await sql`
      UPDATE merchants
      SET password = ${hash},
          role = 'super_admin',
          account_status = 'approved',
          name = COALESCE(NULLIF(trim(name), ''), 'System Admin')
      WHERE email = ${email}
    `;
    console.log('Updated existing admin row (email: admin).');
  } else {
    const id = randomUUID();
    await sql`
      INSERT INTO merchants (
        id, email, password, name, slug, role, account_status
      ) VALUES (
        ${id},
        ${email},
        ${hash},
        'System Admin',
        ${'admin-' + id.slice(0, 8)},
        'super_admin',
        'approved'
      )
    `;
    console.log('Inserted admin row (email: admin, password: admin).');
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
