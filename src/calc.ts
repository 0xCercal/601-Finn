import { categoriaDe, ORDEM_CATEGORIAS, type Categoria } from './categorias'
import { difMeses, mesAtual, type Cartao, type Compra, type Conta, type Estado, type Meta, type Quem } from './store'

const soma = (l: { valor: number }[]) => l.reduce((s, c) => s + c.valor, 0)

export interface ItemAPagar {
  id: string
  nome: string
  valor: number
  dia: number
  pago: boolean
  /** valor ainda é estimativa (conta variável sem o valor do mês) */
  estimado: boolean
}

/**
 * Valor da conta num mês: o informado para aquele mês, se houver. Senão, para conta
 * variável, a média dos últimos 3 meses informados; para as demais, o valor padrão.
 */
export function valorNoMes(c: Conta, mes: string) {
  const real = c.ajustes?.[mes]
  if (real !== undefined) return real
  if (!c.variavel) return c.valor
  const anteriores = Object.entries(c.ajustes ?? {})
    .filter(([m]) => m < mes)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3)
    .map(([, v]) => v)
  return anteriores.length ? anteriores.reduce((s, v) => s + v, 0) / anteriores.length : c.valor
}

/** Conta variável cujo valor do mês ainda não foi informado. */
export const estimadoNoMes = (c: Conta, mes: string) => Boolean(c.variavel) && !c.mes && c.ajustes?.[mes] === undefined

/** Quem paga a conta da casa: se ela é só de uma pessoa, essa pessoa; senão, quem foi escolhido. */
export const pagadorDe = (c: Conta) => (c.divisao && c.divisao !== 'meio' ? c.divisao : c.pagador)

/** Quanto de uma conta da casa cabe a uma pessoa (usa `c.valor`, que pode já ser o valor do mês). */
export function parteDe(c: Conta, q: Quem) {
  const d = c.divisao ?? 'meio'
  return d === 'meio' ? c.valor / 2 : d === q ? c.valor : 0
}

/** Soma dos depósitos lançados numa caixinha (todos, ou só os de um mês 'AAAA-MM'). */
export const depositosDaCaixinha = (e: Estado, metaId: string, mes?: string) =>
  e.gastos.filter((g) => g.metaId === metaId && (!mes || g.data.startsWith(mes))).reduce((s, g) => s + g.valor, 0)

/** Saldo da caixinha: base informada + depósitos lançados. */
export const saldoDaCaixinha = (e: Estado, m: Meta) => m.guardado + depositosDaCaixinha(e, m.id)

/** Contas que existem no mês: as recorrentes e os lançamentos avulsos daquele mês. */
export const contasDoMes = (e: Estado, mes: string) => e.contas.filter((c) => !c.mes || c.mes === mes)

/**
 * Mês da fatura em que cai uma compra feita em `data` ('AAAA-MM-DD').
 * A fatura fecha cerca de 7 dias antes do vencimento, então a compra vai para o primeiro
 * vencimento que esteja pelo menos 7 dias depois dela (normalmente o mês seguinte).
 */
export function mesDaFatura(data: string, diaVence: number) {
  const [a, m, d] = data.split('-').map(Number)
  const limite = new Date(a, m - 1, d + 7)
  for (let i = 0; i < 2; i++) {
    const ano = limite.getFullYear()
    const mes = limite.getMonth() + i
    const venc = new Date(ano, mes, Math.min(diaVence, new Date(ano, mes + 1, 0).getDate()))
    if (venc >= limite) return `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, '0')}`
  }
  return `${limite.getFullYear()}-${String(limite.getMonth() + 2).padStart(2, '0')}`
}

/** Parcela de uma compra que cai na fatura do mês, ou null se não cai nenhuma. */
export function parcelaNoMes(c: Compra, mes: string) {
  const d = difMeses(c.mes, mes)
  return d >= 0 && d < c.parcelas ? { n: d + 1, valor: c.valor / c.parcelas } : null
}

