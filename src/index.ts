import type {
	HttpFunction,
	Request,
	Response,
} from "@google-cloud/functions-framework";

import { Context } from "@resonatehq/sdk";
import { WallClock } from "@resonatehq/sdk/dist/src/clock";
import { HttpNetwork } from "@resonatehq/sdk/dist/src/core";
import { JsonEncoder } from "@resonatehq/sdk/dist/src/encoder";
import { Handler } from "@resonatehq/sdk/dist/src/handler";
import { NoopHeartbeat } from "@resonatehq/sdk/dist/src/heartbeat";
import { Registry } from "@resonatehq/sdk/dist/src/registry";
import {
	ResonateInner,
	type Task,
} from "@resonatehq/sdk/dist/src/resonate-inner";
import type { Func } from "@resonatehq/sdk/dist/src/types";

export { Context };

export class Resonate {
	private registry = new Registry();

	public register<F extends Func>(
		name: string,
		func: F,
		options?: {
			version?: number;
		},
	): void;
	public register<F extends Func>(
		func: F,
		options?: {
			version?: number;
		},
	): void;
	public register<F extends Func>(
		nameOrFunc: string | F,
		funcOrOptions?:
			| F
			| {
					version?: number;
			  },
		maybeOptions: {
			version?: number;
		} = {},
	): void {
		const { version = 1 } =
			(typeof funcOrOptions === "object" ? funcOrOptions : maybeOptions) ?? {};
		const func =
			typeof nameOrFunc === "function" ? nameOrFunc : (funcOrOptions as F);
		const name = typeof nameOrFunc === "string" ? nameOrFunc : func.name;

		this.registry.add(func, name, version);
	}

	public handlerHttp(): HttpFunction {
		return async (req: Request, res: Response) => {
			try {
				if (req.method !== "POST") {
					return res
						.status(405)
						.json({ error: "Method not allowed. Use POST." });
				}

				const proto = req.get("x-forwarded-proto") || req.protocol;
				const host = req.get("host");

				if (!proto || !host) {
					return res.status(400).json({
						error: "Missing required headers: x-forwarded-proto or host.",
					});
				}

				const url = `${proto}://${host}${req.originalUrl || ""}`;

				if (!req.body) {
					return res.status(400).json({ error: "Request body missing." });
				}

				const body = req.body;

				if (
					!body ||
					!(body.type === "invoke" || body.type === "resume") ||
					!body.task
				) {
					return res.status(400).json({
						error:
							'Request body must contain "type" and "task" for Resonate invocation.',
					});
				}

				const encoder = new JsonEncoder();
				const network = new HttpNetwork({
					url: body.href.base,
					timeout: 60 * 1000, // 60s
					headers: {},
				});

				const resonateInner = new ResonateInner({
					unicast: url,
					anycastPreference: url,
					anycastNoPreference: url,
					pid: `pid-${Math.random().toString(36).substring(7)}`,
					ttl: 30 * 1000, // 30s
					clock: new WallClock(),
					network,
					handler: new Handler(network, encoder),
					registry: this.registry,
					heartbeat: new NoopHeartbeat(),
					dependencies: new Map(),
				});

				const task: Task = { kind: "unclaimed", task: body.task };

				resonateInner.process(task, (error, status) => {
					if (error || !status) {
						return res.status(500).json({
							error: "Task processing failed",
							details: { error, status },
						});
					}

					if (status.kind === "completed") {
						return res.status(200).json({
							status: "completed",
							result: status.promise.value,
							requestUrl: url,
						});
					}
					return res.status(200).json({
						status: "suspended",
						requestUrl: url,
					});
				});
			} catch (error) {
				return res.status(500).json({
					error: `Handler failed: ${error}`,
				});
			}
		};
	}
}
