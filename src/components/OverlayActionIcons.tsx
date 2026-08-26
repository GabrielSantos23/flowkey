import React from "react";
import {
  Play,
  Pause,
  Heart,
  HeartOff,
  FastForward,
  Rewind,
  Radio,
  Disc,
  ListPlus,
  Plus,
  ArrowLeft,
  X,
  Search,
  ExternalLink,
  Shuffle,
} from "lucide-react";
import { SpotifyIcon } from "../assets/spotify-icon";
import { cn } from "../lib/utils";

interface IconProps {
  className?: string;
  size?: number;
}

const baseIconClass = "w-4 h-4 text-foreground/90 shrink-0";

export const ActionShuffleIcon: React.FC<IconProps> = ({ className }) => (
  <Shuffle className={cn(baseIconClass, className)} />
);

export const ActionPlayIcon: React.FC<IconProps> = ({ className }) => (
  <Play className={cn(baseIconClass, "fill-current", className)} />
);

export const ActionPauseIcon: React.FC<IconProps> = ({ className }) => (
  <Pause className={cn(baseIconClass, "fill-current", className)} />
);

export const ActionLikeIcon: React.FC<IconProps> = ({ className }) => (
  <Heart className={cn(baseIconClass, "fill-rose-500 text-rose-500", className)} />
);

export const ActionUnlikeIcon: React.FC<IconProps> = ({ className }) => (
  <HeartOff className={cn(baseIconClass, "text-muted-foreground", className)} />
);

export const ActionNextIcon: React.FC<IconProps> = ({ className }) => (
  <FastForward className={cn(baseIconClass, className)} />
);

export const ActionPrevIcon: React.FC<IconProps> = ({ className }) => (
  <Rewind className={cn(baseIconClass, className)} />
);

export const ActionRadioIcon: React.FC<IconProps> = ({ className }) => (
  <Radio className={cn(baseIconClass, className)} />
);

export const ActionAlbumIcon: React.FC<IconProps> = ({ className }) => (
  <Disc className={cn(baseIconClass, className)} />
);

export const ActionPlaylistIcon: React.FC<IconProps> = ({ className }) => (
  <ListPlus className={cn(baseIconClass, className)} />
);

export const ActionQueueIcon: React.FC<IconProps> = ({ className }) => (
  <Plus className={cn(baseIconClass, className)} />
);

export const ActionSpotifyIcon: React.FC<IconProps> = ({ className }) => (
  <SpotifyIcon className={cn("w-4 h-4 shrink-0", className)} lineColor="#000000" color="#ffffff" />
);

export const ActionBackIcon: React.FC<IconProps> = ({ className }) => (
  <ArrowLeft className={cn("w-4 h-4 shrink-0", className)} />
);

export const ActionCloseIcon: React.FC<IconProps> = ({ className }) => (
  <X className={cn("w-3.5 h-3.5 shrink-0", className)} />
);

export const ActionSearchIcon: React.FC<IconProps> = ({ className }) => (
  <Search className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0", className)} />
);

export const ActionExternalLinkIcon: React.FC<IconProps> = ({ className }) => (
  <ExternalLink className={cn(baseIconClass, className)} />
);
