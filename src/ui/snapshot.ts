let snapshotter: (() => string) | null = null;

/** Registered by the 3D viewport while mounted. */
export function setSnapshotter(fn: (() => string) | null): void {
  snapshotter = fn;
}

/** PNG data URL of the 3D canvas, or null when the viewport is not mounted or capture fails. */
export function takeSnapshot(): string | null {
  if (!snapshotter) return null;
  try {
    return snapshotter();
  } catch {
    return null;
  }
}
