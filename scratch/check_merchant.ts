import { merchants } from './packages/backend/src/db/schema';
import postgres from 'postgres';
import 'dotenv/config';

async function check() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const rows = await sql`SELECT id, name, slug FROM merchants WHERE id::text = '841840a4-5bbb-45ba-a9a8-ee9635bbc0f9' OR slug = '841840a4-5bbb-45ba-a9a8-ee9635bbc0f9'`;
    console.log(JSON.stringify(rows));
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
check();
