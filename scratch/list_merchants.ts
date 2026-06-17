import postgres from 'postgres';
import 'dotenv/config';

async function check() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const rows = await sql`SELECT id, name, slug FROM merchants LIMIT 10`;
    console.log('Available Merchants:');
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
check();
