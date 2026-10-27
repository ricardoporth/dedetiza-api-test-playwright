import type { HealthData } from '@schemas/health.schema';
import { BaseClient } from '../base.client';

export type { HealthData };

export class HealthClient extends BaseClient {
  check() {
    return this.get<HealthData>('health');
  }
}
