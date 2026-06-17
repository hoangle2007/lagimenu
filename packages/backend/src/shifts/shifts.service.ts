import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { shifts } from '../db/schema';
import type { CreateShiftDto, UpdateShiftDto } from './shifts.dto';

export interface ShiftRow {
  id: number;
  merchantId: string;
  employeeId: string;
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'active' | 'completed';
  createdAt: Date;
}

@Injectable()
export class ShiftsService {
  async listByEmployee(employeeId: string) {
    return db.select().from(shifts).where(eq(shifts.employeeId, employeeId));
  }

  async create(merchantId: string, data: CreateShiftDto) {
    const [shift] = await db
      .insert(shifts)
      .values({
        merchantId,
        employeeId: data.employeeId,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      })
      .returning();
    return shift;
  }

  async update(id: number, data: UpdateShiftDto) {
    const numericId = Number(id);
    const [existing] = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, numericId));
    if (!existing) {
      throw new NotFoundException('Shift not found');
    }

    const updateData: Partial<{
      startTime: Date;
      endTime: Date;
      status: string;
    }> = {};

    if (data.startTime !== undefined) {
      updateData.startTime = new Date(data.startTime);
    }
    if (data.endTime !== undefined) {
      updateData.endTime = new Date(data.endTime);
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    const [shift] = await db
      .update(shifts)
      .set(updateData)
      .where(eq(shifts.id, numericId))
      .returning();
    return shift;
  }

  async delete(id: number) {
    const numericId = Number(id);
    const [existing] = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, numericId));
    if (!existing) {
      throw new NotFoundException('Shift not found');
    }
    await db.delete(shifts).where(eq(shifts.id, numericId));
    return { success: true, id: numericId };
  }
}
