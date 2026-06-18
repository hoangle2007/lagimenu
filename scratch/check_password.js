const bcrypt = require('bcryptjs');

const hash = '$2a$10$lws90nKHFw7srlZAP360se76yfxpNQHDBS7MqmrYOdS8Oyqd39L9q';
const candidates = [
  '123456',
  '123456789',
  '12345678',
  'Hoang2007',
  '5KE5Pg74XWCMT1hC',
  'L4g1M3nu_DB_2024!',
  'admin',
  'admin123',
  'kivomenu',
  'kivo_menu',
  'hoangle2007'
];

for (const c of candidates) {
  if (bcrypt.compareSync(c, hash)) {
    console.log(`Matched password: ${c}`);
    process.exit(0);
  }
}
console.log('No match found.');
