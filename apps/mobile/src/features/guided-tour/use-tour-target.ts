import { useContext, useEffect, useRef } from "react";
import type { View } from "react-native";
import { ScreenVisible } from "../../components/screen-focus";
import { TourContext } from "./tour-context";

/**
 * Marks the element the returned props are spread on as the tour's target
 * `id` (null for none, when the same component is used elsewhere). Spread them on a View or Pressable: `<View {...useTourTarget(id)}>`.
 * A screen kept mounted out of view does not register, so the tour never
 * measures a hidden copy. `collapsable: false` stops Android from flattening
 * a layout-only view into nothing measurable.
 */
export function useTourTarget(id: string | null) {
  const { registry } = useContext(TourContext);
  const visible = useContext(ScreenVisible);
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!registry || !visible || id === null) return;
    return registry.register(id, ref);
  }, [id, registry, visible]);
  return { ref, collapsable: false } as const;
}
