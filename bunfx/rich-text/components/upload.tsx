/**
 * The upload management logic for rich text editing, including
 * components for displaying upload progress.
 */

import { Button } from '../ui';
import { IcoRefresh } from '../icons';
import { Signal, effect, signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { render } from 'preact';

export type UploadProgress = {
  progress: number;
};

export type UploadResult = {
  publicUrl: string;
};

export type Uploader = {
  upload(): Promise<UploadResult | undefined>;
  abort(): void;
};

export type MakeUploader = (opts: {
  file: File | Blob;
  name?: string;
  onProgress?(state: UploadProgress): void;
}) => Uploader;

export type Upload = {
  id: string;
  file: File | Blob;
  name: string;
  progress: number;
  error?: Error;
  url?: string;
  retry(): void;
  onComplete(placeholder: HTMLElement, upload: Upload): Promise<unknown>;
};

export type Uploads = Signal<Record<string, Signal<Upload>>>;
type UploadableNode = Element & { uploads?: Uploads };

export function getUploads(editor: UploadableNode): Uploads {
  let uploads = editor.uploads;
  if (!uploads) {
    uploads = signal({});
    editor.uploads = uploads;
  }
  return uploads;
}

function findUpload(child: Element, uploadId: string) {
  let el: UploadableNode | null = child;
  while (el && !el.uploads) {
    el = el.parentElement;
  }
  return el?.uploads?.value[uploadId];
}

export function makeUpload(
  file: File | Blob,
  makeUploader: MakeUploader,
  onComplete: Upload['onComplete'],
): Signal<Upload> {
  const name = (file as File).name || file.type.replaceAll(/[^0-9a-zA-Z]/g, '');
  const upload = signal<Upload>({
    id: globalThis.crypto.randomUUID(),
    file,
    name,
    progress: 0,
    onComplete,
    retry() {
      upload.value = {
        ...upload.value,
        error: undefined,
        progress: 0,
      };
      performUpload();
    },
  });

  async function performUpload() {
    const uploader = makeUploader({
      file,
      name,
      onProgress(state) {
        upload.value = {
          ...upload.value,
          progress: state.progress,
        };
      },
    });
    try {
      const result = await uploader.upload();
      upload.value = { ...upload.value, url: result?.publicUrl };
    } catch (error) {
      upload.value = { ...upload.value, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
  performUpload();

  return upload;
}

export function addUpload(editor: HTMLElement, upload: Signal<Upload>) {
  const uploads = getUploads(editor);
  uploads.value = {
    ...uploads.value,
    [upload.value.id]: upload,
  };
  return upload;
}

export class FileUpload extends HTMLElement {
  ondisconnect: Array<() => void> = [];

  connectedCallback() {
    const uploadid = this.getAttribute('uploadid');
    const upload = uploadid && findUpload(this, uploadid);
    if (!upload) {
      return <UploadError message="Upload not found." />;
    }
    this.ondisconnect.push(
      effect(() => {
        if (upload.value.url && !upload.value.error) {
          upload.value.onComplete(this, upload.value).catch((error) => {
            upload.value = { ...upload.value, error };
          });
        }
      }),
    );
    render(<UploadUI upload={upload} />, this);
  }

  disconnectedCallback() {
    render(null, this);
    this.ondisconnect.forEach((f) => f());
    this.ondisconnect.length = 0;
  }
}

customElements.define('file-upload', FileUpload);

function UploadUI(props: { upload: Signal<Upload> }) {
  const upload = props.upload.value;
  if (upload.error) {
    return <RetryableUploadError upload={upload} />;
  }
  return <UploadProgressUI upload={upload} />;
}

function UploadProgressUI({ upload }: { upload: Upload }) {
  if (upload.error) {
    return null;
  }
  return (
    <editor-ui class="bg-gray-100 text-gray-600 rounded-lg p-4 text-sm flex flex-col gap-2">
      <header class="flex justify-between gap-4">
        <span>Uploading {upload.name} ...</span>
        <span class="w-20 text-right">{upload.progress}%</span>
      </header>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={upload.progress}
        class="flex h-1 rounded-full"
      >
        <div
          class="bg-gray-600 animate-pulse transition-all rounded-full"
          style={{ width: `${upload.progress}%` }}
        ></div>
      </div>
    </editor-ui>
  );
}

function RetryableUploadError({ upload }: { upload: Upload }) {
  if (!upload.error) {
    return null;
  }
  return (
    <UploadError message={upload.error.message}>
      <footer>
        <Button
          class="inline-flex items-center gap-2 bg-gray-900/50 hover:bg-gray-900 rounded-md p-2 py-1"
          onClick={upload.retry}
        >
          <IcoRefresh />
          <span>Retry upload</span>
        </Button>
      </footer>
    </UploadError>
  );
}

function UploadError(props: { message: ComponentChildren; children?: ComponentChildren }) {
  return (
    <editor-ui class="bg-gray-800 text-white rounded-lg p-4 shadow-lg text-sm flex flex-col gap-4">
      <div class="flex flex-col">
        <span class="font-medium text-base">Upload failed</span>
        <span>{props.message}</span>
      </div>
      {props.children}
    </editor-ui>
  );
}
