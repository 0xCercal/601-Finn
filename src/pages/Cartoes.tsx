import { useState } from 'react'
import { faturaDoMes, limiteLivre } from '../calc'
import { CartaoForm, CompraForm } from '../forms'
import { ImportarFatura } from '../Importar'
import { moverImportados, somaMes, useEstado, type Cartao, type Compra } from '../store'
import { brl, nomeDoMes, Valor } from '../ui'

export function CartaoVisual({ cartao, fatura, livre, mes, onClick }: { cartao: Cartao; fatura: number; livre: number; mes: string; onClick?: () => void }) {
  return (
    <div className="plastico" style={{ background: cartao.cor }} onClick={onClick} role={onClick ? 'button' : undefined}>
      <strong>{cartao.nome}</strong>
      <span className="chip" />
      <div className="rodape">
        <span><small>VENCE</small>{String(cartao.diaVence).padStart(2, '0')}/{mes.slice(5)}</span>
        <span><small>FATURA</small>{brl(fatura)}</span>
        <span><small>LIMITE LIVRE</small>{brl(livre)}</span>
      </div>
    </div>
  )
}

export function Cartoes({ mes }: { mes: string }) {
  const e = useEstado()
  const [cartao, setCartao] = useState<Cartao | 'novo' | null>(null)
  const [compra, setCompra] = useState<{ cartaoId: string; compra: Compra | null } | null>(null)
  const [importando, setImportando] = useState<Cartao | null>(null)
  const meus = e.cartoes.filter((c) => c.dono === e.perfil)
  const total = meus.reduce((s, c) => s + faturaDoMes(e, c, mes).total, 0)

  return (
    <section className="cartao pagina">
      <h3>Seus cartões de crédito</h3>
      <Valor v={total} className="grande" />
      <p className="apoio">só você vê · total das faturas que vencem em {nomeDoMes(mes)}</p>
      <div className="barra-acoes">
        <span />
        <button className="botao leve" onClick={() => setCartao('novo')}>Novo cartão</button>
      </div>

      {meus.map((c) => {
        const f = faturaDoMes(e, c, mes)
        return (
          <div className="bloco-cartao" key={c.id}>
            <CartaoVisual cartao={c} fatura={f.total} livre={limiteLivre(e, c, mes)} mes={mes} onClick={() => setCartao(c)} />
            <div className="detalhe">
              <div className="barra-acoes">
                <h4>Fatura de {nomeDoMes(mes)}</h4>
                <div className="botoes">
                  <button className="botao leve" onClick={() => setImportando(c)}>Importar fatura</button>
                  <button className="botao leve" onClick={() => setCompra({ cartaoId: c.id, compra: null })}>Nova compra</button>
                </div>
              </div>
              <ul className="lista simples">
                {f.parcelas.map((p) => (
                  <li key={p.compra.id} className="clicavel" onClick={() => setCompra({ cartaoId: c.id, compra: p.compra })}>
                    <span className="nome">
                      {p.compra.descricao}
                      <small>
                        {p.compra.parcelas > 1 ? `parcela ${p.n} de ${p.compra.parcelas}` : p.valor < 0 ? 'crédito' : 'à vista'}
                        {p.compra.origem && ' · importada'}
                      </small>
                    </span>
                    <strong>{brl(p.valor)}</strong>
                  </li>
                ))}
                {f.base > 0 && (
                  <li className="clicavel" onClick={() => setCartao(c)}>
                    <span className="nome">Outros gastos<small>total não detalhado</small></span>
                    <strong>{brl(f.base)}</strong>
                  </li>
                )}
                {f.total === 0 && <li className="vazio">Nada lançado nesta fatura.</li>}
              </ul>
              {f.parcelas.some((p) => p.compra.origem) && (
                <button className="link pequeno mover" onClick={() => moverImportados(c.id, mes, 1)}>
                  Importou no mês errado? Mover os importados para {nomeDoMes(somaMes(mes, 1))}
                </button>
              )}
              <h4>Próximas faturas</h4>
              <div className="proximas">
                {[0, 1, 2, 3].map((i) => {
                  const m = somaMes(mes, i)
                  return (
                    <div key={m} className={i === 0 ? 'ativo' : ''}>
                      <small>{nomeDoMes(m, 'short')}</small>
                      <strong>{brl(faturaDoMes(e, c, m).total)}</strong>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
      {meus.length === 0 && <p className="vazio">Nenhum cartão cadastrado.</p>}

      {cartao && <CartaoForm cartao={cartao === 'novo' ? null : cartao} mes={mes} onFechar={() => setCartao(null)} />}
      {importando && <ImportarFatura cartao={importando} mes={mes} onFechar={() => setImportando(null)} />}
      {compra && <CompraForm compra={compra.compra} cartaoId={compra.cartaoId} mes={mes} onFechar={() => setCompra(null)} />}
    </section>
  )
}
