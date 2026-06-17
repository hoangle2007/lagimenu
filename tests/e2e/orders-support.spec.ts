/**
 * orders-support.spec.ts — Public guest orders + staff order pipeline
 *
 * Prerequisites: backend on port 3001, frontend on port 3000,
 * E2E_AUTO_APPROVE_MERCHANT=true on backend.
 */

import { test, expect } from '@playwright/test'
import { registerOwner, api, loginEmployee, type LoginResponse } from './helpers/auth'
import { uniqueEmail, uniqueName, uniquePin, uniqueShopName } from './helpers/data'

interface Fixture {
  owner: LoginResponse
  shopId: string
  employeePin: string
  employeeEmail: string
}

let fixture: Fixture

test.beforeAll(async () => {
  const ownerEmail = uniqueEmail('orders_owner')
  const ownerReg = await registerOwner({
    ownerName: uniqueName('Chủ'),
    email: ownerEmail,
    password: 'Test@1234',
    shopName: uniqueShopName(),
  })
  if (!('token' in ownerReg)) {
    throw new Error('Set E2E_AUTO_APPROVE_MERCHANT=true on the backend for orders-support tests.')
  }
  const owner = ownerReg
  const shopId = await getShopId(owner.token)

  const empPin = uniquePin()
  const empEmail = uniqueEmail('orders_emp')
  await api.post(
    '/api/employees',
    {
      name: uniqueName('NV'),
      email: empEmail,
      password: 'Emp@1234',
      pin: empPin,
    },
    owner.token,
  )

  fixture = { owner, shopId, employeePin: empPin, employeeEmail: empEmail }
})

test.describe('Orders pipeline (guest + staff)', () => {
  test('Guest can place an order via API (no JWT)', async () => {
    const res = await api.post<{ order: { id: number; status: string } }>('/api/orders', {
      shopId: fixture.shopId,
      tableNumber: 'Bàn 5',
      items: [
        { name: 'Cơm gà', qty: 2, price: 35000 },
        { name: 'Nước cam', qty: 1, price: 18000 },
      ],
      totalAmount: 88000,
    })

    expect(res.order.id).toBeTruthy()
    expect(res.order.status).toBe('pending')
  })

  test('Create order without shopId is rejected', async () => {
    try {
      await api.post('/api/orders', {
        tableNumber: 'Bàn 1',
        items: [{ name: 'Cơm', quantity: 1, price: 10000 }],
        totalAmount: 10000,
      })
      expect(true).toBe(false)
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      expect(e.status === 400 || e.status === 422 || /merchant|shop|required|validation/i.test(String(e.message))).toBe(
        true,
      )
    }
  })

  test('Owner can list orders for their shop', async () => {
    await api.post('/api/orders', {
      shopId: fixture.shopId,
      tableNumber: 'Bàn 10',
      items: [{ name: 'Phở', quantity: 1, price: 50000 }],
      totalAmount: 50000,
    })

    const data = await api.get<{ orders: Array<{ id: number; status: string }> }>(
      '/api/orders',
      fixture.owner.token,
    )

    expect(data.orders.length).toBeGreaterThan(0)
  })

  test('Employee can list orders for their shop', async () => {
    const emp = await loginEmployee({
      email: fixture.employeeEmail,
      pin: fixture.employeePin,
      shopId: fixture.shopId,
    })

    const data = await api.get<{ orders: Array<{ id: number }> }>('/api/orders', emp.token)

    expect(Array.isArray(data.orders)).toBe(true)
  })

  test('Employee can update order status PENDING → confirmed', async () => {
    const { order } = await api.post<{ order: { id: number } }>('/api/orders', {
      shopId: fixture.shopId,
      tableNumber: 'Bàn 7',
      items: [{ name: 'Bún bò', quantity: 1, price: 45000 }],
      totalAmount: 45000,
    })

    const emp = await loginEmployee({
      email: fixture.employeeEmail,
      pin: fixture.employeePin,
      shopId: fixture.shopId,
    })

    const { order: updated } = await api.put<{ order: { id: number; status: string } }>(
      `/api/orders/${order.id}/status`,
      { status: 'confirmed' },
      emp.token,
    )

    expect(updated.status).toBe('confirmed')
  })

  test('Employee can advance status confirmed → preparing → ready', async () => {
    const { order } = await api.post<{ order: { id: number } }>('/api/orders', {
      shopId: fixture.shopId,
      tableNumber: 'Bàn 8',
      items: [{ name: 'Bánh mì', quantity: 2, price: 15000 }],
      totalAmount: 30000,
    })

    const emp = await loginEmployee({
      email: fixture.employeeEmail,
      pin: fixture.employeePin,
      shopId: fixture.shopId,
    })

    await api.put(`/api/orders/${order.id}/status`, { status: 'confirmed' }, emp.token)

    const { order: preparing } = await api.put<{ order: { status: string } }>(
      `/api/orders/${order.id}/status`,
      { status: 'preparing' },
      emp.token,
    )
    expect(preparing.status).toBe('preparing')

    const { order: ready } = await api.put<{ order: { status: string } }>(
      `/api/orders/${order.id}/status`,
      { status: 'ready' },
      emp.token,
    )
    expect(ready.status).toBe('ready')
  })

  test('Unauthenticated caller cannot update order status', async () => {
    const { order } = await api.post<{ order: { id: number } }>('/api/orders', {
      shopId: fixture.shopId,
      tableNumber: 'Bàn 9',
      items: [{ name: 'Trà đá', quantity: 1, price: 5000 }],
      totalAmount: 5000,
    })

    try {
      await api.put(`/api/orders/${order.id}/status`, { status: 'confirmed' })
      expect(true).toBe(false)
    } catch (err: unknown) {
      const e = err as { status?: number }
      expect(e.status).toBe(401)
    }
  })
})

async function getShopId(token: string): Promise<string> {
  const data = await api.get<{ user?: { shop?: { id: string } }; shopId?: string }>('/api/auth/me', token)
  const id = data.user?.shop?.id ?? data.shopId ?? ''
  if (!id) throw new Error('orders-support: could not resolve shop id from /api/auth/me')
  return id
}
