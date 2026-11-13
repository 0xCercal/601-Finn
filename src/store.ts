import { useSyncExternalStore } from 'react'
import type { Categoria } from './categorias'

export type Quem = 'eu' | 'par'

export interface Conta {
  id: string
  nome: string
  /** valor padrão de todo mês */
  valor: number
  /** dia do vencimento (1–31) */
  dia: number
  /** 'casa' é dividida meio a meio; 'pessoal' é só de uma pessoa */
  tipo: 'casa' | 'pessoal'
  /** conta da casa: quem efetivamente paga; conta pessoal: de quem ela é (só essa pessoa vê) */
  pagador: Quem
  /** entra no cálculo de custo de moradia */
  moradia: boolean
  /** lançamento avulso: só existe neste mês ('AAAA-MM'). Sem isso, repete todo mês. */
  mes?: string
  /** valor diferente do padrão em meses específicos ('AAAA-MM'); numa conta variável, o valor real do mês */
  ajustes?: Record<string, number>
  /** conta da casa: 'meio' divide igual; 'eu'/'par' fica inteira com essa pessoa. Sem isso, meio a meio. */
  divisao?: 'meio' | Quem
  /** conta meio a meio paga por conta conjunta: cada um paga a própria metade, sem acerto entre os dois */
  conjunta?: boolean
  /** o valor muda todo mês (luz, gás): o padrão é só estimativa até informar o valor do mês */
  variavel?: boolean
}

export interface Cartao {
  id: string
  /** de quem é o cartão (só essa pessoa vê) */
  dono: Quem
  nome: string
  cor: string
  limite: number
  diaVence: number
  /** gastos não detalhados da fatura, por mês ('AAAA-MM'); somam com as compras lançadas */
  faturas: Record<string, number>
}

/** Compra no cartão, à vista (1 parcela) ou parcelada. */
export interface Compra {
  id: string
  cartaoId: string
  descricao: string
  /** valor total da compra */
  valor: number
  parcelas: number
  /** mês da fatura em que cai a primeira parcela ('AAAA-MM') */
  mes: string
  /** chave do lançamento importado de uma fatura, para não importar duas vezes */
  origem?: string
  /** categoria escolhida só para esta compra (senão vale a regra ou a automática) */
  categoria?: Categoria
}

/**
 * Caixinha de poupança (como as do banco), da casa ou de uma pessoa.
 * Saldo = `guardado` (base informada) + depósitos lançados como gasto com forma 'caixinha'.
 */
export interface Meta {
  id: string
  nome: string
  /** meta a alcançar; 0 = sem meta */
  alvo: number
  /** saldo base, sem contar os depósitos lançados no app */
  guardado: number
  /** quanto se pretende guardar por mês (só para a previsão) */
  aporte: number
  dono: Quem | 'casa'
}

export type Forma = 'pix' | 'debito' | 'dinheiro' | 'caixinha'

/** Gasto do dia a dia (Pix, débito, dinheiro). É pessoal: só o dono vê. */
export interface Gasto {
  id: string
  descricao: string
  valor: number
  /** 'AAAA-MM-DD' */
  data: string
  forma: Forma
  dono: Quem
  /** depósito (ou retirada, se negativo) numa caixinha */
  metaId?: string
  /** categoria escolhida só para este gasto */
  categoria?: Categoria
}

/** Registro de que o acerto da divisão da casa de um mês foi feito. */
export interface Acerto {
  valor: number
  de: Quem
  para: Quem
  /** data em que foi marcado ('AAAA-MM-DD') */
  em: string
}

export interface Estado {
  nomeEu: string
  nomePar: string
  salario: number
  salarioPar: number
  diaADia: number
  diaADiaPar: number
  /** quem está usando o app agora */
  perfil: Quem
  contas: Conta[]
  cartoes: Cartao[]
  compras: Compra[]
  metas: Meta[]
  gastos: Gasto[]
  /** categoria aprendida por estabelecimento, de cada pessoa */
  regras: Record<Quem, Record<string, Categoria>>
  /** ids pagos por mês ('AAAA-MM') */
  pagos: Record<string, string[]>
  /** acerto da casa por mês ('AAAA-MM') */
  acertos: Record<string, Acerto>
  tema: 'claro' | 'escuro'
}

const CHAVE = 'financas-v1'

export const novoId = () => crypto.randomUUID()

const formatar = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export const mesAtual = () => formatar(new Date())

/** Data de hoje no fuso local, 'AAAA-MM-DD'. */
export const hojeISO = () => formatar(new Date()) + '-' + String(new Date().getDate()).padStart(2, '0')

export function somaMes(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number)
  return formatar(new Date(a, m - 1 + n, 1))
}

/** Quantos meses vão de `de` até `ate` (negativo se `ate` vem antes). */
export function difMeses(de: string, ate: string) {
  const [a1, m1] = de.split('-').map(Number)
  const [a2, m2] = ate.split('-').map(Number)
  return (a2 - a1) * 12 + (m2 - m1)
}

