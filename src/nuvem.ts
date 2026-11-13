import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { definir, lerEstado, limparLocal, registrarAoMudar, type Acerto, type Cartao, type Compra, type Conta, type Estado, type Gasto, type Meta, type Quem } from './store'
import type { Categoria } from './categorias'

/**
 * Sincronização entre computadores (opcional), sem login.
 *
 * Sem as variáveis VITE_SUPABASE_* o app roda em modo local, só neste navegador.
 * Com elas, os dados ficam no Supabase sob um "código da casa": quem digita o
 * código neste computador passa a ver e editar a mesma casa.
 *
 * O estado é guardado em três documentos ('casa', 'eu', 'par') para que cada
 * pessoa possa lançar no próprio perfil sem sobrescrever o que a outra acabou de
 * lançar. A separação do que cada um vê é feita na tela, pelo perfil escolhido.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const supabase = url && chave ? createClient(url, chave) : null

const CHAVE_CASA = 'financas-casa'

export interface Nuvem {
  status: 'local' | 'carregando' | 'sem-casa' | 'offline' | 'pronto'
  codigo?: string
  erro?: string
}

let nuvem: Nuvem = { status: supabase ? 'carregando' : 'local' }
const ouvintes = new Set<() => void>()

function mudar(n: Partial<Nuvem>) {
  nuvem = { ...nuvem, ...n }
  ouvintes.forEach((o) => o())
}

export function useNuvem() {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o)
      return () => ouvintes.delete(o)
    },
    () => nuvem,
  )
}

// ---- formato dos documentos ----

type Parte = 'casa' | 'eu' | 'par'
const PARTES: Parte[] = ['casa', 'eu', 'par']
type Pagos = Record<string, string[]>

interface DocCasa {
  nomes?: { eu: string; par: string }
  contas?: Conta[]
  pagos?: Pagos
  metas?: Meta[]
  acertos?: Record<string, Acerto>
}

interface DocPessoa {
  salario?: number
  diaADia?: number
  contas?: Conta[]
  cartoes?: Cartao[]
  compras?: Compra[]
  metas?: Meta[]
  gastos?: Gasto[]
  regras?: Record<string, Categoria>
  pagos?: Pagos
}

interface Docs {
  casa: DocCasa
  eu: DocPessoa
  par: DocPessoa
}

interface Linha {
  parte: Parte
  dados: DocCasa & DocPessoa
  atualizado_em: string
}

function filtrarPagos(pagos: Pagos, manter: (id: string) => boolean) {
  const r: Pagos = {}
  for (const [mes, ids] of Object.entries(pagos)) {
    const f = ids.filter(manter)
    if (f.length) r[mes] = f
  }
  return r
}

/** Divide o estado nos três documentos. */
function separar(e: Estado): Docs {
  const casa = e.contas.filter((x) => x.tipo === 'casa')
  const idsCasa = new Set(casa.map((x) => x.id))
  const pessoa = (q: Quem): DocPessoa => {
    const contas = e.contas.filter((x) => x.tipo === 'pessoal' && x.pagador === q)
    const cartoes = e.cartoes.filter((x) => x.dono === q)
    const idsCartoes = new Set(cartoes.map((x) => x.id))
    const ids = new Set([
      ...contas.map((x) => x.id),
      ...cartoes.map((x) => 'fatura:' + x.id),
      // contas conjuntas: cada pessoa marca a própria metade como paga
      ...casa.map((x) => x.id + ':' + q),
    ])
    return {
      salario: q === 'eu' ? e.salario : e.salarioPar,
      diaADia: q === 'eu' ? e.diaADia : e.diaADiaPar,
      contas,
      cartoes,
      compras: e.compras.filter((x) => idsCartoes.has(x.cartaoId)),
      metas: e.metas.filter((x) => x.dono === q),
      gastos: e.gastos.filter((x) => x.dono === q),
      regras: e.regras[q] ?? {},
      pagos: filtrarPagos(e.pagos, (id) => ids.has(id)),
    }
  }
  return {
    casa: {
      nomes: { eu: e.nomeEu, par: e.nomePar },
      contas: casa,
      pagos: filtrarPagos(e.pagos, (id) => idsCasa.has(id)),
      metas: e.metas.filter((x) => x.dono === 'casa'),
      acertos: e.acertos,
    },
    eu: pessoa('eu'),
    par: pessoa('par'),
  }
}

