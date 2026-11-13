import { useState, type FormEvent } from 'react'
import {
  excluirCartao, excluirCompra, excluirConta, excluirGasto, excluirMeta, hojeISO, mesAtual, novoId, salvarCartao, salvarCompra, salvarConta,
  salvarGasto, salvarMeta, useEstado,
  type Cartao, type Compra, type Conta, type Forma, type Gasto, type Meta, type Quem,
} from './store'
import { depositosDaCaixinha, mesDaFatura, valorNoMes } from './calc'
import { brl, Campo, lerValor, Modal, nomeDoMes, paraCampo } from './ui'

const diaValido = (txt: string) => Math.min(31, Math.max(1, parseInt(txt) || 1))

export function ContaForm({ conta, mes, onFechar }: { conta: Conta | null; mes: string; onFechar: () => void }) {
  const e = useEstado()
  const [nome, setNome] = useState(conta?.nome ?? '')
  const [valor, setValor] = useState(paraCampo(conta?.valor ?? 0))
  const [noMes, setNoMes] = useState(paraCampo(conta?.ajustes?.[mes] ?? 0))
  const [dia, setDia] = useState(String(conta?.dia ?? 5))
  const [avulsa, setAvulsa] = useState(Boolean(conta?.mes))
  const [variavel, setVariavel] = useState(conta?.variavel ?? false)
  const [tipo, setTipo] = useState<Conta['tipo']>(conta?.tipo ?? 'casa')
  const [divisao, setDivisao] = useState<'meio' | Quem>(conta?.divisao ?? 'meio')
  const [pagador, setPagador] = useState<Conta['pagador']>(conta?.pagador ?? 'eu')
  const [conjunta, setConjunta] = useState(conta?.conjunta ?? false)
  const [moradia, setMoradia] = useState(conta?.moradia ?? false)
  const esteMes = nomeDoMes(mes)
  const nomeDe = (q: Quem) => (q === 'eu' ? e.nomeEu : e.nomePar)

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    if (!nome.trim()) return
    const ajustes = { ...conta?.ajustes }
    if (noMes.trim()) ajustes[mes] = lerValor(noMes)
    else delete ajustes[mes]
    const daCasa = tipo === 'casa'
    salvarConta({
      id: conta?.id ?? novoId(),
      nome: nome.trim(),
      valor: lerValor(valor),
      dia: diaValido(dia),
      tipo,
      // conta só de uma pessoa: essa pessoa paga; conta pessoal: continua de quem é
      pagador: daCasa ? (divisao === 'meio' ? pagador : divisao) : conta?.tipo === 'pessoal' ? conta.pagador : e.perfil,
      moradia,
      ...(daCasa && divisao !== 'meio' ? { divisao } : {}),
      ...(daCasa && divisao === 'meio' && conjunta ? { conjunta: true } : {}),
      // lançamento avulso guarda o mês em que existe; conta recorrente guarda os valores por mês
      ...(avulsa
        ? { mes: conta?.mes ?? mes }
        : { ...(variavel ? { variavel: true } : {}), ...(Object.keys(ajustes).length ? { ajustes } : {}) }),
    })
    onFechar()
  }

  return (
    <Modal titulo={conta ? 'Editar conta' : 'Nova conta'} onFechar={onFechar}>
      <form onSubmit={enviar}>
        <Campo rotulo="Nome">
          <input value={nome} onChange={(ev) => setNome(ev.target.value)} placeholder="Ex.: Aluguel" autoFocus required />
        </Campo>
        <Campo rotulo="Repetição">
          <div className="abas">
            <button type="button" className={avulsa ? '' : 'ativo'} onClick={() => setAvulsa(false)}>Todo mês</button>
            <button type="button" className={avulsa ? 'ativo' : ''} onClick={() => setAvulsa(true)}>Só em {nomeDoMes(conta?.mes ?? mes)}</button>
          </div>
        </Campo>
        {!avulsa && (
          <label className="marcar">
            <input type="checkbox" checked={variavel} onChange={(ev) => setVariavel(ev.target.checked)} /> O valor muda todo mês (luz, gás, condomínio)
          </label>
        )}
        <div className="duas">
          <Campo rotulo={avulsa ? 'Valor (R$)' : variavel ? 'Valor estimado (R$)' : 'Valor de todo mês (R$)'}>
            <input value={valor} onChange={(ev) => setValor(ev.target.value)} inputMode="decimal" placeholder="0,00" />
          </Campo>
          <Campo rotulo="Dia do vencimento">
            <input value={dia} onChange={(ev) => setDia(ev.target.value)} inputMode="numeric" />
          </Campo>
        </div>
        {!avulsa && (variavel || conta) && (
          <Campo rotulo={variavel ? `Valor real de ${esteMes} (quando a conta chegar)` : `Valor diferente só em ${esteMes} (opcional)`}>
            <input
              value={noMes}
              onChange={(ev) => setNoMes(ev.target.value)}
              inputMode="decimal"
              placeholder={variavel ? 'por enquanto usa a estimativa' : 'igual ao de todo mês'}
            />
          </Campo>
        )}
        {!avulsa && variavel && (
          <p className="apoio espaco">Nos meses sem valor informado, o app usa a média dos últimos 3 meses informados (ou a estimativa, no começo).</p>
        )}
        <Campo rotulo="Tipo">
          <div className="abas">
            <button type="button" className={tipo === 'casa' ? 'ativo' : ''} onClick={() => setTipo('casa')}>Da casa (os dois veem)</button>
            <button type="button" className={tipo === 'pessoal' ? 'ativo' : ''} onClick={() => setTipo('pessoal')}>Pessoal (só você vê)</button>
          </div>
        </Campo>
        {tipo === 'casa' && (
          <Campo rotulo="Quem arca com a conta">
            <div className="abas">
              <button type="button" className={divisao === 'meio' ? 'ativo' : ''} onClick={() => setDivisao('meio')}>Meio a meio</button>
              <button type="button" className={divisao === 'eu' ? 'ativo' : ''} onClick={() => setDivisao('eu')}>Só {e.nomeEu}</button>
              <button type="button" className={divisao === 'par' ? 'ativo' : ''} onClick={() => setDivisao('par')}>Só {e.nomePar}</button>
            </div>
          </Campo>
        )}
        {tipo === 'casa' && divisao === 'meio' && (
          <Campo rotulo="Quem paga o boleto">
            <div className="abas">
              <button type="button" className={!conjunta && pagador === 'eu' ? 'ativo' : ''} onClick={() => { setPagador('eu'); setConjunta(false) }}>{e.nomeEu}</button>
              <button type="button" className={!conjunta && pagador === 'par' ? 'ativo' : ''} onClick={() => { setPagador('par'); setConjunta(false) }}>{e.nomePar}</button>
              <button type="button" className={conjunta ? 'ativo' : ''} onClick={() => setConjunta(true)}>Cada um a sua parte</button>
            </div>
          </Campo>
        )}
        {tipo === 'casa' && divisao === 'meio' && (
          <p className="apoio espaco">
            {conjunta
              ? 'Cada um paga a própria metade (ex.: conta conjunta) e vê a sua parte em Contas a pagar.'
              : `O boleto inteiro aparece em Contas a pagar de ${nomeDe(pagador)}. No saldo de cada um conta só a metade.`}
          </p>
        )}
        {tipo === 'casa' && divisao !== 'meio' && (
          <p className="apoio espaco">Entra inteira nas contas de {nomeDe(divisao)}. Os dois continuam vendo a conta.</p>
        )}
        <label className="marcar">
          <input type="checkbox" checked={moradia} onChange={(ev) => setMoradia(ev.target.checked)} /> Conta de moradia (aluguel, condomínio, luz…)
        </label>
        <footer>
          {conta && (
            <button type="button" className="botao perigo" onClick={() => { excluirConta(conta.id); onFechar() }}>
              {conta.mes ? 'Excluir' : 'Excluir de todos os meses'}
            </button>
          )}
          <button type="submit" className="botao primario">Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}

