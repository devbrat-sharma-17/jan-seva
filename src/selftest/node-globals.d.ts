// The self-test and the server functions both run under Node, but this
// project's tsconfig targets the browser and does not pull in
// @types/node. Rather than widen the app's type environment — which
// would let browser-bound code reference `fs` or `Buffer` and still
// typecheck — the handful of Node globals actually touched are declared
// here, and nothing else is.
//
//   process.stdout  the self-test's reporter
//   process.env     the server functions' configuration (api/)
//
// The server functions use the Web `Request`/`Response` signature that
// Vercel's Node runtime supports, so `process.env` is the only
// Node-specific surface they need.

declare const process: {
  stdout: { write(chunk: string): boolean };
  exitCode?: number;
  env: Record<string, string | undefined>;
};
