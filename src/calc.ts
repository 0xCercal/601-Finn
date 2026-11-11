import type { Estado, Quem } from './store'

const soma = (l: { valor: number }[]) => l.reduce((s, c) => s + c.valor, 0)

export interface ItemAPagar {
  id: string
  nome: string
  valor: number
  dia: number
  pago: boolean
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
 */
export function resumo(e: Estado, mes: string) {
  const v = visao(e)
  const casa = e.contas.filter((c) => c.tipo === 'casa')
  const pess = e.contas.filter((c) => c.tipo === 'pessoal' && c.pagador === v.eu)

  const totalCasa = soma(casa)
  const metade = totalCasa / 2
  const pagoEu = soma(casa.filter((c) => c.pagador === v.eu))
  const pagoPar = totalCasa - pagoEu
  /** > 0: o outro me devolve; < 0: eu devolvo */
  const acerto = pagoEu - metade

  const faturas = e.cartoes.filter((c) => c.dono === v.eu).map((c) => ({ cartao: c, valor: c.faturas[mes] ?? 0 }))
  const totalFaturas = soma(faturas)
  const pessoais = soma(pess) + totalFaturas
  const sobra = v.salario - metade - pessoais - v.diaADia

  const pagos = e.pagos[mes] ?? []
  const itens: ItemAPagar[] = [
    ...casa.filter((c) => c.pagador === v.eu),
    ...pess,
    ...faturas
      .filter((f) => f.valor > 0)
      .map((f) => ({ id: 'fatura:' + f.cartao.id, nome: 'Fatura ' + f.cartao.nome, valor: f.valor, dia: f.cartao.diaVence })),
  ]
    .map((c) => ({ id: c.id, nome: c.nome, valor: c.valor, dia: c.dia, pago: pagos.includes(c.id) }))
    .sort((a, b) => a.dia - b.dia)

  const moradia = soma(casa.filter((c) => c.moradia)) / 2 + soma(pess.filter((c) => c.moradia))

  return {
    ...v,
    casa, totalCasa, metade, pagoEu, pagoPar, acerto,
    faturas, totalFaturas, pessoais, sobra,
    itens, pendente: soma(itens.filter((i) => !i.pago)),
    moradia,
  }
}
