import { Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { MetaForm } from '../forms'
import { mesAtual, salvarMeta, somaMes, useEstado, type Meta } from '../store'
import { brl, Campo, lerValor, Modal, nomeDoMes, pct, Valor } from '../ui'

/** Quando o objetivo é alcançado, no ritmo de aporte atual. */
function previsao(m: Meta) {
  const falta = m.alvo - m.guardado
  if (falta <= 0) return 'Objetivo alcançado.'
  if (m.aporte <= 0) return 'Defina quanto guarda por mês para ver a previsão.'
  const meses = Math.ceil(falta / m.aporte)
  const quando = somaMes(mesAtual(), meses)
  return `Guardando ${brl(m.aporte)} por mês, chega em ${nomeDoMes(quando)} de ${quando.slice(0, 4)} (${meses} ${meses === 1 ? 'mês' : 'meses'}).`
}

function Guardar({ meta, onFechar }: { meta: Meta; onFechar: () => void }) {
  const [valor, setValor] = useState(meta.aporte ? meta.aporte.toFixed(2).replace('.', ',') : '')

  function enviar(ev: FormEvent, sinal: 1 | -1) {
    ev.preventDefault()
    salvarMeta({ ...meta, guardado: Math.max(0, meta.guardado + sinal * lerValor(valor)) })
    onFechar()
  }

  return (
    <Modal titulo={'Guardar em ' + meta.nome} onFechar={onFechar}>
      <form onSubmit={(ev) => enviar(ev, 1)}>
        <Campo rotulo="Valor (R$)">
          <input value={valor} onChange={(ev) => setValor(ev.target.value)} inputMode="decimal" placeholder="0,00" autoFocus />
        </Campo>
        <p className="apoio espaco">Guardado hoje: {brl(meta.guardado)}</p>
        <footer>
          <button type="button" className="botao leve" onClick={(ev) => enviar(ev, -1)}>Retirar</button>
          <button type="submit" className="botao primario">Guardar</button>
        </footer>
      </form>
    </Modal>
  )
}

export function Metas() {
  const e = useEstado()
  const [editando, setEditando] = useState<Meta | 'nova' | null>(null)
  const [guardando, setGuardando] = useState<Meta | null>(null)
  // objetivos pessoais do outro perfil não aparecem
  const metas = e.metas.filter((m) => m.dono === 'casa' || m.dono === e.perfil)
  const total = metas.reduce((s, m) => s + m.guardado, 0)

  return (
    <section className="cartao pagina">
      <h3>Objetivos</h3>
      <Valor v={total} className="grande" />
      <p className="apoio">guardado até agora, somando os objetivos da casa e os seus</p>
      <div className="barra-acoes">
        <span />
        <button className="botao leve" onClick={() => setEditando('nova')}>Novo objetivo</button>
      </div>

      <div className="metas">
        {metas.map((m) => {
          const p = Math.min(pct(m.guardado, m.alvo), 100)
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
                <strong>{brl(m.guardado)}</strong> <small>de {brl(m.alvo)} · {p}%</small>
              </p>
              <div className="barra medidor">
                <i style={{ width: p + '%', background: p >= 100 ? 'var(--verde)' : 'var(--azul)' }} />
              </div>
              <p className="apoio">{previsao(m)}</p>
              <button className="botao primario" onClick={() => setGuardando(m)}>Guardar</button>
            </article>
          )
        })}
        {metas.length === 0 && <p className="vazio">Nenhum objetivo ainda. Crie um para acompanhar quanto falta.</p>}
      </div>

      {editando && <MetaForm meta={editando === 'nova' ? null : editando} onFechar={() => setEditando(null)} />}
      {guardando && <Guardar meta={guardando} onFechar={() => setGuardando(null)} />}
    </section>
  )
}