/** Monta o estado a partir dos três documentos; perfil e tema são deste computador. */
function juntar(d: Docs, base: Estado): Estado {
  const pagos: Pagos = {}
  for (const origem of [d.casa.pagos, d.eu.pagos, d.par.pagos]) {
    for (const [mes, ids] of Object.entries(origem ?? {})) pagos[mes] = [...(pagos[mes] ?? []), ...ids]
  }
  return {
    perfil: base.perfil,
    tema: base.tema,
    nomeEu: d.casa.nomes?.eu ?? 'Pessoa 1',
    nomePar: d.casa.nomes?.par ?? 'Pessoa 2',
    salario: d.eu.salario ?? 0,
    salarioPar: d.par.salario ?? 0,
    diaADia: d.eu.diaADia ?? 0,
    diaADiaPar: d.par.diaADia ?? 0,
    contas: [...(d.casa.contas ?? []), ...(d.eu.contas ?? []), ...(d.par.contas ?? [])],
    cartoes: [...(d.eu.cartoes ?? []), ...(d.par.cartoes ?? [])],
    compras: [...(d.eu.compras ?? []), ...(d.par.compras ?? [])],
    gastos: [...(d.eu.gastos ?? []), ...(d.par.gastos ?? [])],
    regras: { eu: d.eu.regras ?? {}, par: d.par.regras ?? {} },
    metas: [...(d.casa.metas ?? []), ...(d.eu.metas ?? []), ...(d.par.metas ?? [])],
    acertos: d.casa.acertos ?? {},
    pagos,
  }
}

// ---- sincronização ----

let codigo = ''
/** carimbo do servidor da última versão conhecida de cada documento */
let visto: Partial<Record<Parte, string>> = {}
/** conteúdo (JSON) de cada documento na última vez em que estava igual ao servidor */
let ultimo: Partial<Record<Parte, string>> = {}
let temporizador: number | undefined
let canal: RealtimeChannel | undefined

async function buscar(cod: string): Promise<Linha[]> {
  const r = await supabase!.rpc('ler_casa', { p_codigo: cod })
  if (r.error) throw r.error
  return r.data as Linha[]
}

/** Traz para a tela o que mudou no servidor, sem atropelar edição local ainda não enviada. */
function aplicarRemoto(linhas: Linha[]) {
  const local = separar(lerEstado())
  const docs: Docs = { ...local }
  const aplicadas: Parte[] = []
  for (const l of linhas) {
    if (l.atualizado_em === visto[l.parte]) continue
    const pendente = visto[l.parte] !== undefined && JSON.stringify(local[l.parte]) !== ultimo[l.parte]
    if (pendente) continue
    docs[l.parte] = l.dados
    visto[l.parte] = l.atualizado_em
    aplicadas.push(l.parte)
  }
  if (!aplicadas.length) return
  definir(juntar(docs, lerEstado()))
  const novo = separar(lerEstado())
  for (const p of aplicadas) ultimo[p] = JSON.stringify(novo[p])
}

async function atualizar() {
  if (nuvem.status !== 'pronto') return
  try {
    aplicarRemoto(await buscar(codigo))
  } catch {
    /* sem conexão agora: tenta de novo na próxima vez */
  }
}

