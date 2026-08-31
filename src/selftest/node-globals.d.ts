// The self-test runs under Node, but this project's tsconfig targets the
// browser and does not pull in @types/node. Rather than widen the app's
// type environment (or drop the self-test out of `tsc` entirely, which
// would let it rot), the two Node globals it touches are declared here.

declare const process: {
  stdout: { write(chunk: string): boolean };
  exitCode?: number;
};
