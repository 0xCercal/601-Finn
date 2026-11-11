import { Lock } from 'lucide-react'
import { useState } from 'react'
import { contasDoMes, estimadoNoMes, pagadorDe, parteDe, valorNoMes } from '../calc'
import { ValorMesForm } from '../forms'
import { alternarPago, useEstado, type Conta, type Quem } from '../store'
import { brl, Check, cor, nomeDoMes } from '../ui'

type Filtro = 'todas' | 'pendentes' | 'pagas'

export function Contas({ mes, onEditar }: { mes: string; onEditar: (c: Conta | 'nova') => void }) {
  const e = useEstado()
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [informar, setInformar] = useState<Conta | null>(null)
  const pagos = e.pagos[mes] ?? []
  const nome = (q: Quem) => (q === 'eu' ? e.nomeEu : e.nomePar)
  // contas pessoais do outro perfil não aparecem
  const visiveis = contasDoMes(e, mes).filter((c) => c.tipo === 'casa' || c.pagador === e.perfil)
  const contas = [...visiveis]
    .sort((a, b) => a.dia - b.dia)
    .filter((c) => filtro === 'todas' || (filtro === 'pagas') === pagos.includes(c.id))
  const pendentes = visiveis.filter((c) => !pagos.includes(c.id))
  const semValor = visiveis.filter((c) => estimadoNoMes(c, mes)).length

  return (
    <section className="cartao pagina">
      <h3>Contas do mês</h3>
      <p className="apoio">
        {visiveis.length} contas · {pendentes.length} pendentes · <strong>{brl(pendentes.reduce((s, c) => s + valorNoMes(c, mes), 0))}</strong>
        {semValor > 0 && ` · ${semValor} com valor estimado`}
      </p>
      <div className="barra-acoes">
        <div className="abas">
          {(['todas', 'pendentes', 'pagas'] as Filtro[]).map((f) => (
            <button key={f} className={filtro === f ? 'ativo' : ''} onClick={() => setFiltro(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button className="botao leve" onClick={() => onEditar('nova')}>Nova conta</button>
      </div>
      <ul className="lista">
        {contas.map((c) => {
          const pago = pagos.includes(c.id)
          const valor = valorNoMes(c, mes)
          const estimado = estimadoNoMes(c, mes)
          const quem = pagadorDe(c)
          const soDeUm = c.tipo === 'casa' && c.divisao && c.divisao !== 'meio'
          return (
            <li key={c.id} className={pago ? 'pago' : ''} onClick={() => onEditar(c)}>
              <Check marcado={pago} onClick={() => alternarPago(mes, c.id)} rotulo={'Marcar ' + c.nome + ' como paga'} />
              <span className="nome">
                {c.nome}
                <small>
                  {c.tipo === 'casa' ? (
                    <><i className={'ponto ' + cor(quem)} /> {soDeUm ? 'Só ' + nome(quem) : nome(quem) + ' paga'} · </>
                  ) : (
                    <><Lock size={11} /> Pessoal, só você vê · </>
                  )}
                  dia {String(c.dia).padStart(2, '0')}
                  {c.mes && ' · só este mês'}
                  {c.variavel && (estimado ? ' · estimado' : ' · valor do mês informado')}
                  {!c.variavel && c.ajustes?.[mes] !== undefined && ' · valor ajustado neste mês'}
                </small>
              </span>
              <span className="direita">
                <strong>{estimado && '≈ '}{brl(valor)}</strong>
                {c.tipo === 'casa' && <small>sua parte {brl(parteDe({ ...c, valor }, e.perfil))}</small>}
                {c.variavel && (
                  <button
                    className="link pequeno"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      setInformar(c)
                    }}
                  >
                    {estimado ? 'Informar valor de ' + nomeDoMes(mes) : 'Alterar valor'}
                  </button>
                )}
              </span>
            </li>
          )
        })}
        {contas.length === 0 && <li className="vazio">Nenhuma conta aqui.</li>}
      </ul>
      {informar && <ValorMesForm conta={informar} mes={mes} onFechar={() => setInformar(null)} />}
    </section>
  )
}
