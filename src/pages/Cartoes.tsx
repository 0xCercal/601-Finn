import { useState } from 'react'
import { CartaoForm } from '../forms'
import { useEstado, type Cartao } from '../store'
import { brl, Valor } from '../ui'

export function CartaoVisual({ cartao, fatura, mes, onClick }: { cartao: Cartao; fatura: number; mes: string; onClick?: () => void }) {
  return (
    <div className="plastico" style={{ background: cartao.cor }} onClick={onClick} role={onClick ? 'button' : undefined}>
      <strong>{cartao.nome}</strong>
      <span className="chip" />
      <div className="rodape">
        <span><small>VENCE</small>{String(cartao.diaVence).padStart(2, '0')}/{mes.slice(5)}</span>
        <span><small>FATURA</small>{brl(fatura)}</span>
        <span><small>LIMITE LIVRE</small>{brl(cartao.limite - fatura)}</span>
      </div>
    </div>
  )
}

export function Cartoes({ mes }: { mes: string }) {
  const e = useEstado()
  const [editando, setEditando] = useState<Cartao | 'novo' | null>(null)
  const meus = e.cartoes.filter((c) => c.dono === e.perfil)
  const total = meus.reduce((s, c) => s + (c.faturas[mes] ?? 0), 0)

  return (
    <section className="cartao pagina">
      <h3>Seus cartões de crédito</h3>
      <Valor v={total} className="grande" />
      <p className="apoio">só você vê · total das faturas que vencem neste mês · toque num cartão para editar a fatura</p>
      <div className="barra-acoes">
        <span />
        <button className="botao leve" onClick={() => setEditando('novo')}>Novo cartão</button>
      </div>
      <div className="plasticos">
        {meus.map((c) => (
          <CartaoVisual key={c.id} cartao={c} fatura={c.faturas[mes] ?? 0} mes={mes} onClick={() => setEditando(c)} />
        ))}
        {meus.length === 0 && <p className="vazio">Nenhum cartão cadastrado.</p>}
      </div>
      {editando && <CartaoForm cartao={editando === 'novo' ? null : editando} mes={mes} onFechar={() => setEditando(null)} />}
    </section>
  )
}
