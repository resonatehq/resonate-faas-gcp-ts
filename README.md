# @resonatehq/gcp

`@resonatehq/gcp` is the official binding to deploy Distributed Async Await, Resonate's durable execution framework, to [Google Cloud Functions](https://cloud.google.com/functions). Run long-running, stateful applications on short-lived, stateless infrastructure.

**Examples:**

- [Durable Countdown]()
- [Durable, Recursive Research Agent]()

## Architecture

When the Durable Function awaits a pending Durable Promise (for example on `yield* context.rpc()` or `context.sleep`), the Google Function **terminates**. When the Durable Promise completes, the Resonate Server resumes the Durable Function by invoking the Google Function again.


```ts
function* factorial(context: Context, n: number): Generator {
  if (n <= 0)  { 
    return 1;
  }
  else {
    return n * (yield* context.rpc(factorial, n - 1));
  }
}
```

Illustration of executing `factorial(2)` on Google Cloud Functions:

![Resonate on Serverless](./public/resonate.svg)

## Quick Start

### 1. Install

```bash
npm install @resonatehq/gcp
```

### 2. Example: Factorial

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

### 3. Deploy to GCP

Deploy your function using Google Cloud Functions or Cloud Run:

```bash
gcloud functions deploy factorial \
  --runtime=nodejs22 \
  --entry-point=handler \
  --trigger-http \
  --allow-unauthenticated
```

---

### 4. Invoke via CLI

Once deployed, you can trigger workflows using the [Resonate CLI](https://github.com/resonatehq/cli):

```bash
resonate invoke \
  --func factorial \
  --arg 10 \
  --server https://<resonate-server-url>.com \
  --target https://<url-for-your-gcp-function>.com
```

Expected output:

```
3628800
```