/** Informa o valor real de uma conta variável num mês. */
export function ValorMesForm({ conta, mes, onFechar }: { conta: Conta; mes: string; onFechar: () => void }) {
  const [valor, setValor] = useState(paraCampo(conta.ajustes?.[mes] ?? 0))
  // estimativa = o que o app usaria se este mês não tivesse valor informado
  const semEsteMes = { ...conta, ajustes: Object.fromEntries(Object.entries(conta.ajustes ?? {}).filter(([m]) => m !== mes)) }

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    if (!valor.trim()) return
    salvarConta({ ...conta, ajustes: { ...conta.ajustes, [mes]: lerValor(valor) } })
    onFechar()
  }

  return (
    <Modal titulo={`${conta.nome} · ${nomeDoMes(mes)}`} onFechar={onFechar}>
      <form onSubmit={enviar}>
        <Campo rotulo={`Valor da conta de ${nomeDoMes(mes)} (R$)`}>
          <input value={valor} onChange={(ev) => setValor(ev.target.value)} inputMode="decimal" placeholder="0,00" autoFocus />
        </Campo>
        <p className="apoio espaco">Estimativa para este mês: {brl(valorNoMes(semEsteMes, mes))}</p>
        <footer>
          <button type="submit" className="botao primario">Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}

const CORES = ['#1f2937', '#ea580c', '#7c3aed', '#2563eb', '#dc2626', '#059669']

