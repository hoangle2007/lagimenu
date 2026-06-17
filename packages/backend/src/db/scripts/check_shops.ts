import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env'), override: true });
const sql = postgres(process.env.DATABASE_URL!);

async function check() {
  const shopCount = await sql`SELECT count(*) FROM "Shop"`;
  const merchantCount = await sql`SELECT count(*) FROM merchants`;
  console.log(
    `Shops: ${shopCount[0].count}, Merchants: ${merchantCount[0].count}`,
  );

  const shopsNotInMerchants = await sql`
    SELECT s.id, s.name, s.email 
    FROM "Shop" s
    LEFT JOIN merchants m ON s.id::text = m.id
    WHERE m.id IS NULL
  `;
  console.log('Shops missing in merchant table:', shopsNotInMerchants);

  await sql.end();
}
check();
