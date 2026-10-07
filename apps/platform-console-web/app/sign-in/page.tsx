import { SignIn } from '../auth/sign-in';
import { consoleReturnPath } from '../auth/return-path';
export const dynamic = 'force-dynamic';
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-md p-6 pt-16">
      <SignIn onDestination={consoleReturnPath(params.returnTo)} />
    </main>
  );
}
