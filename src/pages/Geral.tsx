import { ArrowDownRight, ArrowUpRight, Building2, Check as Ok, Droplets, Flame, House, KeyRound, Landmark, Wifi, Zap, type LucideIcon } from 'lucide-react'
import type { Pagina } from '../App'
import { useEffect, useState } from 'react'
import { diasParaGastar, ehConjunta, limiteLivre, resumo, type ItemAPagar } from '../calc'
import { alternarPago, useEstado } from '../store'
import { brl, Check, cor, Ilustracao, nomeDoMes, pct, Valor } from '../ui'
import { CartaoVisual } from './Cartoes'
import { ParaOndeFoi } from '../PainelCategorias'
import { FORMAS, GastoForm } from '../forms'
import type { Gasto } from '../store'

/** Ícone de uma conta de moradia, pelo nome. */
function iconeMoradia(nome: string): LucideIcon {
  const n = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/alug/.test(n)) return KeyRound
  if (/condom/.test(n)) return Building2
  if (/luz|energia|eletric|enel|cpfl|cemig|light/.test(n)) return Zap
  if (/internet|wifi|wi-fi|fibra|banda larga/.test(n)) return Wifi
  if (/gas/.test(n)) return Flame
  if (/agua|sabesp|saneamento/.test(n)) return Droplets
  if (/financ|parcela|prestac|iptu|caixa/.test(n)) return Landmark
  return House
}


/** "hoje", "amanhã", "em 5 dias", "venceu há 2 dias" para o dia `dia` do mês `mes`. */
function quando(mes: string, dia: number) {
  const [a, m] = mes.split('-').map(Number)
  const venc = new Date(a, m - 1, Math.min(dia, new Date(a, m, 0).getDate()))
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const d = Math.round((venc.getTime() - hoje.getTime()) / 86400000)
  if (d === 0) return 'vence hoje'
  if (d === 1) return 'vence amanhã'
  if (d > 1) return `em ${d} dias`
  return d === -1 ? 'venceu ontem' : `venceu há ${-d} dias`
}

