/**
 * UMA fork policy: telemetry scheduling is intentionally disabled.
 *
 * @returns Always false because telemetry is never initialized
 */
export default async function schedule(): Promise<boolean> {
	return false;
}