function exemplo(): Estado {
  const m = mesAtual()
  const conta = (nome: string, valor: number, dia: number, tipo: Conta['tipo'], pagador: Quem, moradia = false): Conta => ({
    id: novoId(), nome, valor, dia, tipo, pagador, moradia,
  })
  const principal = novoId()
  const viagem = novoId()
  return {
    nomeEu: 'Pessoa 1',
    nomePar: 'Pessoa 2',
    salario: 9000,
    salarioPar: 8000,
    diaADia: 500,
    diaADiaPar: 400,
    perfil: 'eu',
    contas: [
      conta('Aluguel', 2400, 1, 'casa', 'par', true),
      conta('Condomínio', 650, 5, 'casa', 'eu', true),
      conta('Luz', 220, 10, 'casa', 'eu', true),
      conta('Internet', 119.9, 12, 'casa', 'eu', true),
      conta('Mercado', 1400, 15, 'casa', 'eu'),
      conta('Guardar na reserva', 1000, 5, 'pessoal', 'eu'),
      conta('Academia', 129.9, 8, 'pessoal', 'eu'),
      conta('Curso de inglês', 350, 10, 'pessoal', 'par'),
      conta('Plano de saúde', 480, 20, 'pessoal', 'par'),
    ],
    cartoes: [
      { id: principal, dono: 'eu', nome: 'Cartão principal', cor: '#1f2937', limite: 12000, diaVence: 5, faturas: { [m]: 850.4 } },
      { id: novoId(), dono: 'eu', nome: 'Cartão reserva', cor: '#ea580c', limite: 5000, diaVence: 12, faturas: { [m]: 410 } },
      { id: novoId(), dono: 'par', nome: 'Cartão roxo', cor: '#7c3aed', limite: 8000, diaVence: 15, faturas: { [m]: 960 } },
    ],
    compras: [
      { id: novoId(), cartaoId: principal, descricao: 'Notebook', valor: 3600, parcelas: 10, mes: somaMes(m, -2) },
      { id: novoId(), cartaoId: principal, descricao: 'Tênis', valor: 480, parcelas: 3, mes: m },
    ],
    metas: [
      { id: viagem, nome: 'Viagem de férias', alvo: 8000, guardado: 2500, aporte: 500, dono: 'casa' },
      { id: novoId(), nome: 'Reserva de emergência', alvo: 20000, guardado: 6000, aporte: 1000, dono: 'eu' },
    ],
    gastos: [
      { id: novoId(), descricao: 'Padaria', valor: 23.5, data: m + '-02', forma: 'pix', dono: 'eu' },
      { id: novoId(), descricao: 'Farmácia', valor: 48.9, data: m + '-05', forma: 'debito', dono: 'eu' },
      { id: novoId(), descricao: 'Feira', valor: 62, data: m + '-08', forma: 'dinheiro', dono: 'eu' },
      { id: novoId(), descricao: '', valor: 300, data: m + '-10', forma: 'caixinha', dono: 'eu', metaId: viagem },
    ],
    regras: { eu: {}, par: {} },
    pagos: {},
    acertos: {},
    tema: 'claro',
  }
}

function carregar(): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) {
      const salvo = JSON.parse(bruto) as Partial<Estado>
      const e: Estado = {
        ...exemplo(),
        ...salvo,
        // dados salvos antes de estas listas existirem: começam vazias, não com exemplos
        compras: salvo.compras ?? [],
        metas: salvo.metas ?? [],
        acertos: salvo.acertos ?? {},
        gastos: salvo.gastos ?? [],
        regras: salvo.regras ?? { eu: {}, par: {} },
      }
      e.cartoes = e.cartoes.map((c) => ({ ...c, dono: c.dono ?? 'eu' }))
      if (e.nomeEu === 'Você') e.nomeEu = 'Pessoa 1'
      if (e.nomePar === 'Parceiro(a)') e.nomePar = 'Pessoa 2'
      return e
    }
  } catch {
    /* dados corrompidos ou storage indisponível: começa do exemplo */
  }
  return exemplo()
}

let estado = carregar()
const ouvintes = new Set<() => void>()
let aoMudar: (() => void) | undefined

/** A sincronização se registra aqui para saber quando há mudança local a enviar. */
export function registrarAoMudar(fn: () => void) {
  aoMudar = fn
}

export const lerEstado = () => estado

/** Troca o estado inteiro (dados vindos da nuvem), sem disparar envio. */
export function definir(e: Estado) {
  estado = e
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado))
  } catch {
    /* sem storage: segue só em memória */
  }
  ouvintes.forEach((o) => o())
}

export function alterar(fn: (e: Estado) => Estado) {
  definir(fn(estado))
  aoMudar?.()
}

export function limparLocal() {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    /* nada a limpar */
  }
}