/** Fatura do cartão no mês: gastos não detalhados + parcelas das compras lançadas. */
export function faturaDoMes(e: Estado, cartao: Cartao, mes: string) {
  const base = cartao.faturas[mes] ?? 0
  const parcelas = e.compras
    .filter((c) => c.cartaoId === cartao.id)
    .flatMap((compra) => {
      const p = parcelaNoMes(compra, mes)
      return p ? [{ compra, ...p }] : []
    })
  return { base, parcelas, total: base + soma(parcelas) }
}

/** Limite ainda livre: desconta a fatura do mês e todas as parcelas que ainda vão cair. */
export function limiteLivre(e: Estado, cartao: Cartao, mes: string) {
  const comprometido = e.compras
    .filter((c) => c.cartaoId === cartao.id)
    .reduce((s, c) => {
      const d = difMeses(c.mes, mes)
      const restantes = d < 0 ? c.parcelas : Math.max(c.parcelas - d, 0)
      return s + (restantes * c.valor) / c.parcelas
    }, 0)
  return cartao.limite - (cartao.faturas[mes] ?? 0) - comprometido
}

/** Dias que ainda restam para gastar no mês (0 para meses que já passaram). */
export function diasParaGastar(mes: string) {
  const atual = mesAtual()
  const [a, m] = mes.split('-').map(Number)
  const noMes = new Date(a, m, 0).getDate()
  if (mes < atual) return 0
  if (mes > atual) return noMes
  return noMes - new Date().getDate() + 1
}

/** Quem está usando o app e os dados que são só dessa pessoa. */
export function visao(e: Estado) {
  const eu: Quem = e.perfil
  const outro: Quem = eu === 'eu' ? 'par' : 'eu'
  return {
    eu,
    outro,
    nome: eu === 'eu' ? e.nomeEu : e.nomePar,
    nomeOutro: eu === 'eu' ? e.nomePar : e.nomeEu,
    salario: eu === 'eu' ? e.salario : e.salarioPar,
    diaADia: eu === 'eu' ? e.diaADia : e.diaADiaPar,
  }
}

/**
 * Todos os números do mês do ponto de vista do perfil ativo.
 * Contas pessoais e cartões do outro perfil nunca entram aqui: a divisão da casa
 * só depende das contas da casa, então fecha igual para os dois sem expor nada.
 *
 * `extra` é um gasto pessoal hipotético somado ao mês (usado pelo simulador).
 */
export function resumo(e: Estado, mes: string, extra = 0) {
  const v = visao(e)
  const contas = contasDoMes(e, mes).map((c) => ({ ...c, valor: valorNoMes(c, mes), estimado: estimadoNoMes(c, mes) }))
  const casa = contas.filter((c) => c.tipo === 'casa')
  const pess = contas.filter((c) => c.tipo === 'pessoal' && c.pagador === v.eu)

  const totalCasa = soma(casa)
  /** quanto das contas da casa cabe a mim (metade das divididas + as que são só minhas) */
  const parteCasa = casa.reduce((s, c) => s + parteDe(c, v.eu), 0)
  const pagoEu = soma(casa.filter((c) => pagadorDe(c) === v.eu))
  const pagoPar = totalCasa - pagoEu
  /** > 0: o outro me devolve; < 0: eu devolvo */
  const acerto = pagoEu - parteCasa

  const faturas = e.cartoes.filter((c) => c.dono === v.eu).map((c) => ({ cartao: c, valor: faturaDoMes(e, c, mes).total }))
  const totalFaturas = soma(faturas)
  const pessoais = soma(pess) + totalFaturas + extra
  /** o que sobra do salário depois de todas as contas, antes da reserva do dia a dia */
  const livre = v.salario - parteCasa - pessoais
  const lancamentos = e.gastos.filter((g) => g.dono === v.eu && g.data.startsWith(mes)).sort((a, b) => b.data.localeCompare(a.data))
  const gastos = lancamentos.filter((g) => g.forma !== 'caixinha')
  const totalGastos = soma(gastos)
  /** o que foi para as caixinhas no mês: não consome a reserva, sai direto da sobra */
  const totalGuardado = soma(lancamentos.filter((g) => g.forma === 'caixinha'))
  /** a reserva do dia a dia é consumida pelos gastos lançados; o que passar dela sai da sobra */
  const diaADiaUsado = Math.max(v.diaADia, totalGastos)
  const sobra = livre - diaADiaUsado - totalGuardado
  /** o que ainda está livre agora: salário − contas − gastos já feitos */
  const disponivel = livre - totalGastos - totalGuardado

  const pagos = e.pagos[mes] ?? []
  const itens: ItemAPagar[] = [
    ...[...casa.filter((c) => pagadorDe(c) === v.eu), ...pess].map((c) => ({
      id: c.id, nome: c.nome, valor: c.valor, dia: c.dia, estimado: c.estimado,
    })),
    ...faturas
      .filter((f) => f.valor > 0)
      .map((f) => ({ id: 'fatura:' + f.cartao.id, nome: 'Fatura ' + f.cartao.nome, valor: f.valor, dia: f.cartao.diaVence, estimado: false })),
  ]
    .map((c) => ({ ...c, pago: pagos.includes(c.id) }))
    .sort((a, b) => a.dia - b.dia)

  const moradia = casa.filter((c) => c.moradia).reduce((s, c) => s + parteDe(c, v.eu), 0) + soma(pess.filter((c) => c.moradia))

  return {
    ...v,
    casa, totalCasa, parteCasa, pagoEu, pagoPar, acerto,
    faturas, totalFaturas, pessoais, livre, sobra,
    lancamentos, gastos, totalGastos, totalGuardado, diaADiaUsado, disponivel,
    itens, pendente: soma(itens.filter((i) => !i.pago)),
    moradia,
  }
}