export function CartaoForm({ cartao, mes, onFechar }: { cartao: Cartao | null; mes: string; onFechar: () => void }) {
  const { perfil } = useEstado()
  const [nome, setNome] = useState(cartao?.nome ?? '')
  const [limite, setLimite] = useState(paraCampo(cartao?.limite ?? 0))
  const [dia, setDia] = useState(String(cartao?.diaVence ?? 10))
  const [cor, setCor] = useState(cartao?.cor ?? CORES[0])
  const [fatura, setFatura] = useState(paraCampo(cartao?.faturas[mes] ?? 0))

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    if (!nome.trim()) return
    salvarCartao({
      id: cartao?.id ?? novoId(),
      dono: cartao?.dono ?? perfil,
      nome: nome.trim(),
      cor,
      limite: lerValor(limite),
      diaVence: diaValido(dia),
      faturas: { ...cartao?.faturas, [mes]: lerValor(fatura) },
    })
    onFechar()
  }

  return (
    <Modal titulo={cartao ? 'Editar cartão' : 'Novo cartão'} onFechar={onFechar}>
      <form onSubmit={enviar}>
        <Campo rotulo="Nome">
          <input value={nome} onChange={(ev) => setNome(ev.target.value)} placeholder="Ex.: Nubank" autoFocus required />
        </Campo>
        <div className="duas">
          <Campo rotulo="Limite (R$)">
            <input value={limite} onChange={(ev) => setLimite(ev.target.value)} inputMode="decimal" placeholder="0,00" />
          </Campo>
          <Campo rotulo="Dia do vencimento">
            <input value={dia} onChange={(ev) => setDia(ev.target.value)} inputMode="numeric" />
          </Campo>
        </div>
        <Campo rotulo={`Outros gastos na fatura de ${nomeDoMes(mes)} (R$)`}>
          <input value={fatura} onChange={(ev) => setFatura(ev.target.value)} inputMode="decimal" placeholder="0,00" />
        </Campo>
        <p className="apoio espaco">Use para o total do que você não quer lançar compra a compra. Soma com as compras lançadas.</p>
        <Campo rotulo="Cor">
          <div className="cores">
            {CORES.map((c) => (
              <button type="button" key={c} style={{ background: c }} className={c === cor ? 'ativo' : ''} onClick={() => setCor(c)} aria-label={'Cor ' + c} />
            ))}
          </div>
        </Campo>
        <footer>
          {cartao && (
            <button type="button" className="botao perigo" onClick={() => { excluirCartao(cartao.id); onFechar() }}>Excluir cartão e compras</button>
          )}
          <button type="submit" className="botao primario">Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}

