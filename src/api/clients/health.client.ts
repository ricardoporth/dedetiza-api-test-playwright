import { BaseClient } from '../base.client';

type DependencyStatus = Record<string, { status: string; message?: string }>;

export interface HealthData {
  status: 'ok' | 'error';
  info: DependencyStatus | null;
  error: DependencyStatus | null;
  details: DependencyStatus;
}

export class HealthClient extends BaseClient {
  check() {
    return this.get<HealthData>('health');
  }
}
