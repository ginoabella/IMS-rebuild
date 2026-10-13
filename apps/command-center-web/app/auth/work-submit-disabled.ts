export async function submitFixture(): Promise<Response> {
  return Response.json(
    { message: 'Access denied' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}
