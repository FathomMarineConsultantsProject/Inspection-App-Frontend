import { Image } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

export async function autoCenterCropToAspect(
  uri: string,
  aspectRatio = 16 / 9
): Promise<string> {
  const { width, height } = await getImageSize(uri);
  if (width <= 0 || height <= 0) return uri;

  const sourceRatio = width / height;
  let cropWidth = width;
  let cropHeight = height;
  let originX = 0;
  let originY = 0;

  if (sourceRatio > aspectRatio) {
    cropWidth = Math.round(height * aspectRatio);
    originX = Math.round((width - cropWidth) / 2);
  } else {
    cropHeight = Math.round(width / aspectRatio);
    originY = Math.round((height - cropHeight) / 2);
  }

  const result = await manipulateAsync(
    uri,
    [
      {
        crop: {
          originX,
          originY,
          width: cropWidth,
          height: cropHeight,
        },
      },
    ],
    {
      compress: 1,
      format: SaveFormat.JPEG,
    }
  );

  return result.uri;
}
