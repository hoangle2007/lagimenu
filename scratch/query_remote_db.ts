import postgres from 'postgres';

async function main() {
  const url = 'postgresql://tsh_db:Tsh123qwe@14.225.254.130:5434/kivomenu';
  const sql = postgres(url);
  try {
    const res = await sql`SELECT id, name, email, slug, account_status FROM merchants ORDER BY created_at DESC LIMIT 5`;
    console.log('Merchants in Remote DB:', res);
  } catch (e) {
    console.error('Remote DB Error:', e);
  } finally {
    await sql.end();
  }
}

main();
