import { useSyncExternalStore } from 'react'

export type Quem = 'eu' | 'par'

export interface Conta {
  id: string
  nome: string
  valor: number
  /** dia do vencimento (1–31) */
  dia: number
  /** 'casa' é dividida meio a meio; 'pessoal' é só minha */
  tipo: 'casa' | 'pessoal'
  /** conta da casa: quem efetivamente paga; conta pessoal: de quem ela é (só essa pessoa vê) */
  pagador: Quem
  /** entra no cálculo de custo de moradia */
  moradia: boolean
}

export interface Cartao {
  id: string
  /** de quem é o cartão (só essa pessoa vê) */
  dono: Quem
  nome: string
  cor: string
  limite: number
  diaVence: number
  /** valor da fatura por mês ('AAAA-MM') */
  faturas: Record<string, number>
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
  /** ids pagos por mês ('AAAA-MM') */
  pagos: Record<string, string[]>
  tema: 'claro' | 'escuro'
}

const CHAVE = 'financas-v1'

export const novoId = () => crypto.randomUUID()

export function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function somaMes(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function exemplo(): Estado {
  const m = mesAtual()
  const conta = (nome: string, valor: number, dia: number, tipo: Conta['tipo'], pagador: Quem, moradia = false): Conta => ({
    id: novoId(), nome, valor, dia, tipo, pagador, moradia,
  })
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
      { id: novoId(), dono: 'eu', nome: 'Cartão principal', cor: '#1f2937', limite: 12000, diaVence: 5, faturas: { [m]: 1850.4, [somaMes(m, 1)]: 1320, [somaMes(m, 2)]: 780 } },
      { id: novoId(), dono: 'eu', nome: 'Cartão reserva', cor: '#ea580c', limite: 5000, diaVence: 12, faturas: { [m]: 410 } },
      { id: novoId(), dono: 'par', nome: 'Cartão roxo', cor: '#7c3aed', limite: 8000, diaVence: 15, faturas: { [m]: 960 } },
    ],
    pagos: {},
    tema: 'claro',
  }
}

function carregar(): Estado {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) {
      const e: Estado = { ...exemplo(), ...JSON.parse(bruto) }
      // dados salvos antes de existirem perfis
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

export function salvarConta(c: Conta) {
  alterar((e) => ({
    ...e,
    contas: e.contas.some((x) => x.id === c.id) ? e.contas.map((x) => (x.id === c.id ? c : x)) : [...e.contas, c],
  }))
}

export function excluirConta(id: string) {
  alterar((e) => ({ ...e, contas: e.contas.filter((c) => c.id !== id) }))
}

export function salvarCartao(c: Cartao) {
  alterar((e) => ({
    ...e,
    cartoes: e.cartoes.some((x) => x.id === c.id) ? e.cartoes.map((x) => (x.id === c.id ? c : x)) : [...e.cartoes, c],
  }))
}

export function excluirCartao(id: string) {
  alterar((e) => ({ ...e, cartoes: e.cartoes.filter((c) => c.id !== id) }))
}

export function alternarPago(mes: string, id: string) {
  alterar((e) => {
    const atual = e.pagos[mes] ?? []
    const novo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    return { ...e, pagos: { ...e.pagos, [mes]: novo } }
  })
}

export function trocarPerfil(perfil?: Quem) {
  alterar((e) => ({ ...e, perfil: perfil ?? (e.perfil === 'eu' ? 'par' : 'eu') }))
}

export function zerarTudo() {
  alterar((e) => ({ ...e, contas: [], cartoes: [], pagos: {} }))
}
