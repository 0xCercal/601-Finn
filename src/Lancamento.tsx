import { ArrowLeft, Banknote, ChevronDown, CreditCard, Minus, PiggyBank, Plus, Delete, QrCode, Wallet } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { mesDaFatura, resumo } from './calc'
import { NOMES_CATEGORIA, ORDEM_CATEGORIAS, type Categoria } from './categorias'
import { ICONES_CATEGORIA } from './PainelCategorias'
import { TIPOS_ENTRADA } from './Renda'
import { hojeISO, mesAtual, novoId, salvarCompra, salvarEntrada, salvarGasto, useEstado, type TipoEntrada } from './store'
import { avisar, brl, Modal, nomeDoMes } from './ui'

/** Onde o gasto fica: uma forma de pagamento do dia a dia, um cartão ('cartao:<id>') ou uma caixinha. */
type Onde = 'pix' | 'debito' | 'dinheiro' | 'caixinha' | `cartao:${string}`

const CHAVE_ULTIMO = 'financas-ultimo-onde'
const lerUltimo = (): Onde => {
  try {
    return (localStorage.getItem(CHAVE_ULTIMO) as Onde) || 'pix'
  } catch {
    return 'pix'
  }
}

export interface PedidoLancamento {
  tipo: 'gasto' | 'receita'
  /** já abre com este destino escolhido (ex.: botão rápido "Caixinha") */
  onde?: Onde
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={'chip-onde' + (ativo ? ' ativo' : '')} onClick={onClick} aria-pressed={ativo}>
      {children}
    </button>
  )
}

/**
 * Lançamento rápido em dois passos: (1) o valor, num teclado numérico grande;
 * (2) categoria e onde o dinheiro sai (Pix, débito, dinheiro, um cartão ou uma caixinha).
 * Receita vira uma entrada do mês (variável, 13º, férias…).
 */
