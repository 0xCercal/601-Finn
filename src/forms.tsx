import { useState, type FormEvent } from 'react'
import { excluirCartao, excluirConta, novoId, salvarCartao, salvarConta, useEstado, type Cartao, type Conta } from './store'
import { Campo, lerValor, Modal, paraCampo } from './ui'

const diaValido = (txt: string) => Math.min(31, Math.max(1, parseInt(txt) || 1))

export function ContaForm({ conta, onFechar }: { conta: Conta | null; onFechar: () => void }) {
  const e = useEstado()
  const [nome, setNome] = useState(conta?.nome ?? '')
  const [valor, setValor] = useState(paraCampo(conta?.valor ?? 0))
  const [dia, setDia] = useState(String(conta?.dia ?? 5))
  const [tipo, setTipo] = useState<Conta['tipo']>(conta?.tipo ?? 'casa')
  const [pagador, setPagador] = useState<Conta['pagador']>(conta?.pagador ?? 'eu')
  const [moradia, setMoradia] = useState(conta?.moradia ?? false)

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    if (!nome.trim()) return
    salvarConta({
      id: conta?.id ?? novoId(),
      nome: nome.trim(),
      valor: lerValor(valor),
      dia: diaValido(dia),
      tipo,
      pagador: tipo === 'casa' ? pagador : conta?.tipo === 'pessoal' ? conta.pagador : e.perfil,
      moradia,
    })
    onFechar()
  }

  return (
    <Modal titulo={conta ? 'Editar conta' : 'Nova conta'} onFechar={onFechar}>
      <form onSubmit={enviar}>
        <Campo rotulo="Nome">
          <input value={nome} onChange={(ev) => setNome(ev.target.value)} placeholder="Ex.: Aluguel" autoFocus required />
        </Campo>
        <div className="duas">
          <Campo rotulo="Valor (R$)">
            <input value={valor} onChange={(ev) => setValor(ev.target.value)} inputMode="decimal" placeholder="0,00" />
          </Campo>
          <Campo rotulo="Dia do vencimento">
            <input value={dia} onChange={(ev) => setDia(ev.target.value)} inputMode="numeric" />
          </Campo>
        </div>
        <Campo rotulo="Tipo">
          <div className="abas">
            <button type="button" className={tipo === 'casa' ? 'ativo' : ''} onClick={() => setTipo('casa')}>Da casa (meio a meio)</button>
            <button type="button" className={tipo === 'pessoal' ? 'ativo' : ''} onClick={() => setTipo('pessoal')}>Pessoal (só você vê)</button>
          </div>
        </Campo>
        {tipo === 'casa' && (
          <Campo rotulo="Quem paga">
            <div className="abas">
              <button type="button" className={pagador === 'eu' ? 'ativo' : ''} onClick={() => setPagador('eu')}>{e.nomeEu}</button>
              <button type="button" className={pagador === 'par' ? 'ativo' : ''} onClick={() => setPagador('par')}>{e.nomePar}</button>
            </div>
          </Campo>
        )}
        <label className="marcar">
          <input type="checkbox" checked={moradia} onChange={(ev) => setMoradia(ev.target.checked)} /> Conta de moradia (aluguel, condomínio, luz…)
        </label>
        <footer>
          {conta && (
            <button type="button" className="botao perigo" onClick={() => { excluirConta(conta.id); onFechar() }}>Excluir</button>
          )}
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
        <Campo rotulo="Fatura deste mês (R$)">
          <input value={fatura} onChange={(ev) => setFatura(ev.target.value)} inputMode="decimal" placeholder="0,00" />
        </Campo>
        <Campo rotulo="Cor">
          <div className="cores">
            {CORES.map((c) => (
              <button type="button" key={c} style={{ background: c }} className={c === cor ? 'ativo' : ''} onClick={() => setCor(c)} aria-label={'Cor ' + c} />
            ))}
          </div>
        </Campo>
        <footer>
          {cartao && (
            <button type="button" className="botao perigo" onClick={() => { excluirCartao(cartao.id); onFechar() }}>Excluir</button>
          )}
          <button type="submit" className="botao primario">Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}
