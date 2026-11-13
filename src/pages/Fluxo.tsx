import { useState } from 'react'
import { resumo } from '../calc'
import { difMeses, mesAtual, somaMes, useEstado } from '../store'
import { brl, Campo, lerValor, nomeDoMes } from '../ui'

/** Rótulo do eixo: só o mês; o ano aparece no primeiro mês e em cada janeiro. */
const rotulo = (m: string, i: number) => nomeDoMes(m, 'short') + (i === 0 || m.endsWith('-01') ? '/' + m.slice(2, 4) : '')

/** "Novembro de 2026" */
const porExtenso = (m: string) => {
  const nome = nomeDoMes(m)
  return nome[0].toUpperCase() + nome.slice(1) + ' de ' + m.slice(0, 4)
}

/** Projeção da sobra nos próximos 12 meses, com simulador de compra ("e se"). */
export function Fluxo({ mes }: { mes: string }) {
  const e = useEstado()
  const [valor, setValor] = useState('')
  const [parcelas, setParcelas] = useState('1')
  const [inicio, setInicio] = useState(mes)
  const [comPlano, setComPlano] = useState(true)

  // quanto planejo guardar por mês: caixinhas minhas inteiras, as da casa pela metade
  const planejado = e.metas
    .filter((x) => x.dono === e.perfil || x.dono === 'casa')
    .reduce((s, x) => s + (x.dono === 'casa' ? x.aporte / 2 : x.aporte), 0)

  const total = lerValor(valor)
  const n = Math.min(48, Math.max(1, parseInt(parcelas) || 1))
  const simulando = total > 0 && Boolean(inicio)

  const linhas = Array.from({ length: 12 }, (_, i) => {
    const m = somaMes(mes, i)
    const r = resumo(e, m)
    const d = simulando ? difMeses(inicio, m) : -1
    const extra = d >= 0 && d < n ? total / n : 0
    // do mês atual em diante, conta o que falta guardar para cumprir o plano das caixinhas
    const guardar = comPlano && m >= mesAtual() ? Math.max(planejado, r.totalGuardado) : r.totalGuardado
    const sobra = r.sobra + r.totalGuardado - guardar
    return { m, renda: r.salario, estimado: r.variavelEstimado, metade: r.parteCasa, pessoais: r.pessoais, guardar, sobra, extra, comCompra: sobra - extra }
  })

  // escala única para as barras e para o marcador "sem a compra"
  const valores = linhas.flatMap((l) => [l.sobra, l.comCompra])
  const max = Math.max(0, ...valores)
  const min = Math.min(0, ...valores)
  const faixa = max - min || 1
  const pos = (v: number) => ((v - min) / faixa) * 100

  const pior = linhas.reduce((a, b) => (b.comCompra < a.comCompra ? b : a))
  const negativos = linhas.filter((l) => l.comCompra < 0)

  return (
    <section className="cartao pagina">
      <h3>Fluxo de caixa</h3>
      <p className="apoio">
        Sobra prevista de {nomeDoMes(mes)} em diante, mês a mês. Renda = salário base + variável (o lançado ou o esperado, marcado com ≈)
        + entradas extras. Contas de todo mês, lançamentos avulsos e parcelas dos cartões já entram.
      </p>
      <label className="marcar espaco">
        <input type="checkbox" checked={comPlano} onChange={(ev) => setComPlano(ev.target.checked)} />
        Descontar o que planejo guardar nas caixinhas ({brl(planejado)} por mês; as da casa contam pela metade)
      </label>

      <div className="simulador">
        <h4>E se eu fizer uma compra?</h4>
        <div className="tres">
          <Campo rotulo="Valor total (R$)">
            <input value={valor} onChange={(ev) => setValor(ev.target.value)} inputMode="decimal" placeholder="0,00" />
          </Campo>
          <Campo rotulo="Parcelas">
            <input value={parcelas} onChange={(ev) => setParcelas(ev.target.value)} inputMode="numeric" />
          </Campo>
          <Campo rotulo="Primeira parcela em">
            <input type="month" value={inicio} onChange={(ev) => setInicio(ev.target.value)} />
          </Campo>
        </div>
        {simulando && (
          <p className="apoio">
            Simulação: {n}x de {brl(total / n)}. Nada foi lançado.{' '}
            <button className="link" onClick={() => setValor('')}>Limpar simulação</button>
          </p>
        )}
      </div>

      <p className={'gastar' + (negativos.length ? ' negativo' : '')}>
        {negativos.length ? (
          <>
            {negativos.length === 1 ? 'Um mês fica' : negativos.length + ' meses ficam'} no negativo{simulando && ' com a compra'}. O pior é{' '}
            <strong>{nomeDoMes(pior.m)}</strong>, com <strong>{brl(pior.comCompra)}</strong>.
          </>
        ) : (
          <>
            Nenhum mês fica no negativo{simulando && ', mesmo com a compra'}. O mais apertado é <strong>{nomeDoMes(pior.m)}</strong>, com sobra de{' '}
            <strong>{brl(pior.comCompra)}</strong>.
          </>
        )}
      </p>

      {simulando && (
        <div className="legenda-grafico">
          <span><i className="amostra barra-amostra" /> Sobra com a compra</span>
          <span><i className="amostra traco-amostra" /> Sobra sem a compra</span>
        </div>
      )}
      <div className="grafico" role="img" aria-label="Gráfico de barras da sobra prevista por mês; os valores estão na tabela abaixo">
        <span className="eixo" style={{ bottom: pos(max) + '%' }}>{brl(max)}</span>
        <span className="eixo zero" style={{ bottom: pos(0) + '%' }}>0</span>
        {min < 0 && <span className="eixo" style={{ bottom: '0%' }}>{brl(min)}</span>}
        <div className="colunas">
          {linhas.map((l, i) => (
            <div className="coluna" key={l.m} tabIndex={0}>
              <div className="area">
                <i
                  className={'barra-mes' + (l.comCompra < 0 ? ' abaixo' : '')}
                  style={{ bottom: pos(Math.min(l.comCompra, 0)) + '%', height: (Math.abs(l.comCompra) / faixa) * 100 + '%' }}
                />
                {simulando && l.extra > 0 && <b className="traco" style={{ bottom: pos(l.sobra) + '%' }} />}
                <div className="dica">
                  <strong>{porExtenso(l.m)}</strong>
                  <span>Sobra: {brl(l.comCompra)}</span>
                  {simulando && l.extra > 0 && <span>Sem a compra: {brl(l.sobra)}</span>}
                </div>
              </div>
              <small>{rotulo(l.m, i)}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Renda</th>
              <th>Sua parte da casa</th>
              <th>Contas pessoais</th>
              <th>Caixinhas</th>
              {simulando && <th>Compra simulada</th>}
              <th>Sobra</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.m}>
                <td>{porExtenso(l.m)}</td>
                <td>{l.estimado && '≈ '}{brl(l.renda)}</td>
                <td>{brl(l.metade)}</td>
                <td>{brl(l.pessoais)}</td>
                <td>{l.guardar ? brl(l.guardar) : '—'}</td>
                {simulando && <td>{l.extra ? brl(l.extra) : '—'}</td>}
                <td><strong>{brl(l.comCompra)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