export function LancamentoRapido({ pedido, mes, onFechar }: { pedido: PedidoLancamento; mes: string; onFechar: () => void }) {
  const e = useEstado()
  const r = resumo(e, mes)
  const meusCartoes = e.cartoes.filter((c) => c.dono === e.perfil)
  const caixinhas = e.metas.filter((m) => m.dono === 'casa' || m.dono === e.perfil)

  const [tipo, setTipo] = useState(pedido.tipo)
  const [passo, setPasso] = useState<1 | 2>(1)
  const [centavos, setCentavos] = useState(0)
  const [categoria, setCategoria] = useState<Categoria | null>(null)
  const [onde, setOnde] = useState<Onde>(() => {
    const o = pedido.onde ?? lerUltimo()
    // destino guardado que não existe mais (cartão excluído, sem caixinha) volta para Pix
    if (o.startsWith('cartao:') && !meusCartoes.some((c) => 'cartao:' + c.id === o)) return 'pix'
    if (o === 'caixinha' && !caixinhas.length) return 'pix'
    return o
  })
  const [metaId, setMetaId] = useState(caixinhas[0]?.id ?? '')
  const [tipoEntrada, setTipoEntrada] = useState<TipoEntrada>('variavel')
  const [nota, setNota] = useState('')
  const [data, setData] = useState(mes === mesAtual() ? hojeISO() : mes + '-01')
  const [parcelas, setParcelas] = useState(1)
  const [mais, setMais] = useState(false)

  const valor = centavos / 100
  const cartao = onde.startsWith('cartao:') ? meusCartoes.find((c) => 'cartao:' + c.id === onde) : undefined

  // ---------- teclado ----------
  const digitar = (d: string) =>
    setCentavos((v) => {
      const novo = d === '00' ? v * 100 : v * 10 + Number(d)
      return novo > 99_999_999_99 ? v : novo
    })
  const somar = (reais: number) => setCentavos((v) => Math.min(v + reais * 100, 99_999_999_99))
  const apagar = () => setCentavos((v) => Math.floor(v / 10))

  // teclado físico também funciona no primeiro passo
  useEffect(() => {
    if (passo !== 1) return
    const tecla = (ev: KeyboardEvent) => {
      if (/^\d$/.test(ev.key)) digitar(ev.key)
      else if (ev.key === 'Backspace') apagar()
      else if (ev.key === 'Enter' && centavos > 0) setPasso(2)
      else return
      ev.preventDefault()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [passo, centavos])

  // ---------- salvar ----------
  function lancar() {
    const descricao = nota.trim()
    const cat = categoria ? { categoria } : {}
    if (tipo === 'receita') {
      salvarEntrada({ id: novoId(), tipo: tipoEntrada, valor, descricao, mes: data.slice(0, 7), dono: e.perfil })
      avisar(`+ ${brl(valor)} na renda de ${nomeDoMes(data.slice(0, 7))}`)
    } else if (cartao) {
      const mesFatura = mesDaFatura(data, cartao.diaVence)
      salvarCompra({
        id: novoId(),
        cartaoId: cartao.id,
        descricao: descricao || NOMES_CATEGORIA[categoria ?? 'outros'],
        valor,
        parcelas,
        mes: mesFatura,
        ...cat,
      })
      avisar(`${brl(valor)} no ${cartao.nome}${parcelas > 1 ? ` em ${parcelas}x` : ''} · fatura de ${nomeDoMes(mesFatura)}`)
    } else if (onde === 'caixinha') {
      salvarGasto({ id: novoId(), descricao, valor, data, forma: 'caixinha', dono: e.perfil, metaId })
      avisar(`${brl(valor)} guardado em ${caixinhas.find((m) => m.id === metaId)?.nome ?? 'caixinha'}`)
    } else {
      const forma = onde as 'pix' | 'debito' | 'dinheiro'
      salvarGasto({ id: novoId(), descricao, valor, data, forma, dono: e.perfil, ...cat })
      avisar(`${brl(valor)} lançado no ${forma === 'pix' ? 'Pix' : forma === 'debito' ? 'débito' : 'dinheiro'}`)
    }
    // lembra o destino para o próximo gasto, menos caixinha (guardar não é o gasto do dia a dia)
    if (tipo === 'gasto' && onde !== 'caixinha') {
      try {
        localStorage.setItem(CHAVE_ULTIMO, onde)
      } catch {
        /* sem storage: só não lembra o último destino */
      }
    }
    onFechar()
  }

  const tituloValor = (
    <div className={'valor-lancamento' + (centavos ? '' : ' zero')} aria-live="polite">
      {tipo === 'receita' && centavos > 0 && '+ '}
      {brl(valor)}
    </div>
  )

  return (
    <Modal titulo="Novo lançamento" onFechar={onFechar}>
      {passo === 1 ? (
        <div className="lancamento">
          <div className="abas">
            <button type="button" className={tipo === 'gasto' ? 'ativo' : ''} onClick={() => setTipo('gasto')}>Gasto</button>
            <button type="button" className={tipo === 'receita' ? 'ativo' : ''} onClick={() => setTipo('receita')}>Receita</button>
          </div>
          {tituloValor}
          <p className="apoio centro">
            {tipo === 'gasto' ? <>Livre no mês: <strong>{brl(r.disponivel)}</strong></> : <>Renda de {nomeDoMes(mes)}: <strong>{brl(r.salario)}</strong></>}
          </p>
          <div className="atalhos-valor">
            {[10, 20, 50, 100].map((n) => (
              <button type="button" key={n} onClick={() => somar(n)}>+{n}</button>
            ))}
          </div>
          <div className="teclado">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'].map((d) => (
              <button type="button" key={d} onClick={() => digitar(d)}>{d}</button>
            ))}
            <button type="button" onClick={apagar} aria-label="Apagar"><Delete size={22} /></button>
          </div>
          <button type="button" className="botao primario largo" disabled={!centavos} onClick={() => setPasso(2)}>Continuar</button>
        </div>
      ) : (
        <div className="lancamento">
          <button type="button" className="valor-voltar" onClick={() => setPasso(1)} aria-label="Alterar o valor">
            <ArrowLeft size={18} /> {tituloValor}
          </button>

          {tipo === 'gasto' ? (
            <>
              <h4>Categoria</h4>
              <div className="trilho">
                {ORDEM_CATEGORIAS.map((c) => {
                  const Icone = ICONES_CATEGORIA[c]
                  return (
                    <button type="button" key={c} className={'cat-botao' + (categoria === c ? ' ativo' : '')} onClick={() => setCategoria(categoria === c ? null : c)} aria-pressed={categoria === c}>
                      <span><Icone size={20} /></span>
                      <small>{NOMES_CATEGORIA[c]}</small>
                    </button>
                  )
                })}
              </div>

              <h4>Onde saiu</h4>
              <div className="chips-onde">
                <Chip ativo={onde === 'pix'} onClick={() => setOnde('pix')}><QrCode size={16} /> Pix</Chip>
                <Chip ativo={onde === 'debito'} onClick={() => setOnde('debito')}><Wallet size={16} /> Débito</Chip>
                <Chip ativo={onde === 'dinheiro'} onClick={() => setOnde('dinheiro')}><Banknote size={16} /> Dinheiro</Chip>
                {meusCartoes.map((c) => (
                  <Chip key={c.id} ativo={onde === 'cartao:' + c.id} onClick={() => setOnde(`cartao:${c.id}`)}>
                    <CreditCard size={16} /> {c.nome}
                  </Chip>
                ))}
                {caixinhas.length > 0 && (
                  <Chip ativo={onde === 'caixinha'} onClick={() => setOnde('caixinha')}><PiggyBank size={16} /> Caixinha</Chip>
                )}
              </div>
              {onde === 'caixinha' && (
                <div className="chips-onde">
                  {caixinhas.map((m) => (
                    <Chip key={m.id} ativo={metaId === m.id} onClick={() => setMetaId(m.id)}>{m.nome}</Chip>
                  ))}
                </div>
              )}
              <p className="apoio">
                {cartao
                  ? `Vai para a fatura de ${nomeDoMes(mesDaFatura(data, cartao.diaVence))} do ${cartao.nome}.`
                  : onde === 'caixinha'
                    ? 'Soma na caixinha e sai da sobra do mês.'
                    : 'Desconta da sua reserva do dia a dia.'}
              </p>
            </>
          ) : (
            <>
              <h4>O que é</h4>
              <div className="chips-onde">
                {(Object.keys(TIPOS_ENTRADA) as TipoEntrada[]).map((t) => (
                  <Chip key={t} ativo={tipoEntrada === t} onClick={() => setTipoEntrada(t)}>{TIPOS_ENTRADA[t]}</Chip>
                ))}
              </div>
            </>
          )}

          <button type="button" className={'mais' + (mais ? ' aberto' : '')} onClick={() => setMais(!mais)} aria-expanded={mais}>
            Data, nota e mais <ChevronDown size={18} />
          </button>
          {mais && (
            <div className="mais-campos">
              <label className="campo">
                <span>Nota</span>
                <input value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder={tipo === 'gasto' ? 'Ex.: Uber pro metrô' : 'Ex.: Meta de outubro'} />
              </label>
              <label className="campo">
                <span>{tipo === 'receita' ? 'Mês em que entra' : 'Data'}</span>
                {tipo === 'receita' ? (
                  <input type="month" value={data.slice(0, 7)} onChange={(ev) => setData(ev.target.value + '-01')} />
                ) : (
                  <input type="date" value={data} onChange={(ev) => setData(ev.target.value)} />
                )}
              </label>
              {cartao && (
                <div className="parcelado">
                  <div>
                    <strong>Parcelado</strong>
                    <small>{parcelas > 1 ? `${parcelas}x de ${brl(valor / parcelas)}, nas próximas faturas` : 'Divide o valor nas próximas faturas'}</small>
                  </div>
                  <div className="contador">
                    <button type="button" onClick={() => setParcelas((p) => Math.max(1, p - 1))} aria-label="Menos parcelas"><Minus size={16} /></button>
                    <span>{parcelas}x</span>
                    <button type="button" onClick={() => setParcelas((p) => Math.min(48, p + 1))} aria-label="Mais parcelas"><Plus size={16} /></button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button type="button" className="botao primario largo" onClick={lancar} disabled={onde === 'caixinha' && tipo === 'gasto' && !metaId}>
            {tipo === 'receita' ? 'Lançar receita' : onde === 'caixinha' ? 'Guardar na caixinha' : 'Lançar gasto'}
          </button>
        </div>
      )}
    </Modal>
  )
}
