import { Module } from '@nestjs/common';

/**
 * DbModule — minimal marker module.
 * The raw postgres client (`sql`) and Drizzle ORM (`db`) are exported
 * directly from `db/index.ts` and imported wherever needed.
 *
 * The Drizzle token `DRIZZLE` provider was removed because:
 * 1. No service in the codebase injects it via `@Inject(DRIZZLE)`
 * 2. All services use the raw `sql` tagged template from `db/index.ts`
 * 3. The same Drizzle instance is already instantiated in `db/index.ts`
 *
 * If you migrate services to use the Drizzle query builder in future,
 * re-import `db` from `db/index.ts` directly in those services.
 */
@Module({})
export class DbModule {}
