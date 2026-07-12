import type { ObjectType } from "./data";

/**
 * Displays the type AKA category of a CelestialObject
 */

interface TypeBadgeProps {
  color: string;
  icon: React.ReactNode;
  objectType: ObjectType;
  extraClasses?: string;
}

export function TypeBadge({ color, icon, objectType, extraClasses }: TypeBadgeProps) {
  return (
    <span
      className={
        `badge badge-soft ${color}${extraClasses ? ' ' + extraClasses : ''}`
      }
    >
      {icon}
      {objectType}
    </span>
  );
}
