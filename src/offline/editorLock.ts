export type EditorMode = "active" | "readOnly" | "unsupported";

/** Holds a Web Lock for this page's lifetime.  We deliberately do not emulate
 * this with localStorage: a lease can split-brain after a suspended tab. */
export function holdEditorLock(
  name: string,
  onMode: (mode: EditorMode) => void,
) {
  let release: (() => void) | undefined;
  let disposed = false;
  let requesting = false;
  let held = false;
  const report = (mode: EditorMode) => {
    if (!disposed) onMode(mode);
  };
  const claim = () => {
    if (disposed || requesting || held) return;
    if (!("locks" in navigator) || !navigator.locks) {
      report("unsupported");
      return;
    }
    requesting = true;
    void navigator.locks
      .request(name, { ifAvailable: true }, async (lock) => {
        requesting = false;
        if (disposed) return;
        if (!lock) {
          report("readOnly");
          return;
        }
        held = true;
        await new Promise<void>((resolve) => {
          release = resolve;
          report("active");
        });
        held = false;
      })
      .catch(() => {
        requesting = false;
        report("unsupported");
      });
  };
  claim();
  return {
    retry: claim,
    dispose: () => {
      disposed = true;
      release?.();
    },
  };
}
