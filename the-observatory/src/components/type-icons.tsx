import {
  Star, Orbit, CircleQuestionMark,
  Sparkles, Telescope, Badge, CircleGauge, Flame, GitCommitVertical
} from "lucide-react";
import type { ObjectType } from "./types";

export const TYPE_ICONS: Record<ObjectType, React.ReactNode> = {
  Star: <Star size={12} />,
  "Double Star": <Star size={12} />,
  "Triple Star": <Star size={12} />,
  Galaxy: <Orbit size={12} />,
  Unidentified: <CircleQuestionMark size={12} />,
  "Reflection Nebula": <Sparkles size={12}/>,
  "Open Cluster": <Telescope size={12} />,
  "Globular Cluster": <Badge size={12}/>,
  "Planetary Nebula": <CircleGauge size={12}/>,
  Asterism: <Flame size={12} />,
  Knot: <GitCommitVertical size={12}/>,
};
