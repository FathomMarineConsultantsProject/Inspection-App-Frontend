import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

const MAX_EXPORT_WIDTH = 1200;
const EXPORT_QUALITY = 0.7;
const YIELD_EVERY = 3;

function waitForNextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function getImageSize(
  uri: string,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}

export async function processImage(uri: string): Promise<string> {
  try {
    const size = await getImageSize(uri);
    const shouldResize = !!size && size.width > MAX_EXPORT_WIDTH;
    const actions = shouldResize
      ? [{ resize: { width: MAX_EXPORT_WIDTH } }]
      : [];

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: EXPORT_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return result.uri || uri;
  } catch {
    try {
      const fallback = await ImageManipulator.manipulateAsync(uri, [], {
        compress: EXPORT_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      return fallback.uri || uri;
    } catch {
      return uri;
    }
  }
}

export async function processImages(uris: string[]): Promise<string[]> {
  const output: string[] = [];
  for (let i = 0; i < uris.length; i += 1) {
    const processed = await processImage(uris[i]);
    output.push(processed);
    if ((i + 1) % YIELD_EVERY === 0) {
      await waitForNextTick();
    }
  }
  return output;
}