/** Contas a pagar com a faixa de dias de vencimento: tocar num dia filtra a lista. */
function ContasAPagar({ mes, itens }: { mes: string; itens: ItemAPagar[] }) {
  const [escolhido, setEscolhido] = useState<number | null>(null)
  useEffect(() => setEscolhido(null), [mes])

  const dias = [...new Set(itens.map((i) => i.dia))].sort((a, b) => a - b)
  const dia = escolhido !== null && dias.includes(escolhido) ? escolhido : null
  const lista = dia === null ? itens : itens.filter((i) => i.dia === dia)
  const pagas = lista.filter((i) => i.pago).length
  const pendente = lista.filter((i) => !i.pago).reduce((s, i) => s + i.valor, 0)
  const dd = (n: number) => String(n).padStart(2, '0')

  return (
    <section className="cartao a-pagar">
      <Ilustracao nome="calendario" />
      <h3>
        Contas a pagar {dia !== null && <small>· dia {dd(dia)}</small>}
      </h3>
      <Valor v={pendente} className="grande" />
      <p className="apoio">
        {dia !== null && quando(mes, dia) + ' · '}
        {pagas} de {lista.length} pagas
      </p>

      {dias.length > 0 && (
        <div className="dias" role="group" aria-label="Filtrar por dia de vencimento">
          {dias.map((d) => {
            const doDia = itens.filter((i) => i.dia === d)
            const pendentes = doDia.filter((i) => !i.pago).length
            const atrasado = pendentes > 0 && quando(mes, d).startsWith('venceu')
            return (
              <button
                key={d}
                className={'dia' + (d === dia ? ' ativo' : '') + (atrasado ? ' atrasado' : '') + (pendentes === 0 ? ' quitado' : '')}
                aria-pressed={d === dia}
                aria-label={`Dia ${dd(d)}: ${doDia.length} ${doDia.length === 1 ? 'conta' : 'contas'}, ${pendentes} a pagar`}
                onClick={() => setEscolhido(d === dia ? null : d)}
              >
                {dd(d)}
                <span className="pontos">
                  {doDia.slice(0, 5).map((i) => <i key={i.id} className={i.pago ? '' : 'pendente'} />)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <ul className="lista">
        {lista.map((i) => (
          <li key={i.id} className={i.pago ? 'pago' : ''} onClick={() => alternarPago(mes, i.id)}>
            <Check marcado={i.pago} onClick={() => alternarPago(mes, i.id)} rotulo={'Marcar ' + i.nome + ' como paga'} />
            <span className="nome">{i.nome}<small>dia {dd(i.dia)}{i.estimado && ' · estimado'}</small></span>
            <strong>{i.estimado && '≈ '}{brl(i.valor)}</strong>
          </li>
        ))}
        {itens.length === 0 && <li className="vazio">Nada a pagar neste mês.</li>}
      </ul>
    </section>
  )
}

/** Gastos do dia a dia do mês: quanto da reserva já foi, o que foi para as caixinhas e a lista dos lançamentos. */
function GastosDoDia({ mes, r, dias }: { mes: string; r: ReturnType<typeof resumo>; dias: number }) {
  const e = useEstado()
  const [editando, setEditando] = useState<Gasto | 'novo' | null>(null)
  const reserva = r.diaADia
  const total = r.totalGastos
  const resta = reserva - total
  const usado = reserva > 0 ? total / reserva : 0
  const nomeCaixinha = (id?: string) => e.metas.find((m) => m.id === id)?.nome ?? 'caixinha removida'
  const lista = r.lancamentos

  const item = (g: Gasto) => (
    <li key={g.id} className="clicavel" onClick={() => setEditando(g)}>
      <span className="nome">
        {g.descricao || (g.forma === 'caixinha' ? nomeCaixinha(g.metaId) : FORMAS[g.forma])}
        <small>
          {g.data.slice(8, 10)}/{g.data.slice(5, 7)} ·{' '}
          <span className={'forma' + (g.forma === 'caixinha' ? ' caixinha' : '')}>
            {g.forma === 'caixinha' ? (g.valor < 0 ? 'Retirada · ' : 'Caixinha · ') + nomeCaixinha(g.metaId) : FORMAS[g.forma]}
          </span>
        </small>
      </span>
      <strong>{brl(g.valor)}</strong>
    </li>
  )

  return (
    <section className="cartao a-gastos">
      <div className="cabeca">
        <div>
          <h3>Gastos do dia a dia</h3>
          <Valor v={total} className="grande" />
          <p className="apoio">
            {reserva > 0 ? `de ${brl(reserva)} da reserva do mês` : 'Sem reserva definida: defina em Ajustes'} · só você vê
          </p>
        </div>
        <button className="botao primario" onClick={() => setEditando('novo')}>+ Lançar gasto</button>
      </div>

      {reserva > 0 && (
        <>
          <div className="barra medidor">
            <i style={{ width: Math.min(usado, 1) * 100 + '%', background: usado > 1 ? 'var(--rosa)' : 'var(--azul)' }} />
          </div>
          <p className={'apoio' + (resta < 0 ? ' negativo' : '')}>
            {resta >= 0 ? (
              <>Restam <strong>{brl(resta)}</strong> da reserva{dias > 0 && <> · <strong>{brl(resta / dias)} por dia</strong> nos {dias} dias que faltam</>}</>
            ) : (
              <>Passou <strong>{brl(-resta)}</strong> da reserva; o excedente sai da sobra do mês.</>
            )}
          </p>
        </>
      )}
      {r.totalGuardado !== 0 && (
        <p className="apoio guardado">
          Guardado nas caixinhas este mês: <strong>{brl(r.totalGuardado)}</strong> · sai da sobra, não da reserva
        </p>
      )}

      <ul className="lista simples">
        {lista.slice(0, 5).map(item)}
        {lista.length === 0 && <li className="vazio">Nenhum lançamento em {nomeDoMes(mes)}.</li>}
      </ul>
      {lista.length > 5 && (
        <details>
          <summary>Ver todos os {lista.length} lançamentos</summary>
          <ul className="lista simples">{lista.slice(5).map(item)}</ul>
        </details>
      )}

      {editando && <GastoForm gasto={editando === 'novo' ? null : editando} mes={mes} onFechar={() => setEditando(null)} />}
    </section>
  )
}

export function Geral({ mes, ir }: { mes: string; ir: (p: Pagina) => void }) {
  const e = useEstado()
  const r = resumo(e, mes)
  const base = Math.max(r.salario, r.parteCasa + r.pessoais + r.diaADiaUsado + Math.max(r.totalGuardado, 0), 1)
  const pctMoradia = pct(r.moradia, r.salario)
  const pctEu = pct(r.parteCasa, r.totalCasa)
  const dias = diasParaGastar(mes)
  const nomeDe = (q: 'eu' | 'par') => (q === 'eu' ? e.nomeEu : e.nomePar)


  const fatias = [
    { rotulo: 'Sua parte da casa', v: r.parteCasa, cor: 'var(--marinho)' },
    { rotulo: 'Contas pessoais', v: r.pessoais, cor: 'var(--azul)' },
    { rotulo: 'Dia a dia', v: r.diaADiaUsado, cor: 'var(--cinza)' },
    ...(r.totalGuardado !== 0 ? [{ rotulo: 'Caixinhas', v: r.totalGuardado, cor: 'var(--dourado)' }] : []),
    { rotulo: 'Sobra', v: Math.max(r.sobra, 0), cor: 'var(--verde)' },
  ]

  return (
    <div className="grade">
      <div className="col-esq">
        <section className="cartao a-saldo">
          <Ilustracao nome="saldo" />
          <h3>Saldo previsto</h3>
          <div className="saldo-linha">
            <Valor v={r.sobra} className={'enorme' + (r.sobra < 0 ? ' negativo' : '')} />
            <p className={r.sobra < 0 ? 'negativo' : 'positivo'}>
              {r.sobra < 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
              <strong>{pct(r.sobra, r.salario)}% do salário livre</strong>
              <small>valor estimado após pagar todas as contas</small>
            </p>
          </div>
          <p className={'gastar' + (r.disponivel < 0 ? ' negativo' : '')}>
            {r.disponivel < 0 ? (
              <>As contas e os gastos passam do salário em <strong>{brl(-r.disponivel)}</strong>.</>
            ) : (
              <>
                Livre depois das contas{r.totalGastos > 0 && ' e dos gastos'}: <strong>{brl(r.disponivel)}</strong>
                {dias > 0 && <> · dá <strong>{brl(r.disponivel / dias)} por dia</strong> nos {dias} dias que restam</>}
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
            {fatias.map((f) => (
              <div key={f.rotulo}>
                <span><i style={{ background: f.cor }} /> {f.rotulo}</span>
                <strong className={f.rotulo === 'Sobra' ? (r.sobra < 0 ? 'negativo' : 'positivo') : ''}>
                  {f.rotulo === 'Sobra' ? brl(r.sobra) : '− ' + brl(f.v)} <small>{pct(f.rotulo === 'Sobra' ? r.sobra : f.v, r.salario)}%</small>
                </strong>
              </div>
            ))}
          </div>
        </section>

        <GastosDoDia mes={mes} r={r} dias={dias} />

        <div className="par">
          <section className="cartao a-divisao">
            <Ilustracao nome="divisao" />
            <h3>Divisão da casa</h3>
            <p className="apoio">Total das contas</p>
            <Valor v={r.totalCasa} className="grande" />
            <div className="duelo">
              <div><span><i className={'ponto ' + cor(r.eu)} /> Você arca</span><strong>{brl(r.parteCasa)}</strong></div>
              <div className="dir"><span>{r.nomeOutro} arca <i className={'ponto ' + cor(r.outro)} /></span><strong>{brl(r.totalCasa - r.parteCasa)}</strong></div>
            </div>
            <div className="barra dupla">
              <i style={{ width: pctEu + '%', background: `var(--${cor(r.eu)})` }}>{r.totalCasa > 0 && pctEu + '%'}</i>
              <i style={{ width: 100 - pctEu + '%', background: `var(--${cor(r.outro)})` }}>{r.totalCasa > 0 && 100 - pctEu + '%'}</i>
            </div>
            <h4>Quem arca com cada conta</h4>
            <ul className="lista simples">
              {r.casa.map((c) => {
                const dono = c.divisao && c.divisao !== 'meio' ? c.divisao : null
                return (
                  <li key={c.id}>
                    {dono ? (
                      <i className={'ponto ' + cor(dono)} />
                    ) : (
                      <span className="pontos-dois"><i className="ponto azul" /><i className="ponto rosa" /></span>
                    )}
                    <span className="nome">
                      {c.nome}
                      <small>
                        {dono
                          ? 'só ' + nomeDe(dono)
                          : 'meio a meio · ' + (ehConjunta(c) ? 'cada um paga a sua parte' : 'boleto com ' + nomeDe(c.pagador))}
                      </small>
                    </span>
                    <span className="direita">
                      <strong>{c.estimado && '≈ '}{brl(c.valor)}</strong>
                      {!dono && <small>{brl(c.valor / 2)} cada</small>}
                    </span>
                  </li>
                )
              })}
              {r.casa.length === 0 && <li className="vazio">Nenhuma conta da casa ainda.</li>}
            </ul>

          </section>

          <section className="cartao a-cartoes">
            <Ilustracao nome="cartoes" />
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
        </div>
      </div>

      <div className="col-dir">
        <ContasAPagar mes={mes} itens={r.itens} />

        <section className="cartao a-moradia">
          <Ilustracao nome="casa" />
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

          <h4>O que entra na conta</h4>
          {r.itensMoradia.length > 0 ? (
            <ul className="entra">
              {r.itensMoradia.map((i) => {
                const Icone = iconeMoradia(i.nome)
                return (
                  <li key={i.id}>
                    <span className="entra-icone"><Icone size={16} /></span>
                    <span className="entra-texto">
                      <small>{i.nome}</small>
                      <strong>{i.estimado && '≈ '}{brl(i.valor)}</strong>
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="apoio">Nenhuma conta marcada como moradia. Edite a conta e marque "Conta de moradia".</p>
          )}
          {r.itensMoradia.some((i) => i.valor < i.total) && <p className="apoio">Nas contas divididas, aparece só a sua parte.</p>}
        </section>

        <ParaOndeFoi mes={mes} />
      </div>
    </div>
  )
}
