import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

config({ path: resolve(__dirname, '../../../.env'), override: true });
const sql = postgres(process.env.DATABASE_URL!);

async function run() {
  console.log('🚀 Starting Legacy Shop to Merchant Migration...');

  try {
    // 1. Get all legacy shops and their owners
    const legacyShops = await sql`
      SELECT 
        s.id as shop_id, s.name as shop_name, s.address, s.slug,
        u.email, u."passwordHash", u.name as owner_name, u.id as owner_id
      FROM "Shop" s
      JOIN "User" u ON s."ownerId" = u.id
    `;

    console.log(`📊 Found ${legacyShops.length} legacy shops.`);

    for (const shop of legacyShops) {
      // Check if merchant already exists (by email or ID)
      const existing = await sql`
        SELECT id FROM merchants WHERE email = ${shop.email} OR id::text = ${shop.shop_id}
      `;

      if (existing.length > 0) {
        console.log(`  - ⏩ Skipping ${shop.shop_name} (Already exists)`);
        continue;
      }

      console.log(`  - ➕ Creating merchant for ${shop.shop_name}...`);

      const merchantId = shop.shop_id || uuidv4();

      try {
        await sql`
          INSERT INTO merchants (
            id, email, password, name, address, slug, 
            role, is_open, auto_accept, notify_sound, table_count, qr_secret
          ) VALUES (
            ${merchantId}, 
            ${shop.email}, 
            ${shop.passwordHash || 'no-password'}, 
            ${shop.shop_name}, 
            ${shop.address || ''}, 
            ${shop.slug || 'shop-' + merchantId.substring(0, 4)},
            'merchant', true, true, true, 10, 'comviet_secret'
          )
        `;
        console.log(`  - ✅ Successfully created merchant: ${shop.shop_name}`);
      } catch (err) {
        console.error(
          `  - ❌ Failed to create merchant ${shop.shop_name}:`,
          (err as Error).message,
        );
      }
    }

    console.log('🏁 Migration completed.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await sql.end();
  }
}

run();
