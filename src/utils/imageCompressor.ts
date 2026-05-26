import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export interface CompressionResult {
  uri: string;
  sizeBytes: number;
  success: boolean;
}

/**
 * Progressively compresses an image to ensure it is under a specific file size threshold.
 * Default threshold is 300KB (307,200 bytes).
 *
 * @param sourceUri The local filesystem URI of the image to compress
 * @param maxSizeBytes The maximum allowed file size in bytes (default 300KB)
 */
export async function compressImageToLimit(
  sourceUri: string,
  maxSizeBytes: number = 300 * 1024
): Promise<CompressionResult> {
  try {
    // 1. Check initial file size
    const initialInfo = await FileSystem.getInfoAsync(sourceUri);
    if (!initialInfo.exists) {
      throw new Error(`File does not exist at URI: ${sourceUri}`);
    }

    const initialSize = initialInfo.size;
    if (initialSize <= maxSizeBytes) {
      // Under threshold already, just return original URI
      return {
        uri: sourceUri,
        sizeBytes: initialSize,
        success: true,
      };
    }

    let compression = 0.85;
    let width = 1200; // Resize target width
    let currentUri = sourceUri;
    let currentSize = initialSize;
    let iterations = 0;
    const maxIterations = 4; // Prevent infinite loops

    while (currentSize > maxSizeBytes && iterations < maxIterations && compression > 0.1) {
      iterations++;

      // Progressive scale down and compress
      const manipulateResult = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ resize: { width } }],
        {
          compress: compression,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      const manipulatedInfo = await FileSystem.getInfoAsync(manipulateResult.uri);
      if (manipulatedInfo.exists) {
        currentUri = manipulateResult.uri;
        currentSize = manipulatedInfo.size;
      }

      // Step down values for next iteration
      width = Math.max(640, Math.floor(width * 0.8));
      compression = Math.max(0.1, compression - 0.2);
    }

    // Move to permanent documents folder if it is in a temporary folder
    const fileName = `bill_${Date.now()}_compressed.jpg`;
    // @ts-ignore
    const destinationPath = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({
      from: currentUri,
      to: destinationPath,
    });

    return {
      uri: destinationPath,
      sizeBytes: currentSize,
      success: currentSize <= maxSizeBytes,
    };
  } catch (error) {
    console.error('Error during image compression:', error);
    return {
      uri: sourceUri,
      sizeBytes: 0,
      success: false,
    };
  }
}
