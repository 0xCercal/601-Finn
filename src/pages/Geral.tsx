import { ArrowDownRight, ArrowUpRight, Check as Ok } from 'lucide-react'
import type { Pagina } from '../App'
import { diasParaGastar, limiteLivre, resumo } from '../calc'
import { alternarPago, marcarAcerto, useEstado } from '../store'
import { brl, Check, cor, nomeDoMes, pct, Valor } from '../ui'
import { CartaoVisual } from './Cartoes'

const dataCurta = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)

export function Geral({ mes, ir }: { mes: string; ir: (p: Pagina) => void }) {
  const e = useEstado()
  const r = resumo(e, mes)
  const base = Math.max(r.salario, r.metade + r.pessoais + r.diaADia, 1)
  const pagas = r.itens.filter((i) => i.pago).length
  const pctMoradia = pct(r.moradia, r.salario)
  const pctEu = pct(r.pagoEu, r.totalCasa)
  const dias = diasParaGastar(mes)
  const nomeDe = (q: 'eu' | 'par') => (q === 'eu' ? e.nomeEu : e.nomePar)

  const temAcerto = Math.abs(r.acerto) >= 0.01
  const feito = e.acertos[mes]
  const historico = Object.entries(e.acertos).sort(([a], [b]) => b.localeCompare(a))

  const fatias = [
    { rotulo: 'Sua metade da casa', v: r.metade, cor: 'var(--marinho)' },
    { rotulo: 'Contas pessoais', v: r.pessoais, cor: 'var(--azul)' },
    { rotulo: 'Dia a dia', v: r.diaADia, cor: 'var(--cinza)' },
    { rotulo: 'Sobra', v: Math.max(r.sobra, 0), cor: 'var(--verde)' },
  ]

  return (
    <div className="grade">
      <section className="cartao a-saldo">
        <h3>Saldo previsto</h3>
        <div className="saldo-linha">
          <Valor v={r.sobra} className={'enorme' + (r.sobra < 0 ? ' negativo' : '')} />
          <p className={r.sobra < 0 ? 'negativo' : 'positivo'}>
            {r.sobra < 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
            <strong>{pct(r.sobra, r.salario)}% do salário livre</strong>
            <small>valor estimado após pagar todas as contas</small>
          </p>
        </div>
        <p className={'gastar' + (r.livre < 0 ? ' negativo' : '')}>
          {r.livre < 0 ? (
            <>As contas passam do salário em <strong>{brl(-r.livre)}</strong>.</>
          ) : (
            <>
              Livre depois das contas: <strong>{brl(r.livre)}</strong>
              {dias > 0 && <> · dá <strong>{brl(r.livre / dias)} por dia</strong> nos {dias} dias que restam</>}
            </>
          )}
        </p>
        <div className="barra">
          {fatias.map((f) => f.v > 0 && <i key={f.rotulo} style={{ width: (f.v / base) * 100 + '%', background: f.cor }} />)}
        </div>
        <div className="legenda">
          <div>
            <span>Salário</span>
            <strong>{brl(r.salario)}</strong>
          </div>
          {fatias.map((f, i) => (
            <div key={f.rotulo}>
              <span><i style={{ background: f.cor }} /> {f.rotulo}</span>
              <strong className={i === 3 ? (r.sobra < 0 ? 'negativo' : 'positivo') : ''}>
                {i === 3 ? brl(r.sobra) : '− ' + brl(f.v)} <small>{pct(i === 3 ? r.sobra : f.v, r.salario)}%</small>
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="cartao a-pagar">
        <h3>Contas a pagar</h3>
        <Valor v={r.pendente} className="grande" />
        <p className="apoio">{pagas} de {r.itens.length} pagas</p>
        <ul className="lista">
          {r.itens.map((i) => (
            <li key={i.id} className={i.pago ? 'pago' : ''} onClick={() => alternarPago(mes, i.id)}>
              <Check marcado={i.pago} onClick={() => alternarPago(mes, i.id)} rotulo={'Marcar ' + i.nome + ' como paga'} />
              <span className="nome">{i.nome}<small>dia {String(i.dia).padStart(2, '0')}</small></span>
              <strong>{brl(i.valor)}</strong>
            </li>
          ))}
          {r.itens.length === 0 && <li className="vazio">Nada a pagar neste mês.</li>}
        </ul>
      </section>

      <section className="cartao a-divisao">
        <h3>Divisão da casa</h3>
        <p className="apoio">Total das contas</p>
        <Valor v={r.totalCasa} className="grande" />
        <div className="duelo">
          <div><span><i className={'ponto ' + cor(r.eu)} /> Você paga</span><strong>{brl(r.pagoEu)}</strong></div>
          <div className="dir"><span>{r.nomeOutro} paga <i className={'ponto ' + cor(r.outro)} /></span><strong>{brl(r.pagoPar)}</strong></div>
        </div>
        <div className="barra dupla">
          <i style={{ width: pctEu + '%', background: `var(--${cor(r.eu)})` }}>{r.totalCasa > 0 && pctEu + '%'}</i>
          <i style={{ width: 100 - pctEu + '%', background: `var(--${cor(r.outro)})` }}>{r.totalCasa > 0 && 100 - pctEu + '%'}</i>
          <b />
        </div>
        <h4>Quem paga cada conta</h4>
        <ul className="lista simples">
          {r.casa.map((c) => (
            <li key={c.id}>
              <i className={'ponto ' + cor(c.pagador)} />
              <span className="nome">{c.nome}</span>
              <strong>{brl(c.valor)}</strong>
            </li>
          ))}
          {r.casa.length === 0 && <li className="vazio">Nenhuma conta da casa ainda.</li>}
        </ul>

        {(temAcerto || feito) && (
          <div className="acerto">
            <p>
              {temAcerto ? (
                <>
                  {r.acerto > 0 ? r.nomeOutro + ' te devolve' : 'Você devolve'} <strong>{brl(Math.abs(r.acerto))}</strong>
                  {r.acerto < 0 && ' para ' + r.nomeOutro}
                </>
              ) : (
                'As contas estão divididas igualmente.'
              )}
              {feito && (
                <small className="positivo">
                  <Ok size={13} /> Acertado em {dataCurta(feito.em)}
                  {temAcerto && Math.abs(feito.valor - Math.abs(r.acerto)) >= 0.01 && ` (${brl(feito.valor)}; o valor mudou depois)`}
                </small>
              )}
            </p>
            {feito ? (
              <button className="botao leve" onClick={() => marcarAcerto(mes, null)}>Desfazer</button>
            ) : (
              <button
                className="botao leve"
                onClick={() =>
                  marcarAcerto(mes, {
                    valor: Math.round(Math.abs(r.acerto) * 100) / 100,
                    de: r.acerto > 0 ? r.outro : r.eu,
                    para: r.acerto > 0 ? r.eu : r.outro,
                    em: new Date().toISOString().slice(0, 10),
                  })
                }
              >
                Marcar feito
              </button>
            )}
          </div>
        )}
        {historico.length > 0 && (
          <details className="historico">
            <summary>Histórico de acertos</summary>
            <ul className="lista simples">
              {historico.map(([m, a]) => (
                <li key={m}>
                  <span className="nome">
                    {nomeDoMes(m)} de {m.slice(0, 4)}
                    <small>{nomeDe(a.de)} → {nomeDe(a.para)} · em {dataCurta(a.em)}</small>
                  </span>
                  <strong>{brl(a.valor)}</strong>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="cartao a-cartoes">
        <h3>Cartões</h3>
        <p className="apoio">Suas faturas do mês</p>
        <Valor v={r.totalFaturas} className="grande" />
        <div className="carrossel">
          {r.faturas.map((f) => (
            <CartaoVisual key={f.cartao.id} cartao={f.cartao} fatura={f.valor} livre={limiteLivre(e, f.cartao, mes)} mes={mes} />
          ))}
        </div>
        <button className="botao leve" onClick={() => ir('cartoes')}>Ver cartões</button>
      </section>

      <section className="cartao a-moradia">
        <h3>Moradia</h3>
        <p className="apoio">Quanto você gasta pra morar</p>
        <Valor v={r.moradia} className="grande" />
        <p className={pctMoradia <= 30 ? 'positivo linha' : 'negativo linha'}>
          {pctMoradia <= 30 && <Ok size={16} />} <strong>{pctMoradia}% do salário</strong> <small>referência: até 30%</small>
        </p>
        <div className="barra medidor">
          <i style={{ width: Math.min(pctMoradia / 60, 1) * 100 + '%', background: pctMoradia <= 30 ? 'var(--verde)' : 'var(--rosa)' }} />
          <b />
        </div>
        <div className="escala"><small>0%</small><small>30%</small><small>60%</small></div>
      </section>
    </div>
  )
}
