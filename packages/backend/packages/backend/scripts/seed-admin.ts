import { postgres } from 'postgres';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function seed() {
  console.log('Seeding super admin...');
  const email = 'superadmin@lagimenu.com';
  const password = 'Admin123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const [existing] = await sql`SELECT id FROM merchants WHERE email = ${email}`;
    
    if (existing) {
      console.log('Admin already exists in merchants table. Updating password and role...');
      await sql`
        UPDATE merchants 
        SET password = ${hashedPassword}, role = 'super_admin' 
        WHERE email = ${email}
      `;
    } else {
      console.log('Creating new super admin in merchants table...');
      await sql`
        INSERT INTO merchants (id, email, password, name, role, slug)
        VALUES (${uuidv4()}, ${email}, ${hashedPassword}, 'Global Super Admin', 'super_admin', 'superadmin')
      `;
    }
    console.log('Seed completed successfully.');
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    await sql.end();
  }
}

seed();
