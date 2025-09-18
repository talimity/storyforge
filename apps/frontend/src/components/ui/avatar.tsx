import { Avatar as ChakraAvatar, AvatarGroup as ChakraAvatarGroup } from "@chakra-ui/react";
import type * as React from "react";

type ImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

export interface AvatarProps extends ChakraAvatar.RootProps {
  name?: string;
  src?: string | null;
  srcSet?: string;
  loading?: ImageProps["loading"];
  icon?: React.ReactElement;
  fallback?: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement | null>;
}

export const Avatar = (props: AvatarProps) => {
  const { name, src, srcSet, loading, icon, fallback, children, ref, ...rest } = props;
  return (
    <ChakraAvatar.Root ref={ref} {...rest}>
      <ChakraAvatar.Fallback name={name}>{icon || fallback}</ChakraAvatar.Fallback>
      {src && <ChakraAvatar.Image src={src} srcSet={srcSet} loading={loading} />}
      {children}
    </ChakraAvatar.Root>
  );
};

export const AvatarGroup = ChakraAvatarGroup;
