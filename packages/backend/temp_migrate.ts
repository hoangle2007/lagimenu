import { sql } from './src/db/index';

async function migrate() {
  try {
    const merchants = await sql`SELECT * FROM merchants`;
    console.log(`Found ${merchants.length} merchants to migrate.`);
    for (const m of merchants) {
       const u = await sql`SELECT id FROM "User" WHERE email = ${m.email}`;
       if (u.length === 0) {
          await sql`INSERT INTO "User" (id, email, name, "passwordHash", role, "updatedAt") VALUES (${m.id}, ${m.email}, ${m.name}, ${m.password}, 'OWNER', now())`;
          console.log(`Created User for ${m.email}`);
       }
       const s = await sql`SELECT id FROM "Shop" WHERE "ownerId" = ${m.id}`;
       if (s.length === 0) {
          await sql`INSERT INTO "Shop" (id, name, "ownerId") VALUES (gen_random_uuid(), ${m.name}, ${m.id})`;
          console.log(`Created Shop for ${m.email}`);
       }
    }
    console.log("Migration complete!");
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
migrate();
