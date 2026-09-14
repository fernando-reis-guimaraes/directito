/**
 * UMA fork policy: telemetry collection and outbound reporting are intentionally disabled.
 *
 * @returns Always false because tracking is never performed
 */
export const track = async (_opts = { wait: true }): Promise<boolean> => {
	return false;
};
