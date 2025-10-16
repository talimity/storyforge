import path from "node:path";
import { fileURLToPath } from "node:url";
import { InferenceSession, Tensor } from "onnxruntime-node";
import sharp from "sharp";

// via huggingface.co/Bingsu/adetailer, converted to ONNX
const MODEL_PATH = "../models/face_yolov8n_v2.onnx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// lazy-load the ONNX model session
let sessionP: Promise<InferenceSession> | null = null;

function getSession(): Promise<InferenceSession> {
  if (!sessionP) {
    const modelPath = path.resolve(__dirname, MODEL_PATH);
    sessionP = InferenceSession.create(modelPath);
  }
  return sessionP;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedBox extends Box {
  confidence: number;
}

export interface FocalPoint {
  /** X coordinate of the face center (0-1, relative to image width) */
  x: number;
  /** Y coordinate of the face center (0-1, relative to image height) */
  y: number;
  /** Width of the face box (0-1, relative to image width) */
  width: number;
  /** Height of the face box (0-1, relative to image height) */
  height: number;
  /** Detection confidence (0-1) */
  confidence: number;
}

export interface DetectOptions {
  /** Model input size (square). Default: 640 */
  inputSize?: number;
  /** Discard detections below this confidence [0–1]. Default: 0.02 */
  confThreshold?: number;
  /** IoU threshold for NMS [0–1]. Default: 0.45 */
  iouThreshold?: number;
}

export interface FocalPointOptions extends Omit<DetectOptions, "confThreshold"> {
  /**
   * Confidence thresholds to try in sequence if no face is found.
   * Default: [0.25, 0.15, 0.05, 0.02]
   */
  confThresholds?: number[];
  /**
   * Maximum number of attempts before giving up.
   * Default: length of confThresholds array
   */
  maxAttempts?: number;
}

/** Intersection-over-union of two axis-aligned boxes */
function computeIoU(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const inter = interW * interH;

  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/** JS greedy NMS: keep highest-confidence boxes, remove overlaps above iouThreshold */
function nms(boxes: DetectedBox[], iouThreshold: number): DetectedBox[] {
  const sorted = boxes.sort((a, b) => b.confidence - a.confidence);
  const keep: DetectedBox[] = [];

  for (const box of sorted) {
    if (keep.every((kb) => computeIoU(box, kb) <= iouThreshold)) {
      keep.push(box);
    }
  }

  return keep;
}

/**
 * Returns all detected faces (with confidence) in the image.
 */
export async function detectFaces(
  imageInput: sharp.SharpInput,
  { inputSize = 640, confThreshold = 0.02, iouThreshold = 0.45 }: DetectOptions = {}
): Promise<DetectedBox[]> {
  const session = await getSession();

  // 1) get original size
  const metadata = await sharp(imageInput).metadata();
  const origW = metadata.width;
  const origH = metadata.height;

  if (!origW || !origH) {
    throw new Error("Could not read image size");
  }

  // 2) letter-box (keep ratio, pad with ultralytics 114 gray)
  const scale = Math.min(inputSize / origW, inputSize / origH);
  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);
  const padX = Math.floor((inputSize - newW) / 2);
  const padY = Math.floor((inputSize - newH) / 2);

  const data = await sharp(imageInput)
    .resize({
      width: newW,
      height: newH,
      fit: "contain",
      background: { r: 114, g: 114, b: 114 },
    })
    .extend({
      top: padY,
      bottom: inputSize - newH - padY,
      left: padX,
      right: inputSize - newW - padX,
      background: { r: 114, g: 114, b: 114 },
    })
    .removeAlpha()
    .raw()
    .toBuffer();

  // 3) convert height-width-channels to channels-height-width in BGR order
  const hw = inputSize * inputSize;
  const inputData = new Float32Array(3 * hw);
  for (let i = 0; i < hw; i++) {
    inputData[0 * hw + i] = data[i * 3 + 2] / 255; // B
    inputData[1 * hw + i] = data[i * 3 + 1] / 255; // G
    inputData[2 * hw + i] = data[i * 3 + 0] / 255; // R
  }

  // 4) inference
  const input = new Tensor("float32", inputData, [1, 3, inputSize, inputSize]);
  const out = (await session.run({ [session.inputNames[0]]: input }))[session.outputNames[0]];
  const [, _attrN, boxN] = out.dims; // [1,5,8400]
  const buf = out.data as Float32Array;

  // attribute offsets
  const offsetX = 0 * boxN;
  const offsetY = 1 * boxN;
  const offsetW = 2 * boxN;
  const offsetH = 3 * boxN;
  const offsetC = 4 * boxN;

  const candidates: DetectedBox[] = [];
  for (let i = 0; i < boxN; i++) {
    const conf = buf[offsetC + i];
    if (conf < confThreshold) continue;

    const cx640 = buf[offsetX + i];
    const cy640 = buf[offsetY + i];
    const w640 = buf[offsetW + i];
    const h640 = buf[offsetH + i];

    // undo padding & scale
    const x = (cx640 - w640 / 2 - padX) / scale;
    const y = (cy640 - h640 / 2 - padY) / scale;
    const w = w640 / scale;
    const h = h640 / scale;

    candidates.push({ x, y, width: w, height: h, confidence: conf });
  }

  return nms(candidates, iouThreshold);
}

/**
 * Detects the primary face in an image and returns normalized focal point coordinates.
 *
 * This function will try progressively lower confidence thresholds if no face is
 * initially detected, making it suitable for illustrated character art where
 * face detection may be less reliable than with photographs.
 *
 * @param imageInput Path to the image file
 * @param options Detection options including confidence thresholds to try
 * @returns Focal point with normalized coordinates (0-1 range) or null if no face found
 *
 * @example
 * const focal = await detectFaceFocalPoint('/path/to/character.png');
 * if (focal) {
 *   console.log(`Face center at ${focal.x * 100}%, ${focal.y * 100}%`);
 *   // Store focal.x, focal.y, focal.width, focal.height in database
 * }
 */
export async function detectFaceFocalPoint(
  imageInput: sharp.SharpInput,
  options: FocalPointOptions = {}
): Promise<FocalPoint | null> {
  const {
    inputSize = 640,
    iouThreshold = 0.45,
    confThresholds = [0.5, 0.25, 0.1],
    maxAttempts = confThresholds.length,
  } = options;

  // get image dimensions for normalization
  const metadata = await sharp(imageInput).metadata();
  const imageWidth = metadata.width;
  const imageHeight = metadata.height;

  if (!imageWidth || !imageHeight) {
    throw new Error("Could not read image dimensions");
  }

  // try detection with progressively lower confidence thresholds
  for (let i = 0; i < Math.min(maxAttempts, confThresholds.length); i++) {
    const confThreshold = confThresholds[i];

    try {
      const faces = await detectFaces(imageInput, {
        inputSize,
        confThreshold,
        iouThreshold,
      });

      if (faces.length > 0) {
        const face = faces[0]; // highest confidence face

        // calculate center point, normalize
        const centerX = (face.x + face.width / 2) / imageWidth;
        const centerY = (face.y + face.height / 2) / imageHeight;
        const normalizedWidth = face.width / imageWidth;
        const normalizedHeight = face.height / imageHeight;

        return {
          x: centerX,
          y: centerY,
          width: normalizedWidth,
          height: normalizedHeight,
          confidence: face.confidence,
        };
      }
    } catch (error) {
      // try again
      if (i === maxAttempts - 1) {
        // no more attempts left
        throw error;
      }
    }
  }

  // no face detected after all attempts
  return null;
}

/**
 * Helper function to convert a focal point back to pixel coordinates.
 * Useful for verification or when absolute coordinates are needed.
 *
 * @param focal Normalized focal point
 * @param imageWidth Width of the image in pixels
 * @param imageHeight Height of the image in pixels
 * @returns Box with absolute pixel coordinates
 */
export function focalPointToBox(
  focal: Pick<FocalPoint, "x" | "y" | "width" | "height">,
  imageWidth: number,
  imageHeight: number
): Box {
  const width = focal.width * imageWidth;
  const height = focal.height * imageHeight;
  const x = focal.x * imageWidth - width / 2;
  const y = focal.y * imageHeight - height / 2;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export interface CropResultOptions {
  /**
   * Padding multiplier for the crop box.
   * Default: 1.2
   */
  padding?: number;
  /**
   * Whether to force a square crop.
   * Default: true
   */
  square?: boolean;
  /**
   * Minimum crop size in pixels.
   * Default: undefined (no minimum)
   */
  minSize?: number;
  /**
   * Maximum crop size in pixels.
   * Default: undefined (no maximum)
   */
  maxSize?: number;
  /**
   * Force the final output dimensions.
   * - If a number is provided, the image will be square (size ✕ size).
   * - If an object, the specified width/height will be used.
   */
  outputSize?: number | { width: number; height: number };
  /**
   * Allow up-scaling when the crop is smaller than the requested size.
   * Default: true
   */
  allowUpscale?: boolean;
}

/**
 * Crops an image around a previously-detected focal point (typically a face),
 * applies optional padding and size constraints, and returns a `Buffer` with
 * the processed image. By default the crop is square, padded by 1.5× the
 * detected face box, and will be resized to satisfy any `minSize`, `maxSize`,
 * or `outputSize` options.
 *
 * ```ts
 * const focal = await detectFaceFocalPoint("/img/portrait.jpg");
 * if (focal) {
 *   const avatar = await cropByFocalPoint(
 *     "/img/portrait.jpg",
 *     focal,
 *     { outputSize: 64 }
 *   );
 *   await sharp(avatar).toFile("/img/avatar-64.png");
 * }
 * ```
 */
export async function cropByFocalPoint(
  imageInput: sharp.SharpInput,
  focal: { x: number; y: number; w: number; h: number },
  {
    padding = 1.2,
    square = true,
    minSize,
    maxSize,
    outputSize,
    allowUpscale = true,
  }: CropResultOptions = {}
): Promise<Buffer> {
  const meta = await sharp(imageInput).metadata();
  const imgW = meta.width;
  const imgH = meta.height;
  if (!imgW || !imgH) {
    throw new Error("Could not read image dimensions");
  }

  // Face bounding-box (absolute px)
  const baseBox = focalPointToBox(
    { x: focal.x, y: focal.y, width: focal.w, height: focal.h },
    imgW,
    imgH
  );

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  // Centre of face box
  const cx = baseBox.x + baseBox.width / 2;
  const cy = baseBox.y + baseBox.height / 2;

  // Compute crop rectangle ensuring it fits within the image BEFORE placing it
  let extractW: number;
  let extractH: number;
  let left: number;
  let top: number;

  if (square) {
    // Desired square size based on padded face box
    const desired = Math.max(baseBox.width, baseBox.height) * padding;
    // Cap to image bounds while remaining square
    const size = Math.min(desired, imgW, imgH);
    extractW = extractH = Math.round(size);
    left = Math.round(clamp(cx - size / 2, 0, imgW - size));
    top = Math.round(clamp(cy - size / 2, 0, imgH - size));
  } else {
    // Non-square crop: cap width/height independently
    const w = Math.min(baseBox.width * padding, imgW);
    const h = Math.min(baseBox.height * padding, imgH);
    extractW = Math.round(w);
    extractH = Math.round(h);
    left = Math.round(clamp(cx - w / 2, 0, imgW - w));
    top = Math.round(clamp(cy - h / 2, 0, imgH - h));
  }

  let pipeline = sharp(imageInput).extract({
    left,
    top,
    width: extractW,
    height: extractH,
  });

  /** Decide if we need to resize after extraction */
  const chooseTarget = (): { width: number; height: number } | null => {
    let targetW = extractW;
    let targetH = extractH;

    // Honor min/max bounds
    if (square) {
      if (minSize && targetW < minSize) targetW = targetH = minSize;
      if (maxSize && targetW > maxSize) targetW = targetH = maxSize;
    } else {
      if (minSize) {
        if (targetW < minSize) targetW = minSize;
        if (targetH < minSize) targetH = minSize;
      }
      if (maxSize) {
        if (targetW > maxSize) targetW = maxSize;
        if (targetH > maxSize) targetH = maxSize;
      }
    }

    // Explicit output size always wins
    if (outputSize) {
      if (typeof outputSize === "number") {
        targetW = targetH = outputSize;
      } else {
        targetW = outputSize.width;
        targetH = outputSize.height;
      }
    }

    const willUpscale = targetW > extractW || targetH > extractH;
    if (!allowUpscale && willUpscale) return null;
    if (targetW === extractW && targetH === extractH) return null;

    return { width: Math.round(targetW), height: Math.round(targetH) };
  };

  const resizeDims = chooseTarget();
  if (resizeDims) {
    pipeline = pipeline.resize({
      width: resizeDims.width,
      height: resizeDims.height,
      fit: "cover",
    });
  }

  return pipeline.toBuffer();
}