export interface ItemCategoria {
  tipo: 'compra' | 'gasto'
  id: string
  descricao: string
  valor: number
  /** de onde veio: "Cartão principal · 3/10", "Pix"… */
  origem: string
  categoria: Categoria
}

const NOME_FORMA = { pix: 'Pix', debito: 'Débito', dinheiro: 'Dinheiro', caixinha: 'Caixinha' }

/**
 * Para onde foi o dinheiro do perfil ativo no mês: parcelas dos seus cartões + gastos do dia a dia,
 * agrupados por categoria. Créditos e estornos (valores negativos) ficam de fora; o "outros gastos"
 * não detalhado da fatura aparece à parte, porque não dá para saber a categoria.
 */
export function gastosPorCategoria(e: Estado, mes: string) {
  const eu = e.perfil
  const regras = e.regras[eu] ?? {}
  const itens: ItemCategoria[] = []
  let semDetalhe = 0

  for (const cartao of e.cartoes.filter((c) => c.dono === eu)) {
    const f = faturaDoMes(e, cartao, mes)
    semDetalhe += Math.max(f.base, 0)
    for (const p of f.parcelas) {
      if (p.valor <= 0) continue
      itens.push({
        tipo: 'compra',
        id: p.compra.id,
        descricao: p.compra.descricao,
        valor: p.valor,
        origem: cartao.nome + (p.compra.parcelas > 1 ? ` · parcela ${p.n} de ${p.compra.parcelas}` : ''),
        categoria: categoriaDe(p.compra, regras),
      })
    }
  }
  for (const g of e.gastos) {
    if (g.dono !== eu || g.forma === 'caixinha' || !g.data.startsWith(mes) || g.valor <= 0) continue
    itens.push({
      tipo: 'gasto',
      id: g.id,
      descricao: g.descricao || NOME_FORMA[g.forma],
      valor: g.valor,
      origem: NOME_FORMA[g.forma] + ' · ' + g.data.slice(8, 10) + '/' + g.data.slice(5, 7),
      categoria: categoriaDe(g, regras),
    })
  }

  const grupos = ORDEM_CATEGORIAS.map((categoria) => {
    const l = itens.filter((i) => i.categoria === categoria).sort((a, b) => b.valor - a.valor)
    return { categoria, total: soma(l), itens: l }
  })
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total)

  return { grupos, semDetalhe, total: soma(itens) + semDetalhe }
}
