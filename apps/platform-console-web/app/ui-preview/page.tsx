import { UiPreview } from '@myims/ui-web';

export default function PreviewPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-subtle">
          Shared visual system
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">UI preview</h1>
      </div>
      <UiPreview />
    </div>
  );
}
