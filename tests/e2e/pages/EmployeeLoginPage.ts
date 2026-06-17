/**
 * EmployeeLoginPage — page object for /employee-login
 *
 * Form: email + PIN (4 digits); optional shop context via route slug.
 */

import { type Page, expect } from '@playwright/test'

export class EmployeeLoginPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto() {
    await this.page.goto('/employee-login')
  }

  async fillEmail(email: string) {
    await this.page.locator('#email').fill(email)
  }

  async fillPin(pin: string) {
    await this.page.locator('#pin').fill(pin)
  }

  async submit() {
    await this.page.locator('button[type="submit"]').click()
  }

  async login(email: string, pin: string) {
    await this.fillEmail(email)
    await this.fillPin(pin)
    await this.submit()
  }

  async expectError(message?: string) {
    const errorEl = this.page.locator('.text-red-600').filter({ hasNotText: '' })
    if (message) {
      await expect(errorEl.first()).toContainText(message)
    } else {
      await expect(errorEl.first()).toBeVisible()
    }
  }

  async expectRedirectToEmployeeDashboard() {
    await expect(this.page).toHaveURL(/\/employee\/dashboard/)
  }
}
