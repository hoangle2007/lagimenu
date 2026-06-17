import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env'), override: true });
const sql = postgres(process.env.DATABASE_URL!);

async function check() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
  console.log(
    'Tables:',
    tables.map((t) => t.table_name),
  );
  await sql.end();
}
check();
