# @resonatehq/gcp

Resonate empowering serverless and event-driven architectures written as procedural code.

```ts
import { type Context, Resonate } from "@resonatehq/gcp";

const resonate = new Resonate();

function* factorial(ctx: Context, n: number): Generator<any, number, any> {
	if (n <= 1) {
		return 1;
	}
	return n * (yield ctx.rpc("factorial", n - 1));
}

resonate.register(factorial);

export const handler = resonate.handlerHttp();
```

```bash
resonate invoke --func factorial --arg 10 --target https://<url-for-your-gcp-function>.com
```
