import { expect, test as base } from "@playwright/test";

const test = base;

test.beforeAll(async ({ request }) => {
	const deadline = Date.now() + 30_000;

	while (Date.now() < deadline) {
		try {
			const response = await request.get("http://127.0.0.1:4000/api/health");
			if (response.status() === 200) {
				return;
			}
		} catch {
			// Service not reachable yet.
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	throw new Error("Backend readiness check failed: /api/health did not return 200 within 30s");
});

export { test, expect };
