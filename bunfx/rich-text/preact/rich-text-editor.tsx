import { useRef } from "preact/hooks";
import type { FilePicker } from "../components/rich-block";
import type { MakeUploader } from "../components/upload";
import { getDefaultExtensions } from "../defaults";
import type { EditorConfig } from "../editor/config";
import type { EditorExtension } from "../editor/extensions";
// Import RichText to register the custom element
import "../editor";

export type RichTextEditorProps = {
  value?: string;
  onChange?(html: string): void;
  uploader?: MakeUploader;
  filepicker?: FilePicker;
  extraExtensions?: EditorExtension[];
  autoFocus?: boolean;
};

type EditorElement = HTMLElement & { config?: EditorConfig };

export function RichTextEditor(props: RichTextEditorProps) {
  const configRef = useRef<EditorConfig | undefined>(undefined);

  if (!configRef.current) {
    configRef.current = {
      extensions: [...getDefaultExtensions(), ...(props.extraExtensions || [])],
      uploader: props.uploader,
      filepicker: props.filepicker,
    };
  }

  return (
    <rich-text
      contentEditable
      autofocus={props.autoFocus}
      ref={(el: EditorElement | null) => {
        if (el) {
          el.config = configRef.current;
        }
      }}
      value={props.value}
      onInput={(e: Event) => {
        const target = e.target as HTMLElement & { value?: string };
        if (target.value !== undefined) {
          props.onChange?.(target.value);
        }
      }}
    />
  );
}
