import { setup, fromPromise, assign } from 'xstate';

export interface File {
  name: string;
  size: number;
  type: string;
  blob: Uint8Array;
}

export interface UploadContext {
  file: File | null;
  attempts: number;
  errorMessage: string | null;
  uploadedUrl: string | null;
}

export type UploadEvent =
  | { type: 'UPLOAD'; file: File }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export type Uploader = (file: File) => Promise<{ url: string }>;

export const MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'application/pdf'];

function emptyCtx(): UploadContext {
  return { file: null, attempts: 0, errorMessage: null, uploadedUrl: null };
}

export function buildUploadMachine(uploader: Uploader) {
  return setup({
    types: {
      context: {} as UploadContext,
      events: {} as UploadEvent,
    },
    actors: {
      uploader: fromPromise(async ({ input }: { input: { file: File } }) => uploader(input.file)),
    },
    guards: {
      isTooLarge: ({ context }) => context.file !== null && context.file.size > MAX_SIZE_BYTES,
      isUnsupportedType: ({ context }) =>
        context.file !== null && !ALLOWED_MIME.includes(context.file.type),
      canRetry: ({ context }) => context.attempts < 3,
    },
    actions: {
      assignFile: assign({
        file: ({ event }) => (event.type === 'UPLOAD' ? event.file : null),
      }),
      assignUrl: assign({
        uploadedUrl: ({ event }) =>
          'output' in event ? (event as { output: { url: string } }).output.url : null,
      }),
      assignTooLarge: assign({ errorMessage: () => 'too large' }),
      assignUnsupportedType: assign({ errorMessage: () => 'unsupported type' }),
      assignUploadError: assign({
        errorMessage: ({ event }) =>
          'error' in event
            ? String((event as { error: unknown }).error)
            : 'upload failed',
      }),
      incrementAttempts: assign({
        attempts: ({ context }) => context.attempts + 1,
      }),
      resetCtx: assign(() => emptyCtx()),
    },
  }).createMachine({
    id: 'upload',
    initial: 'idle',
    context: emptyCtx(),
    states: {
      idle: {
        on: {
          UPLOAD: {
            target: 'validating',
            actions: ['assignFile'],
          },
        },
      },
      validating: {
        always: [
          { target: 'rejected', guard: 'isTooLarge', actions: ['assignTooLarge'] },
          { target: 'rejected', guard: 'isUnsupportedType', actions: ['assignUnsupportedType'] },
          { target: 'uploading' },
        ],
      },
      uploading: {
        entry: ['incrementAttempts'],
        invoke: {
          id: 'uploader',
          src: 'uploader',
          input: ({ context }) => ({ file: context.file as File }),
          onDone: {
            target: 'success',
            actions: ['assignUrl'],
          },
          onError: {
            target: 'failed',
            actions: ['assignUploadError'],
          },
        },
      },
      failed: {
        on: {
          RETRY: {
            target: 'uploading',
            guard: 'canRetry',
          },
          RESET: {
            target: 'idle',
            actions: ['resetCtx'],
          },
        },
      },
      success: {
        on: {
          RESET: {
            target: 'idle',
            actions: ['resetCtx'],
          },
        },
      },
      rejected: {
        on: {
          RESET: {
            target: 'idle',
            actions: ['resetCtx'],
          },
        },
      },
    },
  });
}
