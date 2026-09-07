import type { OwnerInformation } from '@directus/types';
import type { TelemetryReport } from '../types/report.js';

export type OwnerReport = OwnerInformation & { project_id: string; version: string };

/**
 * UMA fork policy: outbound Directus telemetry and compliance reporting are intentionally disabled.
 */
export const sendReport = async (_report: TelemetryReport | OwnerReport): Promise<void> => {};
