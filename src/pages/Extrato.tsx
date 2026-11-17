import { parteDe, resumo } from '../calc'
import { TIPOS_ENTRADA } from '../Renda'
import { useEstado, type Quem } from '../store'
import { brl, nomeDoMes, pct, Valor } from '../ui'

interface Linha {
  id: string
  nome: string
  detalhe?: string
  valor: number
  estimado?: boolean
}

interface Grupo {
  titulo: string
  linhas: Linha[]
}

const total = (l: { valor: number }[]) => l.reduce((s, x) => s + x.valor, 0)
const dataCurta = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)

/**
 * Extrato do mês: tudo que entra e tudo que sai, agrupado.
 * A conta fecha com o Saldo previsto: entradas − saídas = sobra.
 */
export function Extrato({ mes }: { mes: string }) {
  const e = useEstado()
  const r = resumo(e, mes)
  const nomeDe = (q: Quem) => (q === 'eu' ? e.nomeEu : e.nomePar)
  const nomeCaixinha = (id?: string) => e.metas.find((m) => m.id === id)?.nome ?? 'caixinha removida'

  // ---------- entradas ----------
  const variaveis = r.entradasMes.filter((x) => x.tipo === 'variavel')
  const entradas: Linha[] = [
    { id: 'base', nome: 'Salário base', detalhe: 'fixo todo mês', valor: r.salarioBase },
    ...(variaveis.length
      ? variaveis.map((x) => ({ id: x.id, nome: x.descricao || 'Variável', detalhe: 'variável lançado', valor: x.valor }))
      : r.variavel > 0
        ? [{ id: 'variavel', nome: 'Variável', detalhe: 'estimado (ainda não lançado)', valor: r.variavel, estimado: true }]
        : []),
    ...r.entradasMes
      .filter((x) => x.tipo !== 'variavel')
      .map((x) => ({ id: x.id, nome: x.descricao || TIPOS_ENTRADA[x.tipo], detalhe: TIPOS_ENTRADA[x.tipo], valor: x.valor })),
  ]

  // ---------- saídas ----------
  const reservaRestante = Math.max(r.diaADia - r.totalGastos, 0)
  const grupos: Grupo[] = [
    {
      titulo: 'Sua parte das contas da casa',
      linhas: r.casa
        .map((c) => {
          const parte = parteDe(c, r.eu)
          const meio = (c.divisao ?? 'meio') === 'meio'
          return {
            id: c.id,
            nome: c.nome,
            detalhe: meio ? `metade de ${brl(c.valor)}` : 'só ' + nomeDe(r.eu),
            valor: parte,
            estimado: c.estimado,
          }
        })
        .filter((l) => l.valor > 0),
    },
    {
      titulo: 'Contas pessoais',
      linhas: r.contasPessoais.map((c) => ({ id: c.id, nome: c.nome, detalhe: 'dia ' + String(c.dia).padStart(2, '0'), valor: c.valor, estimado: c.estimado })),
    },
    {
      titulo: 'Cartões',
      linhas: r.faturas.filter((f) => f.valor !== 0).map((f) => ({ id: f.cartao.id, nome: 'Fatura ' + f.cartao.nome, detalhe: 'vence dia ' + String(f.cartao.diaVence).padStart(2, '0'), valor: f.valor })),
    },
    {
      titulo: 'Dia a dia',
      linhas: [
        ...r.gastos.map((g) => ({ id: g.id, nome: g.descricao || 'Gasto', detalhe: dataCurta(g.data), valor: g.valor })),
        ...(reservaRestante > 0
          ? [{ id: 'reserva', nome: 'Reserva ainda não usada', detalhe: `de ${brl(r.diaADia)} reservados para o mês`, valor: reservaRestante, estimado: true }]
          : []),
      ],
    },
    {
      titulo: 'Caixinhas',
      linhas: r.lancamentos
        .filter((g) => g.forma === 'caixinha')
        .map((g) => ({ id: g.id, nome: nomeCaixinha(g.metaId), detalhe: (g.valor < 0 ? 'retirada · ' : 'guardado · ') + dataCurta(g.data), valor: g.valor })),
    },
  ].filter((g) => g.linhas.length > 0)

  const totalEntradas = total(entradas)
  const totalSaidas = grupos.reduce((s, g) => s + total(g.linhas), 0)
  const sobra = totalEntradas - totalSaidas
  const usado = pct(totalSaidas, totalEntradas)

  const linha = (l: Linha, sinal: '+' | '−') => (
    <li key={l.id}>
      <span className="nome">{l.nome}{l.detalhe && <small>{l.detalhe}</small>}</span>
      <strong className={sinal === '+' ? 'positivo' : ''}>
        {l.estimado && '≈ '}{sinal} {brl(Math.abs(l.valor))}
      </strong>
    </li>
  )

  return (
    <div className="extrato">
      <section className="cartao resumo-extrato">
        <h3>Entradas e saídas de {nomeDoMes(mes)}</h3>
        <div className="placar">
          <div>
            <span>Entrou</span>
            <strong className="positivo">{brl(totalEntradas)}</strong>
          </div>
          <span className="op" aria-hidden>−</span>
          <div>
            <span>Saiu</span>
            <strong>{brl(totalSaidas)}</strong>
          </div>
          <span className="op" aria-hidden>=</span>
          <div>
            <span>Sobra</span>
            <Valor v={sobra} className={'grande' + (sobra < 0 ? ' negativo' : '')} />
          </div>
        </div>
        <div className="barra medidor" aria-label={`Saídas são ${usado}% das entradas`}>
          <i style={{ width: Math.min(usado, 100) + '%', background: usado > 100 ? 'var(--rosa)' : 'var(--azul)' }} />
        </div>
        <p className="apoio">
          {usado > 100
            ? `As saídas passam das entradas em ${brl(-sobra)}.`
            : `As saídas usam ${usado}% do que entrou. Itens com ≈ ainda são estimativa.`}{' '}
          Só você vê.
        </p>
      </section>

      <div className="extrato-colunas">
        <section className="cartao">
          <div className="titulo-total">
            <h3>Entradas</h3>
            <strong className="positivo">{brl(totalEntradas)}</strong>
          </div>
          <ul className="lista simples">{entradas.map((l) => linha(l, '+'))}</ul>
        </section>

        <section className="cartao">
          <div className="titulo-total">
            <h3>Saídas</h3>
            <strong>{brl(totalSaidas)}</strong>
          </div>
          {grupos.map((g) => (
            <div key={g.titulo} className="grupo-saida">
              <div className="titulo-total sub">
                <h4>{g.titulo}</h4>
                <span>{brl(total(g.linhas))}</span>
              </div>
              <ul className="lista simples">{g.linhas.map((l) => linha(l, '−'))}</ul>
            </div>
          ))}
          {grupos.length === 0 && <p className="vazio">Nada saiu em {nomeDoMes(mes)}.</p>}
        </section>
      </div>
    </div>
  )
}
