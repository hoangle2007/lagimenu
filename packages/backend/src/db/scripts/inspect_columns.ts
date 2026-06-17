import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env'), override: true });
const sql = postgres(process.env.DATABASE_URL!);

async function run() {
  const shopColumns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Shop'
  `;
  console.log('Shop Columns:', shopColumns);

  const merchantColumns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'merchants'
  `;
  console.log('Merchant Columns:', merchantColumns);

  await sql.end();
}
run();
