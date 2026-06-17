import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from packages/backend/.env
config({ path: resolve(__dirname, '../../../.env'), override: true });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in .env');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrate() {
  console.log('🚀 Starting Data Migration...');

  try {
    // 1. Normalize Order Statuses to lowercase
    console.log('📦 Normalizing order statuses...');
    await sql`
      UPDATE orders 
      SET status = LOWER(status) 
      WHERE status IS NOT NULL
    `;

    // 2. Set default Order Type if missing
    console.log('📦 Setting default order types...');
    await sql`
      UPDATE orders 
      SET type = 'order' 
      WHERE type IS NULL OR type = ''
    `;

    // 3. Ensure Merchants have slugs (important for employee login)
    console.log('📦 Generating missing merchant slugs...');
    const merchantsWithoutSlug = await sql`
      SELECT id, name FROM merchants WHERE slug IS NULL OR slug = ''
    `;

    for (const merchant of merchantsWithoutSlug) {
      const slug = merchant.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const finalSlug = `${slug}-${merchant.id.substring(0, 4)}`;

      console.log(`  - Setting slug for ${merchant.name}: ${finalSlug}`);
      await sql`
        UPDATE merchants 
        SET slug = ${finalSlug} 
        WHERE id = ${merchant.id}
      `;
    }

    // 4. Cleanup old temporary table sessions if any (optional)
    console.log('📦 Cleaning up active table sessions...');
    // No specific action needed here unless schema changed drastically

    // 5. Ensure Employee/User role alignment
    console.log('📦 Updating User roles...');
    await sql`
      UPDATE "User"
      SET role = 'EMPLOYEE'
      WHERE role IS NULL
    `;

    console.log('✅ Data migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await sql.end();
  }
}

migrate();
