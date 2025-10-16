# @resonatehq/gcp

**Resonate** — empowering **serverless** and **event-driven** architectures written as **procedural code**.

This package enables **Google Cloud Platform (GCP)** developers to build resilient, event-driven workflows using plain JavaScript or TypeScript — powered by the **Resonate Server**, which orchestrates execution, state, and communication across functions.

---

## ✨ Features

- 🧠 **Procedural orchestration** — write workflows as generator functions.
- ☁️ **Serverless-native** — deploy to Cloud Functions or Cloud Run.
- 🔁 **Durable execution** — Resonate Server manages state, retries, and continuation.
- 📡 **RPC between workflows** — simple function-to-function calls over HTTP.

---

## 🏗️ Architecture

Resonate applications are split into **two components**:

1. **Resonate Server** – coordinates execution, maintains workflow state, and handles retries.
2. **Function Workers** – your cloud functions (like GCP Cloud Functions) that perform the actual logic.

The GCP SDK (`@resonatehq/gcp`) connects these workers to the Resonate Server, enabling distributed orchestration without needing a centralized monolith.

```text
+-----------------+        +-------------------------+
|   GCP Function  |  --->  |  Resonate Server (Core) |
|  (factorial)    | <---   |  State + Coordination   |
+-----------------+        +-------------------------+
```

---

## 🚀 Quick Start

### 1. Install

```bash
npm install @resonatehq/gcp
```

---

### 2. Example: Recursive Workflow

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

---

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
  --server https://<resonate-server-url>.com
  --func factorial \
  --arg 10 \
  --target https://<url-for-your-gcp-function>.com
```

Expected output:

```
3628800
```

---

## 🧠 How It Works

Resonate uses **generator functions** to represent workflows.
Each `yield` is a checkpoint: Resonate persists the state via the **Resonate Server** and resumes execution when the dependency (RPC, event, etc.) completes.

**Key Concepts:**

| Concept                      | Description                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`Context`**                | The execution context for a workflow.                                                |
| **`ctx.rpc()`**              | Invokes another registered workflow _remotely_ (via HTTP). The current function suspends and exits; Resonate resumes execution once the remote workflow completes. |
| **`ctx.run()`**              | Executes another function (no need to be registered) locally within the same function. The workflow continues immediately without suspension or remote calls.                                     |
| **`resonate.register()`**    | Register functions for orchestration.                                                                |
| **`resonate.httpHandler()`** | Expose an HTTP endpoint for Cloud Functions or Cloud Run.                                                  |

---

## 🧩 Related Packages

| Platform     | Package           |
| ------------ | ----------------- |
| AWS          | `@resonatehq/aws` |
| Google Cloud | `@resonatehq/gcp` |

---
