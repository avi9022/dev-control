/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type FC } from "react";
import Editor from "@monaco-editor/react";

interface JsonInputProps {
  onChange?: (json: any) => void;
  value?: any;
  disabled?: boolean
}

export const JsonInput: FC<JsonInputProps> = ({
  onChange,
  value = "{}",
  disabled
}) => {
  const [error, setError] = useState<string | null>(null);

  const handleEditorChange = (val?: string) => {
    const newVal = val ?? "";
    try {
      setError(null);
      onChange?.(newVal);
    } catch {
      setError("Invalid JSON");
    }
  };

  return (
    <div className="w-full h-[200px] border rounded-md overflow-hidden">
      <Editor
        height="100%"
        defaultLanguage="json"
        className={disabled ? "opacity-30 pointer-events-none" : ''}
        theme="vs-dark"
        value={value}
        onChange={handleEditorChange}
        options={{
          formatOnType: true,
          autoClosingBrackets: "always",
          tabSize: 2,
          minimap: { enabled: false },
        }}
      />
      {error && <p className="text-sm text-red-500 px-2">⚠️ {error}</p>}
    </div>
  );
};
