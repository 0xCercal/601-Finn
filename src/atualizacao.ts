/**
 * Detecta quando uma versão nova do app foi publicada.
 *
 * Cada build grava um identificador em versao.json e dentro do próprio código (__VERSAO__).
 * Se o versao.json do site for diferente do código que está rodando, a aba está desatualizada
 * (comum no celular, que mantém a aba aberta por dias).
 */

declare const __VERSAO__: string

async function versaoPublicada(): Promise<string | null> {
  try {
    const r = await fetch('./versao.json?t=' + Date.now(), { cache: 'no-store' })
    if (!r.ok) return null
    return ((await r.json()) as { versao?: string }).versao ?? null
  } catch {
    return null // sem internet ou rodando em desenvolvimento
  }
}

/**
 * Ao abrir o app ou voltar para a aba, recarrega sozinho se houver versão nova.
 * Com a aba em uso, só chama `aviso` (para não recarregar no meio de um lançamento).
 */
export function vigiarAtualizacao(aviso: () => void) {
  const checar = async (recarregar: boolean) => {
    const v = await versaoPublicada()
    if (!v || v === __VERSAO__) return
    if (recarregar) location.reload()
    else aviso()
  }
  void checar(true)
  const aoVoltar = () => {
    if (document.visibilityState === 'visible') void checar(true)
  }
  document.addEventListener('visibilitychange', aoVoltar)
  const intervalo = window.setInterval(() => void checar(false), 5 * 60 * 1000)
  return () => {
    document.removeEventListener('visibilitychange', aoVoltar)
    clearInterval(intervalo)
  }
}
