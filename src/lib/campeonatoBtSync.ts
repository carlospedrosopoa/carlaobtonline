export async function syncFotoAtletaCampeonatoBt(params: { email?: string | null; fotoUrl?: string | null; playnaquadraAtletaId?: string | null }) {
  const base = (process.env.CAMPEONATOBT_API_URL || "").trim();
  const token = (process.env.CAMPEONATOBT_INTEGRATION_TOKEN || "").trim();
  const email = (params.email || "").trim().toLowerCase();
  const playnaquadraAtletaId = (params.playnaquadraAtletaId || "").trim();
  const fotoUrl = params.fotoUrl === null ? null : (params.fotoUrl || "").trim();

  if (!base || !token) return;
  if (!email && !playnaquadraAtletaId) return;

  const url = new URL("/api/v1/integracoes/carlaobtonline/atleta-foto", base).toString();
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-integration-token": token,
      },
      body: JSON.stringify({ email: email || undefined, playnaquadraAtletaId: playnaquadraAtletaId || undefined, fotoUrl }),
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    return;
  }
}

