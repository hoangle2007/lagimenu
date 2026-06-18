const { chromium } = require('@playwright/test');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to network requests & responses
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log(`>> Request: ${request.method()} ${request.url()}`);
      const postData = request.postData();
      if (postData) {
        console.log(`   Body: ${postData}`);
      }
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      console.log(`<< Response: ${response.status()} ${response.url()}`);
      try {
        const text = await response.text();
        console.log(`   Response Body: ${text}`);
      } catch (e) {
        console.log(`   Failed to read response body: ${e.message}`);
      }
    }
  });

  // Listen to page errors & console logs
  page.on('pageerror', err => {
    console.error(`Page error: ${err.message}`);
  });
  page.on('console', msg => {
    console.log(`Console [${msg.type()}]: ${msg.text()}`);
  });

  try {
    console.log('Navigating to login page...');
    await page.goto('https://kivoviet.com/login');

    // Bypass audio modal
    await page.evaluate(() => {
      localStorage.setItem('audio_unlocked', 'true');
    });

    console.log('Filling in login credentials...');
    await page.fill('input[type="email"], input[placeholder*="email" i], input[name="email"]', 'test@gmail.com');
    await page.fill('input[type="password"], input[placeholder*="mật khẩu" i], input[name="password"]', '123456');

    console.log('Clicking login button...');
    await page.click('button[type="submit"], button:has-text("Đăng nhập")');

    console.log('Waiting for navigation/dashboard...');
    await page.waitForURL('**/merchant**', { timeout: 15000 });
    console.log('Logged in successfully!');

    // Wait a bit
    await page.waitForTimeout(2000);

    console.log('Clicking Cài đặt tab...');
    await page.click('button:has-text("Cài đặt")');
    await page.waitForTimeout(1000);

    console.log('Clicking Quản lý thực đơn sub-tab...');
    await page.click('button:has-text("Thực đơn")');
    await page.waitForTimeout(1000);

    console.log('Clicking Thêm danh mục...');
    await page.click('button:has-text("Danh mục")');
    await page.waitForTimeout(1000);

    console.log('Filling category name...');
    const input = page.locator('div[role="dialog"] input, input[placeholder*="Tên danh mục" i]');
    await input.fill('Món Mới Playwright');

    console.log('Saving category...');
    await page.click('div[role="dialog"] button:has-text("Tạo danh mục")');
    
    // Wait for response to print
    await page.waitForTimeout(4000);

    console.log('Done!');
  } catch (err) {
    console.error('An error occurred during Playwright execution:', err);
    await page.screenshot({ path: 'scratch/error_screenshot.png' });
    console.log('Screenshot saved to scratch/error_screenshot.png');
  } finally {
    await browser.close();
  }
})();
