import {
  Car, Ellipsis, GraduationCap, HeartPulse, House, Plane, Repeat, ShoppingBag, ShoppingCart, Ticket, UtensilsCrossed, type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { gastosPorCategoria } from './calc'
import { chaveEstabelecimento, NOMES_CATEGORIA, ORDEM_CATEGORIAS, type Categoria } from './categorias'
import { definirCategoria, useEstado } from './store'
import { brl, Modal, nomeDoMes, pct, Valor } from './ui'

export const ICONES_CATEGORIA: Record<Categoria, LucideIcon> = {
  mercado: ShoppingCart,
  delivery: UtensilsCrossed,
  transporte: Car,
  saude: HeartPulse,
  compras: ShoppingBag,
  assinaturas: Repeat,
  lazer: Ticket,
  casa: House,
  educacao: GraduationCap,
  viagem: Plane,
  outros: Ellipsis,
}

/** Etiqueta da categoria; tocar abre a troca. */
export function ChipCategoria({ categoria, onClick }: { categoria: Categoria; onClick: () => void }) {
  const Icone = ICONES_CATEGORIA[categoria]
  return (
    <button
      className="chip-cat"
      title="Trocar categoria"
      onClick={(ev) => {
        ev.stopPropagation()
        onClick()
      }}
    >
      <Icone size={12} /> <span className="rotulo">{NOMES_CATEGORIA[categoria]}</span>
    </button>
  )
}

export interface AlvoCategoria {
  tipo: 'compra' | 'gasto'
  id: string
  descricao: string
  atual: Categoria
}

/** Troca a categoria de uma compra ou gasto e, se marcado, aprende para o estabelecimento. */
export function EscolherCategoria({ alvo, onFechar }: { alvo: AlvoCategoria; onFechar: () => void }) {
  const { perfil } = useEstado()
  const chave = chaveEstabelecimento(alvo.descricao)
  const [todas, setTodas] = useState(Boolean(chave))

  function escolher(c: Categoria) {
    definirCategoria(alvo.tipo, alvo.id, c, todas && chave ? { dono: perfil, chave } : null)
    onFechar()
  }

  return (
    <Modal titulo={'Categoria · ' + (alvo.descricao || 'gasto')} onFechar={onFechar}>
      <div className="grade-cat">
        {ORDEM_CATEGORIAS.map((c) => {
          const Icone = ICONES_CATEGORIA[c]
          return (
            <button key={c} className={c === alvo.atual ? 'ativo' : ''} onClick={() => escolher(c)}>
              <Icone size={16} /> {NOMES_CATEGORIA[c]}
            </button>
          )
        })}
      </div>
      {chave && (
        <label className="marcar">
          <input type="checkbox" checked={todas} onChange={(ev) => setTodas(ev.target.checked)} />
          Usar para tudo de "{chave}", inclusive nas próximas faturas
        </label>
      )}
    </Modal>
  )
}

/** Cartão da Visão geral: quanto foi para cada categoria no mês (cartões + gastos do dia a dia). */
export function ParaOndeFoi({ mes }: { mes: string }) {
  const e = useEstado()
  const r = gastosPorCategoria(e, mes)
  const [alvo, setAlvo] = useState<AlvoCategoria | null>(null)
  const maior = r.grupos[0]?.total ?? 0

  return (
    <section className="cartao a-categorias">
      <h3>Para onde foi o dinheiro</h3>
      <Valor v={r.total} className="grande" />
      <p className="apoio">cartões e gastos do dia a dia em {nomeDoMes(mes)} · só você vê · toque numa categoria para ver</p>

      <ul className="categorias">
        {r.grupos.map((g) => {
          const Icone = ICONES_CATEGORIA[g.categoria]
          return (
            <li key={g.categoria}>
              <details>
                <summary>
                  <span className="cat-icone"><Icone size={15} /></span>
                  <span className="cat-nome">{NOMES_CATEGORIA[g.categoria]}</span>
                  <span className="cat-valor">{brl(g.total)} <small>{pct(g.total, r.total)}%</small></span>
                  <span className="cat-barra"><i style={{ width: (g.total / maior) * 100 + '%' }} /></span>
                </summary>
                <ul className="lista simples">
                  {g.itens.map((i) => (
                    <li key={i.tipo + i.id}>
                      <span className="nome">{i.descricao}<small>{i.origem}</small></span>
                      <ChipCategoria categoria={i.categoria} onClick={() => setAlvo({ tipo: i.tipo, id: i.id, descricao: i.descricao, atual: i.categoria })} />
                      <strong>{brl(i.valor)}</strong>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          )
        })}
        {r.semDetalhe > 0 && (
          <li className="sem-detalhe">
            <span className="cat-icone"><Ellipsis size={15} /></span>
            <span className="cat-nome">Fatura sem detalhe<small>importe a fatura para separar por categoria</small></span>
            <span className="cat-valor">{brl(r.semDetalhe)} <small>{pct(r.semDetalhe, r.total)}%</small></span>
          </li>
        )}
        {r.total === 0 && <li className="vazio">Nada lançado em {nomeDoMes(mes)}.</li>}
      </ul>

      {alvo && <EscolherCategoria alvo={alvo} onFechar={() => setAlvo(null)} />}
    </section>
  )
}
