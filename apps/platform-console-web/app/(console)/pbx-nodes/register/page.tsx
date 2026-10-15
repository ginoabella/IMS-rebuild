import Link from 'next/link';
import { PbxForm } from '../../../pbx/form';
export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <div className="max-w-2xl space-y-5">
      <Link className="text-primary underline" href="/pbx-nodes">
        Back to PBX nodes
      </Link>
      <h1 className="font-display text-3xl font-semibold">Register PBX node</h1>
      <PbxForm />
    </div>
  );
}
