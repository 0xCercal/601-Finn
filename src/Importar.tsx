import { CloudUpload, FileCheck2 } from 'lucide-react'
import { useState } from 'react'
import { mesDaFatura } from './calc'
import { categoriaDe, NOMES_CATEGORIA } from './categorias'
import { lerArquivoFatura, paraCompras, type Lancamento } from './leitorFatura'
import { importarCompras, novoId, useEstado, type Cartao } from './store'
import { brl, Campo, Modal, nomeDoMes } from './ui'

const AVISOS = {
  importado: 'já importado antes',
  manual: 'parece já lançada à mão',
  pagamento: 'pagamento da fatura',
}

/** Importa os lançamentos de uma fatura exportada (CSV ou OFX) para um cartão. */
export function ImportarFatura({ cartao, mes, onFechar }: { cartao: Cartao; mes: string; onFechar: () => void }) {
  const e = useEstado()
  const [faturaMes, setFaturaMes] = useState(mes)
  const [sugerido, setSugerido] = useState(false)
  const [lancs, setLancs] = useState<Lancamento[] | null>(null)
  const [arquivo, setArquivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  /** escolhas manuais; o que não está aqui segue a sugestão (desmarcado quando há aviso) */
  const [escolha, setEscolha] = useState<Record<number, boolean>>({})
  const [zerar, setZerar] = useState(true)
  const [sobre, setSobre] = useState(false)

  const existentes = e.compras.filter((c) => c.cartaoId === cartao.id)
  const cands = lancs && faturaMes ? paraCompras(lancs, faturaMes, existentes) : []
  const marcado = (i: number) => escolha[i] ?? !cands[i].aviso
  const selecionadas = cands.filter((_, i) => marcado(i))
  const total = selecionadas.reduce((s, c) => s + c.lanc.valor, 0)
  const base = cartao.faturas[faturaMes] ?? 0

  async function abrir(f: File | undefined) {
    if (!f) return
    setErro(null)
    setLancs(null)
    setEscolha({})
    setArquivo(f.name)
    if (/\.pdf$/i.test(f.name)) {
      setErro('PDF ainda não é lido. Exporte a fatura em CSV ou OFX e escolha esse arquivo.')
      return
    }
    try {
      const l = lerArquivoFatura(f.name, await f.text())
      if (!l.length) throw new Error('Não encontrei lançamentos nesse arquivo.')
      setLancs(l)
      // a fatura é a do vencimento seguinte à última compra do arquivo
      const ultima = l.filter((x) => x.valor > 0).map((x) => x.data).sort().pop()
      if (ultima) {
        setFaturaMes(mesDaFatura(ultima, cartao.diaVence))
        setSugerido(true)
      }
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  function importar() {
    importarCompras(
      cartao.id,
      selecionadas.map((c) => ({ ...c.compra, id: novoId(), cartaoId: cartao.id })),
      zerar && base > 0 ? faturaMes : undefined,
    )
    onFechar()
  }

  return (
    <Modal titulo={'Importar fatura · ' + cartao.nome} onFechar={onFechar}>
      <label
        className={'soltar' + (sobre ? ' sobre' : '') + (lancs ? ' pronto' : '')}
        onDragOver={(ev) => { ev.preventDefault(); setSobre(true) }}
        onDragLeave={() => setSobre(false)}
        onDrop={(ev) => { ev.preventDefault(); setSobre(false); void abrir(ev.dataTransfer.files?.[0]) }}
      >
        <input
          type="file"
          accept=".csv,.ofx,.txt,.pdf"
          onChange={(ev) => { void abrir(ev.target.files?.[0]); ev.target.value = '' }}
        />
        <span className="soltar-icone">{lancs ? <FileCheck2 size={20} /> : <CloudUpload size={20} />}</span>
        {lancs ? (
          <span className="soltar-texto"><strong>{arquivo}</strong> · <u>trocar arquivo</u></span>
        ) : (
          <span className="soltar-texto">Arraste e solte a fatura aqui ou <u>selecionar</u></span>
        )}
        <small>CSV ou OFX exportado pelo banco</small>
      </label>
      <Campo rotulo="Fatura de">
        <input type="month" value={faturaMes} onChange={(ev) => { setFaturaMes(ev.target.value); setSugerido(false) }} />
      </Campo>
      {sugerido && (
        <p className="apoio espaco">
          Calculado pela última compra do arquivo e pelo vencimento do cartão (dia {cartao.diaVence}). Se estiver errado, troque aqui.
        </p>
      )}
      {erro && <p className="aviso">{erro}</p>}

      {lancs && cands.length > 0 && (
        <>
          <p className="apoio espaco">
            {arquivo}: {cands.length} lançamentos · {selecionadas.length} marcados · <strong>{brl(total)}</strong>
          </p>
          <ul className="lista importar">
            {cands.map((c, i) => (
              <li key={i} className={marcado(i) ? '' : 'desmarcado'} onClick={() => setEscolha({ ...escolha, [i]: !marcado(i) })}>
                <input type="checkbox" checked={marcado(i)} readOnly tabIndex={-1} aria-label={'Importar ' + c.lanc.descricao} />
                <span className="nome">
                  {c.lanc.descricao}
                  <small>
                    {c.lanc.data.slice(8, 10)}/{c.lanc.data.slice(5, 7)}
                    {c.parcela && ` · parcela ${c.parcela.n} de ${c.parcela.total}`}
                    {c.aviso ? ' · ' + AVISOS[c.aviso] : c.lanc.valor > 0 && ' · ' + NOMES_CATEGORIA[categoriaDe(c.compra, e.regras[cartao.dono] ?? {})]}
                  </small>
                </span>
                <strong>{brl(c.lanc.valor)}</strong>
              </li>
            ))}
          </ul>
          {base > 0 && (
            <label className="marcar">
              <input type="checkbox" checked={zerar} onChange={(ev) => setZerar(ev.target.checked)} />
              Zerar "Outros gastos" de {nomeDoMes(faturaMes)} ({brl(base)}), já que a fatura vem completa
            </label>
          )}
        </>
      )}

      <footer>
        <button className="botao primario" disabled={!selecionadas.length} onClick={importar}>
          Importar {selecionadas.length || ''} lançamentos
        </button>
      </footer>
    </Modal>
  )
}
