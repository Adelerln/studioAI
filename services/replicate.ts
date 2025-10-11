import Replicate from 'replicate';

/**
 * Shared Replicate client for server-side environments.
 * The library automatically reads the `REPLICATE_API_TOKEN` environment variable when no auth token is provided.
 */
export const replicateClient = new Replicate();

interface RunReplicateOptions {
  model: `${string}/${string}` | `${string}/${string}:${string}`;
  input: Record<string, unknown>;
}

export async function runReplicateModel<TOutput = unknown>({ model, input }: RunReplicateOptions): Promise<TOutput> {
  return (await replicateClient.run(model, { input })) as TOutput;
}
