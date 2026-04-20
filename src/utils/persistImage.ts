import * as FileSystem from "expo-file-system/legacy";

function getExtensionFromUri(uri: string): string {
  const cleanUri = uri.split("?")[0] || uri;
  const filename = cleanUri.split("/").pop() || "";
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    return "jpg";
  }
  return filename.slice(dotIndex + 1);
}

export async function persistImage(uri: string): Promise<string> {
  try {
    console.log("Persisting:", uri);
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      throw new Error("FileSystem.documentDirectory is not available");
    }

    if (uri.includes("documentDirectory") || uri.startsWith(baseDir)) {
      return uri;
    }

    const dir = `${baseDir}inspection-images/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const extension = getExtensionFromUri(uri);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const newUri = `${dir}${uniqueName}`;

    await FileSystem.copyAsync({
      from: uri,
      to: newUri,
    });

    const info = await FileSystem.getInfoAsync(newUri);
    if (!info.exists) {
      throw new Error(`persistImage copy completed but file missing: ${newUri}`);
    }

    console.log("Saved to:", newUri);
    return newUri;
  } catch (error) {
    console.error("PERSIST FAILED", uri, error);
    throw error;
  }
}
