import { withSentry } from "@sentry/cloudflare";
import { appHandler } from "./app";
import { sentryOptions } from "./logger";
import type { Env } from "./types";

export { appHandler };

export default withSentry<Env>(sentryOptions, appHandler);
