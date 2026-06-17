/**
 * RegisterPage — page object for /register (đăng ký mở quán)
 */

import { type Page, expect } from '@playwright/test'

export class RegisterPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto() {
    await this.page.goto('/register')
  }

  async fillShopName(name: string) {
    await this.page.locator('input[autocomplete="organization"]').fill(name)
  }

  async fillOwnerName(name: string) {
    await this.page.locator('input[autocomplete="name"]').fill(name)
  }

  async fillEmail(email: string) {
    await this.page.locator('input[type="email"]').fill(email)
  }

  async fillPhone(phone: string) {
    await this.page.locator('input[type="tel"]').fill(phone)
  }

  /** Fills both password fields */
  async fillPassword(password: string) {
    const pwInputs = this.page.locator('input[type="password"]')
    await pwInputs.nth(0).fill(password)
    await pwInputs.nth(1).fill(password)
  }

  async submit() {
    await this.page.locator('button[type="submit"]').click()
  }

  async registerAsOwner(opts: {
    ownerName: string
    email: string
    password: string
    shopName: string
    phone?: string
  }) {
    await this.fillShopName(opts.shopName)
    await this.fillOwnerName(opts.ownerName)
    await this.fillEmail(opts.email)
    if (opts.phone) await this.fillPhone(opts.phone)
    await this.fillPassword(opts.password)
    await this.submit()
  }

  async expectError(message?: string) {
    const errorEl = this.page.locator('text=/Đăng ký thất bại|Email already|already registered/i')
    if (message) {
      await expect(errorEl).toContainText(message)
    } else {
      await expect(errorEl.first()).toBeVisible()
    }
  }

  /** After register with pending account */
  async expectPendingUi() {
    await expect(this.page.getByText(/chờ duyệt|đang chờ/i).first()).toBeVisible({ timeout: 10_000 })
  }

  async clickLogin() {
    await this.page.locator('a[href="/login"]').click()
  }
}
