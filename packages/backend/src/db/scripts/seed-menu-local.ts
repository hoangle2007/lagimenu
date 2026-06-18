import { sql } from '../index';

async function main() {
  const merchantId = '80a93a12-4d5c-4b2a-91ba-c06419f79740'; // Goku Test
  
  // Clean up existing products and categories first
  await sql`DELETE FROM products WHERE merchant_id = ${merchantId};`;
  await sql`DELETE FROM categories WHERE merchant_id = ${merchantId};`;

  // Insert category
  const [cat] = await sql`
    INSERT INTO categories (merchant_id, name, "order") 
    VALUES (${merchantId}, 'Món ăn nổi bật', 1) 
    RETURNING id;
  `;
  
  const categoryId = cat?.id;
  
  if (categoryId) {
    // Insert products
    await sql`
      INSERT INTO products (merchant_id, category_id, name, description, price, is_featured, is_available)
      VALUES 
        (${merchantId}, ${categoryId}, 'Cơm chiên Dương Châu', 'Cơm chiên thơm ngon kèm lạp xưởng, trứng, rau củ.', '55000', true, true),
        (${merchantId}, ${categoryId}, 'Mì xào hải sản', 'Mì xào giòn dai kèm tôm, mực và rau cải.', '65000', true, true),
        (${merchantId}, ${categoryId}, 'Trà sữa Kivo', 'Trà sữa truyền thống đậm vị trà thơm vị sữa.', '30000', true, true);
    `;
    console.log('Successfully seeded categories and products for local dev.');
  } else {
    console.error('Failed to create category');
  }
  
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
