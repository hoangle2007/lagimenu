import postgres from 'postgres';
import 'dotenv/config';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const merchants = await sql`SELECT COUNT(*)::int AS count FROM merchants`;
    const users = await sql`SELECT COUNT(*)::int AS count FROM "User"`;
    const categories = await sql`SELECT COUNT(*)::int AS count FROM categories`;
    const products = await sql`SELECT COUNT(*)::int AS count FROM products`;
    const employees = await sql`SELECT COUNT(*)::int AS count FROM "Employee"`;
    const orders = await sql`SELECT COUNT(*)::int AS count FROM orders`;
    console.log({
      merchants: merchants[0].count,
      users: users[0].count,
      categories: categories[0].count,
      products: products[0].count,
      employees: employees[0].count,
      orders: orders[0].count,
    });
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

main();
