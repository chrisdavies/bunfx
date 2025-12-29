import type { FilePicker } from "../components/rich-block";
import type { MakeUploader } from "../components/upload";
import type { EditorExtension } from "./extensions";

export type EditorConfig = {
  extensions: EditorExtension[];
  uploader?: MakeUploader;
  filepicker?: FilePicker;
};

type EditorElement = HTMLElement & { config?: EditorConfig };

export function getEditorConfig(
  editor: EditorElement | null,
): EditorConfig | undefined {
  return editor?.config;
}