export function CompraForm({ compra, cartaoId, mes, onFechar }: { compra: Compra | null; cartaoId: string; mes: string; onFechar: () => void }) {
  const [descricao, setDescricao] = useState(compra?.descricao ?? '')
  const [valor, setValor] = useState(paraCampo(compra?.valor ?? 0))
  const [parcelas, setParcelas] = useState(String(compra?.parcelas ?? 1))
  const { cartoes } = useEstado()
  const diaVence = cartoes.find((c) => c.id === (compra?.cartaoId ?? cartaoId))?.diaVence ?? 10
  // compra feita hoje cai na próxima fatura; vendo outro mês, usa a fatura daquele mês
  const [primeira, setPrimeira] = useState(compra?.mes ?? (mes === mesAtual() ? mesDaFatura(hojeISO(), diaVence) : mes))
  const n = Math.min(48, Math.max(1, parseInt(parcelas) || 1))

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    if (!descricao.trim() || !primeira) return
    salvarCompra({ id: compra?.id ?? novoId(), cartaoId: compra?.cartaoId ?? cartaoId, descricao: descricao.trim(), valor: lerValor(valor), parcelas: n, mes: primeira })
    onFechar()
  }

  return (
    <Modal titulo={compra ? 'Editar compra' : 'Nova compra no cartão'} onFechar={onFechar}>
      <form onSubmit={enviar}>
        <Campo rotulo="O que foi">
          <input value={descricao} onChange={(ev) => setDescricao(ev.target.value)} placeholder="Ex.: Geladeira" autoFocus required />
        </Campo>
        <div className="duas">
          <Campo rotulo="Valor total (R$)">
            <input value={valor} onChange={(ev) => setValor(ev.target.value)} inputMode="decimal" placeholder="0,00" />
          </Campo>
          <Campo rotulo="Parcelas">
            <input value={parcelas} onChange={(ev) => setParcelas(ev.target.value)} inputMode="numeric" />
          </Campo>
        </div>
        <Campo rotulo="Fatura da primeira parcela">
          <input type="month" value={primeira} onChange={(ev) => setPrimeira(ev.target.value)} required />
        </Campo>
        <p className="apoio espaco">
          {n > 1
            ? `${n} parcelas de ${(lerValor(valor) / n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, de ${nomeDoMes(primeira || mes)} em diante.`
            : 'À vista: entra inteira nessa fatura.'}
        </p>
        <footer>
          {compra && (
            <button type="button" className="botao perigo" onClick={() => { excluirCompra(compra.id); onFechar() }}>Excluir</button>
          )}
          <button type="submit" className="botao primario">Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}

export function MetaForm({ meta, onFechar }: { meta: Meta | null; onFechar: () => void }) {
  const e = useEstado()
  // o saldo mostrado já inclui os depósitos lançados; ao salvar, a base é ajustada para bater com o digitado
  const depositos = meta ? depositosDaCaixinha(e, meta.id) : 0
  const [nome, setNome] = useState(meta?.nome ?? '')
  const [saldo, setSaldo] = useState(paraCampo(meta ? meta.guardado + depositos : 0))
  const [alvo, setAlvo] = useState(paraCampo(meta?.alvo ?? 0))
  const [aporte, setAporte] = useState(paraCampo(meta?.aporte ?? 0))
  const [daCasa, setDaCasa] = useState(meta ? meta.dono === 'casa' : false)

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    if (!nome.trim()) return
    salvarMeta({
      id: meta?.id ?? novoId(),
      nome: nome.trim(),
      guardado: lerValor(saldo) - depositos,
      alvo: lerValor(alvo),
      aporte: lerValor(aporte),
      dono: daCasa ? 'casa' : meta && meta.dono !== 'casa' ? meta.dono : e.perfil,
    })
    onFechar()
  }

  return (
    <Modal titulo={meta ? 'Editar caixinha' : 'Nova caixinha'} onFechar={onFechar}>
      <form onSubmit={enviar}>
        <Campo rotulo="Nome">
          <input value={nome} onChange={(ev) => setNome(ev.target.value)} placeholder="Ex.: Reserva de emergência" autoFocus required />
        </Campo>
        <Campo rotulo="Saldo atual da caixinha (R$)">
          <input value={saldo} onChange={(ev) => setSaldo(ev.target.value)} inputMode="decimal" placeholder="0,00" />
        </Campo>
        <p className="apoio espaco">Copie o valor que aparece na caixinha do banco. Dá para corrigir aqui sempre que precisar.</p>
        <div className="duas">
          <Campo rotulo="Meta (opcional, R$)">
            <input value={alvo} onChange={(ev) => setAlvo(ev.target.value)} inputMode="decimal" placeholder="sem meta" />
          </Campo>
          <Campo rotulo="Guarda por mês (opcional, R$)">
            <input value={aporte} onChange={(ev) => setAporte(ev.target.value)} inputMode="decimal" placeholder="0,00" />
          </Campo>
        </div>
        <Campo rotulo="De quem é">
          <div className="abas">
            <button type="button" className={daCasa ? '' : 'ativo'} onClick={() => setDaCasa(false)}>Só minha</button>
            <button type="button" className={daCasa ? 'ativo' : ''} onClick={() => setDaCasa(true)}>Da casa (os dois veem)</button>
          </div>
        </Campo>
        <footer>
          {meta && (
            <button type="button" className="botao perigo" onClick={() => { excluirMeta(meta.id); onFechar() }}>Excluir</button>
          )}
          <button type="submit" className="botao primario">Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}

