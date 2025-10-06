import { Box } from "@chakra-ui/react";
import { useState } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { FocalPoint } from "@storyforge/contracts";
import { Button, Dialog } from "@/components/ui";

const PADDING = 1.1; // must match server crop padding

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function focalToPercentCropFromDims(
  f: FocalPoint,
  imgW: number,
  imgH: number,
  padding = PADDING
): PercentCrop {
  // Compute square size in px first, then convert to % per axis so the visual mask is square.
  const faceWpx = f.w * imgW;
  const faceHpx = f.h * imgH;
  const desired = Math.max(faceWpx, faceHpx) * padding; // square side (px)
  const sizePx = Math.min(desired, imgW, imgH);

  const widthPct = clamp((sizePx / imgW) * 100, 1, 100);
  const heightPct = clamp((sizePx / imgH) * 100, 1, 100);

  const xPct = clamp(f.x * 100 - widthPct / 2, 0, 100 - widthPct);
  const yPct = clamp(f.y * 100 - heightPct / 2, 0, 100 - heightPct);

  return { unit: "%", x: xPct, y: yPct, width: widthPct, height: heightPct };
}

function percentCropToFocal(c: PercentCrop, padding = PADDING, prevConfidence = 0): FocalPoint {
  // Convert padded square crop (percent) -> normalized focal {x,y,w,h}
  const centerX = (c.x + c.width / 2) / 100;
  const centerY = (c.y + c.height / 2) / 100;
  return {
    x: centerX,
    y: centerY,
    // Use each axis' percentage independently so base box in px is square again after padding
    w: c.width / 100 / padding,
    h: c.height / 100 / padding,
    c: prevConfidence, // preserve existing confidence
  };
}

interface AvatarCropDialogProps {
  isOpen: boolean;
  onOpenChange: (details: { open: boolean }) => void;
  src: string; // original portrait URL
  initialFocal: FocalPoint; // DB-shaped focal
  onSave: (fp: FocalPoint) => void;
}

export function AvatarCropDialog({
  isOpen,
  onOpenChange,
  src,
  initialFocal,
  onSave,
}: AvatarCropDialogProps) {
  const [percentCrop, setPercentCrop] = useState<PercentCrop>({
    unit: "%",
    x: 0,
    y: 0,
    width: 50,
    height: 50,
  });

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const w = el.naturalWidth;
    const h = el.naturalHeight;
    setPercentCrop(focalToPercentCropFromDims(initialFocal, w, h));
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange} placement="center">
      <Dialog.Content maxW="800px">
        <Dialog.Header>
          <Dialog.Title>Adjust Avatar Crop</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Box>
            <ReactCrop
              crop={percentCrop}
              onChange={(_, pc) => setPercentCrop(pc)}
              aspect={1}
              keepSelection
              circularCrop={false}
            >
              <img src={src} alt="Portrait" style={{ maxWidth: "100%" }} onLoad={handleImgLoad} />
            </ReactCrop>
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.ActionTrigger asChild>
            <Button variant="outline">Cancel</Button>
          </Dialog.ActionTrigger>
          <Button
            colorPalette="primary"
            onClick={() => {
              onSave(percentCropToFocal(percentCrop, PADDING, initialFocal.c));
              onOpenChange({ open: false });
            }}
          >
            Save
          </Button>
        </Dialog.Footer>
        <Dialog.CloseTrigger />
      </Dialog.Content>
    </Dialog.Root>
  );
}
