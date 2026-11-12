import { Lock } from 'lucide-react'
import { useState } from 'react'
import { depositosDaCaixinha, saldoDaCaixinha } from '../calc'
import { GastoForm, MetaForm } from '../forms'
import { mesAtual, somaMes, useEstado, type Meta } from '../store'
import { brl, nomeDoMes, pct, Valor } from '../ui'

/** Quando a meta é alcançada, no ritmo de depósito informado. */
function previsao(m: Meta, saldo: number) {
  if (m.alvo <= 0) return null
  const falta = m.alvo - saldo
  if (falta <= 0) return 'Meta alcançada.'
  if (m.aporte <= 0) return `Faltam ${brl(falta)}. Informe quanto guarda por mês para ver quando chega.`
  const meses = Math.ceil(falta / m.aporte)
  const quando = somaMes(mesAtual(), meses)
  return `Guardando ${brl(m.aporte)} por mês, chega em ${nomeDoMes(quando)} de ${quando.slice(0, 4)} (${meses} ${meses === 1 ? 'mês' : 'meses'}).`
}

/** Caixinhas (como as do banco): saldo, meta opcional e depósitos que saem da sobra do mês. */
export function Metas({ mes }: { mes: string }) {
  const e = useEstado()
  const [editando, setEditando] = useState<Meta | 'nova' | null>(null)
  const [guardando, setGuardando] = useState<Meta | null>(null)
  // caixinhas pessoais do outro perfil não aparecem
  const caixinhas = e.metas.filter((m) => m.dono === 'casa' || m.dono === e.perfil)
  const total = caixinhas.reduce((s, m) => s + saldoDaCaixinha(e, m), 0)

  return (
    <section className="cartao pagina">
      <h3>Caixinhas</h3>
      <Valor v={total} className="grande" />
      <p className="apoio">guardado no total, somando as caixinhas da casa e as suas</p>
      <div className="barra-acoes">
        <span />
        <button className="botao leve" onClick={() => setEditando('nova')}>Nova caixinha</button>
      </div>

      <div className="metas">
        {caixinhas.map((m) => {
          const saldo = saldoDaCaixinha(e, m)
          const noMes = depositosDaCaixinha(e, m.id, mes)
          const p = m.alvo > 0 ? Math.min(pct(saldo, m.alvo), 100) : 0
          const texto = previsao(m, saldo)
          return (
            <article key={m.id} className="meta">
              <header>
                <div>
                  <strong>{m.nome}</strong>
                  <small>{m.dono === 'casa' ? 'Da casa' : <><Lock size={11} /> Só você vê</>}</small>
                </div>
                <button className="botao leve" onClick={() => setEditando(m)}>Editar</button>
              </header>
              <p className="numeros">
                <strong>{brl(saldo)}</strong> {m.alvo > 0 && <small>de {brl(m.alvo)} · {p}%</small>}
              </p>
              {m.alvo > 0 && (
                <div className="barra medidor">
                  <i style={{ width: p + '%', background: p >= 100 ? 'var(--verde)' : 'var(--azul)' }} />
                </div>
              )}
              <p className="apoio">
                {noMes !== 0 && <>Em {nomeDoMes(mes)}: <strong>{brl(noMes)}</strong>. </>}
                {texto}
              </p>
              <button className="botao primario" onClick={() => setGuardando(m)}>Guardar</button>
            </article>
          )
        })}
        {caixinhas.length === 0 && <p className="vazio">Nenhuma caixinha ainda. Crie uma com o saldo que está no banco.</p>}
      </div>

      {editando && <MetaForm meta={editando === 'nova' ? null : editando} onFechar={() => setEditando(null)} />}
      {guardando && <GastoForm gasto={null} mes={mes} metaInicial={guardando.id} onFechar={() => setGuardando(null)} />}
    </section>
  )
}
