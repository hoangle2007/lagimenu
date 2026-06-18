/**
 * LoginPage — page object for /login
 *
 * Key elements:
 *  - email input  → #email or input[type=email]
 *  - password input → #password or input[type=password]
 *  - submit button  → button[type=submit] (contains "Đăng nhập")
 *  - error message  → [role=alert] inside form (red box)
 *  - register link  → a[href="/register"]
 *  - employee login link → a[href="/employee-login"]
 */

import { type Page, expect } from '@playwright/test'

export class LoginPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto() {
    await this.page.goto('/login')
  }

  async fillEmail(email: string) {
    await this.page.locator('input[type="email"]').fill(email)
  }

  async fillPassword(password: string) {
    await this.page.locator('input[type="password"]').fill(password)
  }

  async submit() {
    await this.page.locator('button[type="submit"]').click()
  }

  async login(email: string, password: string) {
    await this.fillEmail(email)
    await this.fillPassword(password)
    await this.submit()
  }

  async expectError(message?: string) {
    const errorEl = this.page.locator('[role="alert"]')
    if (message) {
      await expect(errorEl).toContainText(message)
    } else {
      await expect(errorEl).toBeVisible()
    }
  }

  async expectNoError() {
    await expect(this.page.locator('[role="alert"]')).toBeHidden()
  }

  async expectTitle() {
    await expect(this.page.locator('h1')).toContainText('Kivo Menu')
  }

  async clickEmployeeLogin() {
    await this.page.locator('a[href="/employee-login"]').click()
  }

  async clickRegister() {
    await this.page.locator('a[href="/register"]').click()
  }

  async expectRedirectTo(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path))
  }
}