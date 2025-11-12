import type {
	HttpFunction,
	Request,
	Response,
} from "@google-cloud/functions-framework";
import {
	type Func,
	Handler,
	HttpNetwork,
	JsonEncoder,
	NoopHeartbeat,
	Registry,
	ResonateInner,
	type Task,
	WallClock,
} from "@resonatehq/sdk";
import {
	type Encryptor,
	NoopEncryptor,
} from "@resonatehq/sdk/dist/src/encryptor";
import { Buffer } from "node:buffer";

export class Resonate {
	private registry = new Registry();
	private verbose: boolean;
	private encryptor: Encryptor;

	constructor({
		verbose = false,
		encryptor = undefined,
	}: { verbose?: boolean; encryptor?: Encryptor } = {}) {
		this.verbose = verbose;
		this.encryptor = encryptor ?? new NoopEncryptor();
	}
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
				const username = process.env.RESONATE_USERNAME;
				const password = process.env.RESONATE_PASSWORD;
				const basicAuthHeader =
					username && password
						? `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`
						: undefined;
				const network = new HttpNetwork({
					headers: basicAuthHeader ? { Authorization: basicAuthHeader } : {},
					timeout: 60 * 1000, // 60s
					url: body.href.base,
					verbose: this.verbose,
				});

				const resonateInner = new ResonateInner({
					anycastNoPreference: url,
					anycastPreference: url,
					clock: new WallClock(),
					dependencies: new Map(),
					handler: new Handler(network, encoder, this.encryptor),
					heartbeat: new NoopHeartbeat(),
					network,
					pid: `pid-${Math.random().toString(36).substring(7)}`,
					registry: this.registry,
					ttl: 30 * 1000, // 30s
					unicast: url,
					verbose: this.verbose,
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
