import { expect, test as base } from "@playwright/test";

const useExternalStack = process.env.E2E_USE_EXTERNAL_STACK === "true";
const healthUrl = useExternalStack
	? "https://api.tradereplay.me/api/health"
	: "http://127.0.0.1:4000/api/health";

const test = base;

test.beforeAll(async ({ request }) => {
	const deadline = Date.now() + 30_000;

	while (Date.now() < deadline) {
		try {
			const response = await request.get(healthUrl);
			if (response.status() === 200) {
				return;
			}
		} catch {
			// Service not reachable yet.
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error(`Backend readiness check failed: ${healthUrl} did not return 200 within 30s`);
});

export { test, expect };
