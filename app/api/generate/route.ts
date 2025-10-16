import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';
import { Buffer } from 'node:buffer';
import { writeFile, unlink } from 'node:fs/promises';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { runReplicateModel } from '@/services/replicate';
import { FREE_TIER_QUOTA } from '@/lib/stripe';
import { hasActiveSubscription, resolveQuotaLimit } from '@/services/subscriptions';

export const runtime = 'nodejs';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is missing.`);
  }
  return value;
}

const inputBucket = requireEnv('SUPABASE_INPUT_BUCKET');
const outputBucket = requireEnv('SUPABASE_OUTPUT_BUCKET');
requireEnv('REPLICATE_API_TOKEN');
const replicateModel = (process.env.REPLICATE_MODEL ?? 'google/nano-banana') as
  | `${string}/${string}`
  | `${string}/${string}:${string}`;

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const formData = await request.formData();

    const image = formData.get('image');
    const prompt = formData.get('prompt');

    if (!(image instanceof File)) {
      return NextResponse.json({ message: 'No image received.' }, { status: 400 });
    }

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ message: 'Prompt is required.' }, { status: 400 });
    }

    const inputPath = `uploads/${randomUUID()}-${image.name}`;
    const imageBuffer = Buffer.from(await image.arrayBuffer());

    const { error: uploadInputError } = await supabaseAdmin.storage
      .from(inputBucket)
      .upload(inputPath, imageBuffer, {
        contentType: image.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadInputError) {
      throw new Error(`Failed to upload source image: ${uploadInputError.message}`);
    }

    const {
      data: { publicUrl: inputPublicUrl }
    } = supabaseAdmin.storage.from(inputBucket).getPublicUrl(inputPath);

    console.log('[generate] input upload', {
      bucket: inputBucket,
      path: inputPath,
      publicUrl: inputPublicUrl
    });

    const input = {
      prompt,
      image: inputPublicUrl
    } as const;

    const {
      data: subscription,
      error: subscriptionError
    } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subscriptionError) {
      throw subscriptionError;
    }

    let quotaUsed = subscription?.quota_used ?? 0;
    let quotaLimit = FREE_TIER_QUOTA;

    if (subscription) {
      const expectedQuota = hasActiveSubscription(subscription.status)
        ? resolveQuotaLimit(subscription.stripe_price_id)
        : FREE_TIER_QUOTA;
      quotaLimit = expectedQuota;

      if ((subscription.quota_limit ?? FREE_TIER_QUOTA) !== expectedQuota) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ quota_limit: expectedQuota })
          .eq('user_id', user.id);
      }
    } else {
      await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: user.id,
          status: 'free',
          quota_limit: FREE_TIER_QUOTA,
          quota_used: 0
        })
        .select()
        .maybeSingle();
      quotaUsed = 0;
      quotaLimit = FREE_TIER_QUOTA;
    }

    if (quotaUsed >= quotaLimit) {
      return NextResponse.json(
        {
          message:
            "Vous avez atteint votre quota de générations pour ce cycle. Passez à un plan supérieur pour augmenter votre limite."
        },
        { status: 402 }
      );
    }

    console.log('[generate] replicate input', input);
    const replicateOutput = await runReplicateModel({ model: replicateModel, input });

    const { buffer: generatedBuffer, contentType } = await normaliseReplicateOutput(replicateOutput);
    const tmpFilePath = `/tmp/${randomUUID()}.png`;
    await writeFile(tmpFilePath, generatedBuffer);

    const outputPath = `results/${randomUUID()}.png`;

    const { error: uploadOutputError } = await supabaseAdmin.storage
      .from(outputBucket)
      .upload(outputPath, generatedBuffer, {
        contentType: contentType ?? 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    await unlink(tmpFilePath).catch(() => undefined);

    if (uploadOutputError) {
      throw new Error(`Failed to upload generated image: ${uploadOutputError.message}`);
    }

    const {
      data: { publicUrl: outputPublicUrl }
    } = supabaseAdmin.storage.from(outputBucket).getPublicUrl(outputPath);

    const { error: insertError } = await supabaseAdmin.from('projects').insert({
      input_image_url: inputPublicUrl,
      output_image_url: outputPublicUrl,
      prompt,
      status: 'completed',
      user_id: user.id
    });

    if (insertError) {
      throw insertError;
    }

    const nextUsage = quotaUsed + 1;
    const { error: usageUpdateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        quota_used: nextUsage,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (usageUpdateError) {
      throw usageUpdateError;
    }

    return NextResponse.json({ imageUrl: outputPublicUrl });
  } catch (error) {
    console.error('[generate] error', error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'An internal error occurred during generation.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

async function normaliseReplicateOutput(
  output: unknown
): Promise<{ buffer: Buffer; contentType?: string | null }> {
  if (!output) {
    throw new Error('Empty response received from Replicate.');
  }

  // Handle modern output object with helper methods.
  if (typeof output === 'object') {
    if (typeof (output as { url?: () => unknown }).url === 'function') {
      const result = (output as { url: () => unknown }).url();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        const resolvedUrl = (await result) as unknown;
        return downloadToBuffer(String(resolvedUrl));
      }
      return downloadToBuffer(String(result));
    }

    if (typeof Blob !== 'undefined' && output instanceof Blob) {
      const arrayBuffer = await output.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType: output.type ?? 'image/png'
      };
    }

    if (Array.isArray(output)) {
      for (const entry of output) {
        try {
          return await normaliseReplicateOutput(entry);
        } catch {
          // continue until we find a valid entry
        }
      }
    }
  }

  if (typeof output === 'string') {
    return downloadToBuffer(output);
  }

  if (output instanceof ArrayBuffer) {
    return { buffer: Buffer.from(output) };
  }

  if (ArrayBuffer.isView(output)) {
    return { buffer: Buffer.from(output.buffer) };
  }

  throw new Error('Unsupported Replicate output format.');
}

async function downloadToBuffer(url: string): Promise<{ buffer: Buffer; contentType?: string | null }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download Replicate output: ${response.statusText}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type')
  };
}