export const FORMAS: Record<Forma, string> = { pix: 'Pix', debito: 'Débito', dinheiro: 'Dinheiro', caixinha: 'Caixinha' }

/**
 * Lançamento rápido: um gasto do dia a dia (Pix, débito, dinheiro) ou um depósito numa caixinha.
 * `metaInicial` abre já como depósito naquela caixinha.
 */
export function GastoForm({ gasto, mes, metaInicial, onFechar }: { gasto: Gasto | null; mes: string; metaInicial?: string; onFechar: () => void }) {
  const e = useEstado()
  const caixinhas = e.metas.filter((m) => m.dono === 'casa' || m.dono === e.perfil)
  const [valor, setValor] = useState(paraCampo(gasto?.valor ?? 0))
  const [descricao, setDescricao] = useState(gasto?.descricao ?? '')
  const [forma, setForma] = useState<Forma>(gasto?.forma ?? (metaInicial ? 'caixinha' : 'pix'))
  const [metaId, setMetaId] = useState(gasto?.metaId ?? metaInicial ?? caixinhas[0]?.id ?? '')
  // no mês atual, hoje; em outro mês, o dia 1 daquele mês
  const [data, setData] = useState(gasto?.data ?? (mes === mesAtual() ? hojeISO() : mes + '-01'))
  const [erro, setErro] = useState<string | null>(null)
  const ehCaixinha = forma === 'caixinha'

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    const v = lerValor(valor)
    // na caixinha, valor negativo é uma retirada
    if (ehCaixinha ? v === 0 : v <= 0) return setErro('Digite um valor maior que zero.')
    if (ehCaixinha && !metaId) return setErro('Escolha a caixinha.')
    if (!data) return setErro('Escolha a data.')
    salvarGasto({
      id: gasto?.id ?? novoId(),
      descricao: descricao.trim(),
      valor: v,
      data,
      forma,
      dono: gasto?.dono ?? e.perfil,
      ...(ehCaixinha ? { metaId } : {}),
    })
    onFechar()
  }

  return (
    <Modal titulo={gasto ? 'Editar lançamento' : ehCaixinha ? 'Guardar na caixinha' : 'Lançar gasto'} onFechar={onFechar}>
      <form onSubmit={enviar}>
        <Campo rotulo={ehCaixinha ? 'Valor guardado (R$; negativo se retirou)' : 'Valor (R$)'}>
          <input
            className="valor-grande"
            value={valor}
            onChange={(ev) => { setValor(ev.target.value); setErro(null) }}
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
          />
        </Campo>
        {erro && <p className="aviso espaco">{erro}</p>}
        <Campo rotulo="O que foi">
          <div className="abas">
            {(Object.keys(FORMAS) as Forma[]).map((f) => (
              <button type="button" key={f} className={forma === f ? 'ativo' : ''} onClick={() => { setForma(f); setErro(null) }}>{FORMAS[f]}</button>
            ))}
          </div>
        </Campo>
        {ehCaixinha && (
          caixinhas.length ? (
            <Campo rotulo="Qual caixinha">
              <select value={metaId} onChange={(ev) => setMetaId(ev.target.value)}>
                {caixinhas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </Campo>
          ) : (
            <p className="aviso espaco">Nenhuma caixinha ainda. Crie uma na aba Caixinhas.</p>
          )
        )}
        <div className="duas">
          <Campo rotulo="Descrição (opcional)">
            <input value={descricao} onChange={(ev) => setDescricao(ev.target.value)} placeholder={ehCaixinha ? 'Ex.: Sobra do mês' : 'Ex.: Padaria'} />
          </Campo>
          <Campo rotulo="Data">
            <input type="date" value={data} onChange={(ev) => setData(ev.target.value)} />
          </Campo>
        </div>
        <p className="apoio espaco">
          {ehCaixinha
            ? 'Soma no saldo da caixinha e sai da sobra do mês (não da reserva do dia a dia).'
            : 'Só você vê. Desconta da sua reserva do dia a dia.'}
        </p>
        <footer>
          {gasto && (
            <button type="button" className="botao perigo" onClick={() => { excluirGasto(gasto.id); onFechar() }}>Excluir</button>
          )}
          <button type="submit" className="botao primario">Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}
