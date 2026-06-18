/**
 * auth.spec.ts — Authentication flows
 *
 * Set E2E_AUTO_APPROVE_MERCHANT=true on backend for tests that need an approved owner token.
 */

import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { EmployeeLoginPage } from './pages/EmployeeLoginPage'
import { registerOwner, api } from './helpers/auth'
import { uniqueEmail, uniqueName, uniqueShopName } from './helpers/data'

test.describe('Authentication', () => {
  test('Owner can register (pending approval UI)', async ({ page }) => {
    const registerPage = new RegisterPage(page)
    await registerPage.goto()
    await registerPage.registerAsOwner({
      ownerName: uniqueName('Chủ'),
      email: uniqueEmail('owner'),
      password: 'Test@1234',
      shopName: uniqueShopName(),
    })
    await page.waitForURL(/\/merchant/, { timeout: 15_000 })
    const path = new URL(page.url()).pathname
    if (path.includes('/merchant/pending')) {
      await registerPage.expectPendingUi()
    } else {
      await expect(page).toHaveURL(/\/merchant\/?(\?.*)?$/, { timeout: 5_000 })
    }
  })

  test('Registration shows error when email already exists', async ({ page }) => {
    const registerPage = new RegisterPage(page)
    const email = uniqueEmail('dup')
    const shop = uniqueShopName()

    await registerOwner({
      ownerName: uniqueName('Dup'),
      email,
      password: 'Test@1234',
      shopName: shop,
    })

    await registerPage.goto()
    await registerPage.registerAsOwner({
      ownerName: uniqueName('Dup2'),
      email,
      password: 'Test@1234',
      shopName: uniqueShopName(),
    })

    await registerPage.expectError()
  })

  test('Registration validation keeps user on /register', async ({ page }) => {
    const registerPage = new RegisterPage(page)
    await registerPage.goto()
    await registerPage.fillShopName('')
    await registerPage.fillOwnerName('')
    await registerPage.fillEmail('notanemail')
    await registerPage.fillPassword('123')
    await registerPage.submit()
    await expect(page).toHaveURL(/\/register/)
  })

  test('Owner can login and reach merchant dashboard', async ({ page }) => {
    const email = uniqueEmail('owner2')
    const reg = await registerOwner({
      ownerName: uniqueName('Chủ'),
      email,
      password: 'Test@1234',
      shopName: uniqueShopName(),
    })
    if (!('token' in reg)) {
      test.skip(true, 'Set E2E_AUTO_APPROVE_MERCHANT=true on backend for this test')
    }

    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(email, 'Test@1234')

    await expect(page).toHaveURL(/\/merchant/, { timeout: 10_000 })
  })

  test('Login shows error with wrong password', async ({ page }) => {
    const email = uniqueEmail('wrongpw')
    const reg = await registerOwner({
      ownerName: uniqueName('Sai MK'),
      email,
      password: 'Test@1234',
      shopName: uniqueShopName(),
    })
    if (!('token' in reg)) {
      test.skip(true, 'Set E2E_AUTO_APPROVE_MERCHANT=true on backend for this test')
    }

    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login(email, 'WrongPassword')

    await loginPage.expectError()
    await expect(page).toHaveURL(/\/login/)
  })

  test('Login shows error with non-existent email', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('nobody@kivo.test', 'anypassword')

    await loginPage.expectError()
  })

  test('Link to employee login navigates to /employee-login', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.clickEmployeeLogin()

    await expect(page).toHaveURL(/\/employee-login/)
  })

  test('Link to register navigates to /register', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.clickRegister()

    await expect(page).toHaveURL(/\/register/)
  })

  test('Employee can login with PIN and is redirected to /employee/dashboard', async ({ page }) => {
    const ownerEmail = uniqueEmail('emp_owner')
    const reg = await registerOwner({
      ownerName: uniqueName('Chủ NV'),
      email: ownerEmail,
      password: 'Test@1234',
      shopName: uniqueShopName(),
    })
    if (!('token' in reg)) {
      test.skip(true, 'Set E2E_AUTO_APPROVE_MERCHANT=true on backend for this test')
    }
    const ownerToken = reg.token

    const empPin = '1234'
    const empEmail = uniqueEmail('emp_pin')
    await api.post(
      '/api/employees',
      {
        name: uniqueName('NV'),
        email: empEmail,
        password: 'Emp@1234',
        pin: empPin,
      },
      ownerToken,
    )

    const empLoginPage = new EmployeeLoginPage(page)
    await empLoginPage.goto()
    await empLoginPage.login(empEmail, empPin)

    await empLoginPage.expectRedirectToEmployeeDashboard()
  })

  test('Employee PIN login shows error with wrong PIN', async ({ page }) => {
    const empLoginPage = new EmployeeLoginPage(page)
    await empLoginPage.goto()
    await empLoginPage.login('wrong@kivo.test', '9999')

    await empLoginPage.expectError()
  })

  test('Unauthenticated user is redirected when accessing /merchant', async ({ page }) => {
    await page.goto('/merchant')
    await expect(page).toHaveURL(/\/(login|employee-login)/, { timeout: 5000 })
  })
})
