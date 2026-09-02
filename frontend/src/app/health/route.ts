export function GET() {
  return Response.json({ status: 'ok' });
}

export function HEAD() {
  return new Response(null, { status: 200 });
}
