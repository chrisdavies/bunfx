import type { HTMLAttributes } from 'preact';
import type { RichImg } from './rich-img';
import type { RichBlock } from './rich-block';
import type { RichCta } from './rich-cta';
import type { EditorUI } from './editor-ui';
import type { RichText, SelectionChangeEvent } from '../editor';
import type { FileUpload } from './upload';

declare module 'preact' {
  namespace JSX {
    interface IntrinsicElements {
      'rich-text': HTMLAttributes<RichText> & {
        value?: string;
        onSelectionChange?(e: SelectionChangeEvent): void;
      };
      'editor-ui': HTMLAttributes<EditorUI>;
      'editor-placeholder': HTMLAttributes<EditorUI>;
      'rich-img': HTMLAttributes<RichImg>;
      'rich-block': HTMLAttributes<RichBlock>;
      'rich-cta': HTMLAttributes<RichCta>;
      'file-upload': HTMLAttributes<FileUpload> & {
        uploadid: string;
      };
    }
  }
}
