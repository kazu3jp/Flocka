/** What the tour needs from a mounted element: its box in window coordinates. */
export type TourNode = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

/** Read-only, so a ref to a View (or Pressable) fits without a cast. */
type TourTargetRef = { readonly current: TourNode | null };

/**
 * Which element answers to which target id right now. Screens register a ref,
 * never a measurement, so the tour always measures the element where it
 * currently is. Two mounted screens may use one id (a tab kept in the
 * background); only the one registered last and still mounted answers, and
 * unregistering one never removes the other.
 */
export class TourTargetRegistry {
  private readonly refs = new Map<string, TourTargetRef[]>();

  register(id: string, ref: TourTargetRef): () => void {
    this.refs.set(id, [...(this.refs.get(id) ?? []), ref]);
    return () => {
      const rest = (this.refs.get(id) ?? []).filter((item) => item !== ref);
      if (rest.length) this.refs.set(id, rest);
      else this.refs.delete(id);
    };
  }

  /** The newest registered element that is currently mounted. */
  node(id: string): TourNode | null {
    const refs = this.refs.get(id) ?? [];
    for (let i = refs.length - 1; i >= 0; i--) {
      const node = refs[i].current;
      if (node) return node;
    }
    return null;
  }
}