export function useEstado() {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o)
      return () => ouvintes.delete(o)
    },
    () => estado,
  )
}

// ---- ações ----

/** Insere o item na lista ou substitui o que tem o mesmo id. */
function gravar<T extends { id: string }>(lista: T[], item: T) {
  return lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [...lista, item]
}

export const salvarConta = (c: Conta) => alterar((e) => ({ ...e, contas: gravar(e.contas, c) }))
export const excluirConta = (id: string) => alterar((e) => ({ ...e, contas: e.contas.filter((c) => c.id !== id) }))

export const salvarCartao = (c: Cartao) => alterar((e) => ({ ...e, cartoes: gravar(e.cartoes, c) }))
export const excluirCartao = (id: string) =>
  alterar((e) => ({
    ...e,
    cartoes: e.cartoes.filter((c) => c.id !== id),
    compras: e.compras.filter((c) => c.cartaoId !== id),
  }))

export const salvarCompra = (c: Compra) => alterar((e) => ({ ...e, compras: gravar(e.compras, c) }))
/** Adiciona compras importadas de uma fatura; opcionalmente zera os "outros gastos" daquele mês. */
export function importarCompras(cartaoId: string, novas: Compra[], zerarOutrosEm?: string) {
  alterar((e) => ({
    ...e,
    compras: [...e.compras, ...novas],
    cartoes: zerarOutrosEm
      ? e.cartoes.map((c) => (c.id === cartaoId ? { ...c, faturas: { ...c.faturas, [zerarOutrosEm]: 0 } } : c))
      : e.cartoes,
  }))
}

/**
 * Move para `delta` meses depois as compras importadas que aparecem na fatura de `mes`
 * (corrige uma fatura importada no mês errado).
 */
export function moverImportados(cartaoId: string, mes: string, delta: number) {
  alterar((e) => ({
    ...e,
    compras: e.compras.map((c) => {
      const d = difMeses(c.mes, mes)
      if (c.cartaoId !== cartaoId || !c.origem || d < 0 || d >= c.parcelas) return c
      const novoMes = somaMes(c.mes, delta)
      // a chave das parceladas guarda o mês de início; atualiza para a reimportação reconhecer
      const origem = c.origem.startsWith('parc|') ? c.origem.replace('|' + c.mes + '|', '|' + novoMes + '|') : c.origem
      return { ...c, mes: novoMes, origem }
    }),
  }))
}

export const excluirCompra = (id: string) => alterar((e) => ({ ...e, compras: e.compras.filter((c) => c.id !== id) }))

export const salvarMeta = (m: Meta) => alterar((e) => ({ ...e, metas: gravar(e.metas, m) }))
export const excluirMeta = (id: string) => alterar((e) => ({ ...e, metas: e.metas.filter((m) => m.id !== id) }))

/** Define a categoria de uma compra ou gasto; com `todas`, aprende para o estabelecimento inteiro. */
export function definirCategoria(tipo: 'compra' | 'gasto', id: string, categoria: Categoria, todas: { dono: Quem; chave: string } | null) {
  const aplicar = <T extends { id: string; categoria?: Categoria }>(lista: T[]) =>
    // aprendendo para todas, o item segue a regra; senão guarda a escolha só nele
    lista.map((x) => (x.id !== id ? x : todas ? { ...x, categoria: undefined } : { ...x, categoria }))
  alterar((e) => ({
    ...e,
    compras: tipo === 'compra' ? aplicar(e.compras) : e.compras,
    gastos: tipo === 'gasto' ? aplicar(e.gastos) : e.gastos,
    regras: todas ? { ...e.regras, [todas.dono]: { ...e.regras[todas.dono], [todas.chave]: categoria } } : e.regras,
  }))
}

export const salvarGasto = (g: Gasto) => alterar((e) => ({ ...e, gastos: gravar(e.gastos, g) }))
export const excluirGasto = (id: string) => alterar((e) => ({ ...e, gastos: e.gastos.filter((g) => g.id !== id) }))

export function alternarPago(mes: string, id: string) {
  alterar((e) => {
    const atual = e.pagos[mes] ?? []
    const novo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    return { ...e, pagos: { ...e.pagos, [mes]: novo } }
  })
}

/** Marca (ou, com null, desmarca) o acerto da casa de um mês. */
export function marcarAcerto(mes: string, acerto: Acerto | null) {
  alterar((e) => {
    const acertos = { ...e.acertos }
    if (acerto) acertos[mes] = acerto
    else delete acertos[mes]
    return { ...e, acertos }
  })
}

export function trocarPerfil(perfil?: Quem) {
  alterar((e) => ({ ...e, perfil: perfil ?? (e.perfil === 'eu' ? 'par' : 'eu') }))
}

export function zerarTudo() {
  alterar((e) => ({ ...e, contas: [], cartoes: [], compras: [], metas: [], gastos: [], pagos: {}, acertos: {} }))
}