/** Envia os documentos que mudaram desde a última sincronização. */
async function enviar() {
  temporizador = undefined
  if (!supabase || !codigo) return
  const docs = separar(lerEstado())
  let enviou = false
  try {
    for (const p of PARTES) {
      const json = JSON.stringify(docs[p])
      if (json === ultimo[p]) continue
      const r = await supabase.rpc('salvar_parte', { p_codigo: codigo, p_parte: p, p_dados: docs[p] })
      if (r.error) throw r.error
      ultimo[p] = json
      visto[p] = r.data as string
      enviou = true
    }
    if (enviou) void canal?.send({ type: 'broadcast', event: 'mudou', payload: {} })
    if (nuvem.erro) mudar({ erro: undefined })
  } catch (err) {
    mudar({ erro: 'Não foi possível salvar na nuvem (' + (err as Error).message + '). Tentaremos de novo.' })
  }
}

async function conectar(cod: string) {
  mudar({ status: 'carregando', erro: undefined })
  let linhas: Linha[]
  try {
    linhas = await buscar(cod)
  } catch (err) {
    return mudar({ status: 'offline', codigo: cod, erro: 'Não foi possível conectar: ' + (err as Error).message })
  }
  if (!linhas.length) return mudar({ status: 'sem-casa', codigo: undefined, erro: 'Código não encontrado.' })

  codigo = cod
  visto = {}
  ultimo = {}
  aplicarRemoto(linhas)
  try {
    localStorage.setItem(CHAVE_CASA, cod)
  } catch {
    /* sem storage: vai pedir o código de novo na próxima vez */
  }

  void canal?.unsubscribe()
  // aviso em tempo real: quando o outro salva, buscamos a versão nova
  canal = supabase!.channel('casa-' + cod).on('broadcast', { event: 'mudou' }, () => void atualizar()).subscribe()
  mudar({ status: 'pronto', codigo: cod, erro: undefined })
}

if (supabase) {
  registrarAoMudar(() => {
    if (nuvem.status !== 'pronto') return
    clearTimeout(temporizador)
    temporizador = window.setTimeout(enviar, 600)
  })

  // ao voltar para a aba ou para a internet: busca novidades e reenvia o que ficou pendente
  const retomar = async () => {
    if (document.visibilityState !== 'visible' || nuvem.status !== 'pronto') return
    await atualizar()
    if (temporizador === undefined) await enviar()
  }
  document.addEventListener('visibilitychange', retomar)
  window.addEventListener('online', retomar)

  let salvo: string | null = null
  try {
    salvo = localStorage.getItem(CHAVE_CASA)
  } catch {
    /* sem storage */
  }
  if (salvo) void conectar(salvo)
  else nuvem = { status: 'sem-casa' }
}

// ---- ações ----

function gerarCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O e 1/I para não confundir
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const txt = Array.from(bytes, (b) => letras[b % letras.length]).join('')
  return txt.slice(0, 4) + '-' + txt.slice(4, 8) + '-' + txt.slice(8)
}

const normalizar = (txt: string) => txt.trim().toUpperCase().replace(/\s+/g, '')

/** Cria a casa e sobe para ela os dados que estavam neste navegador. */
export async function criarCasa() {
  if (!supabase) return
  mudar({ status: 'carregando', erro: undefined })
  const novo = gerarCodigo()
  const r = await supabase.rpc('criar_casa', { p_codigo: novo })
  if (r.error) return mudar({ status: 'sem-casa', erro: 'Não foi possível criar a casa: ' + r.error.message })
  codigo = novo
  ultimo = {}
  await enviar()
  await conectar(novo)
}

/** Liga este computador a uma casa que já existe. Quem entra por código começa como a segunda pessoa. */
export async function entrarNaCasa(txt: string) {
  if (!supabase) return
  definir({ ...lerEstado(), perfil: 'par' })
  await conectar(normalizar(txt))
}

export const tentarDeNovo = () => (nuvem.codigo ? conectar(nuvem.codigo) : undefined)

/** Tira a casa deste computador (os dados continuam na nuvem). */
export async function desconectar() {
  if (temporizador !== undefined) {
    clearTimeout(temporizador)
    await enviar()
  }
  try {
    localStorage.removeItem(CHAVE_CASA)
  } catch {
    /* nada a limpar */
  }
  limparLocal()
  location.reload()
}
