import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { resumo } from './calc'
import { excluirEntrada, novoId, salvarEntrada, useEstado, type Entrada, type TipoEntrada } from './store'
import { brl, Campo, lerValor, Modal, nomeDoMes, paraCampo, Valor } from './ui'

export const TIPOS_ENTRADA: Record<TipoEntrada, string> = {
  variavel: 'Variável',
  decimo: '13º salário',
  ferias: 'Férias',
  abono: 'Abono',
  outro: 'Outro',
}

/** Lança ou edita uma entrada do mês: variável, 13º, férias, abono ou outra. */
export function EntradaForm({ entrada, mes, tipoInicial, onFechar }: { entrada: Entrada | null; mes: string; tipoInicial?: TipoEntrada; onFechar: () => void }) {
  const { perfil } = useEstado()
  const [tipo, setTipo] = useState<TipoEntrada>(entrada?.tipo ?? tipoInicial ?? 'variavel')
  const [valor, setValor] = useState(paraCampo(entrada?.valor ?? 0))
  const [descricao, setDescricao] = useState(entrada?.descricao ?? '')
  const [mesEntrada, setMesEntrada] = useState(entrada?.mes ?? mes)
  const [erro, setErro] = useState(false)

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    const v = lerValor(valor)
    if (v <= 0 || !mesEntrada) return setErro(true)
    salvarEntrada({ id: entrada?.id ?? novoId(), tipo, valor: v, descricao: descricao.trim(), mes: mesEntrada, dono: entrada?.dono ?? perfil })
    onFechar()
  }

  return (
    <Modal titulo={entrada ? 'Editar entrada' : 'Nova entrada'} onFechar={onFechar}>
      <form onSubmit={enviar}>
        <Campo rotulo="O que é">
          <div className="abas quebra">
            {(Object.keys(TIPOS_ENTRADA) as TipoEntrada[]).map((t) => (
              <button type="button" key={t} className={tipo === t ? 'ativo' : ''} onClick={() => setTipo(t)}>{TIPOS_ENTRADA[t]}</button>
            ))}
          </div>
        </Campo>
        <Campo rotulo="Valor (R$)">
          <input className="valor-grande" value={valor} onChange={(ev) => { setValor(ev.target.value); setErro(false) }} inputMode="decimal" placeholder="0,00" autoFocus />
        </Campo>
        {erro && <p className="aviso espaco">Digite um valor maior que zero.</p>}
        <div className="duas">
          <Campo rotulo="Mês em que entra">
            <input type="month" value={mesEntrada} onChange={(ev) => setMesEntrada(ev.target.value)} />
          </Campo>
          <Campo rotulo="Descrição (opcional)">
            <input value={descricao} onChange={(ev) => setDescricao(ev.target.value)} placeholder={tipo === 'variavel' ? 'Ex.: Meta de outubro' : 'Ex.: 1ª parcela'} />
          </Campo>
        </div>
        <p className="apoio espaco">
          {tipo === 'variavel'
            ? 'Substitui o variável esperado (de Ajustes) neste mês. Só você vê.'
            : 'Soma na sua renda deste mês, além do salário. Só você vê.'}
        </p>
        <footer>
          {entrada && (
            <button type="button" className="botao perigo" onClick={() => { excluirEntrada(entrada.id); onFechar() }}>Excluir</button>
          )}
          <button type="submit" className="botao primario">Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}

/** Cartão da Visão geral: de onde vem a renda do mês. */
export function RendaDoMes({ mes, r, irAjustes }: { mes: string; r: ReturnType<typeof resumo>; irAjustes: () => void }) {
  const [editando, setEditando] = useState<{ entrada: Entrada | null; tipo?: TipoEntrada } | null>(null)
  const variaveis = r.entradasMes.filter((x) => x.tipo === 'variavel')
  const extras = r.entradasMes.filter((x) => x.tipo !== 'variavel')

  const linhaEntrada = (x: Entrada) => (
    <li key={x.id} className="clicavel" onClick={() => setEditando({ entrada: x })}>
      <span className="nome">
        {x.descricao || TIPOS_ENTRADA[x.tipo]}
        <small>{x.descricao ? TIPOS_ENTRADA[x.tipo] : 'toque para editar'}</small>
      </span>
      <strong className="positivo">+ {brl(x.valor)}</strong>
    </li>
  )

  return (
    <section className="cartao a-renda">
      <div className="cabeca">
        <div>
          <h3>Renda de {nomeDoMes(mes)}</h3>
          <Valor v={r.salario} className="grande" />
          <p className="apoio">salário base + variável + entradas extras · só você vê</p>
        </div>
        <button className="botao leve" onClick={() => setEditando({ entrada: null })}><Plus size={16} /> Entrada</button>
      </div>

      <ul className="lista simples">
        <li className="clicavel" onClick={irAjustes}>
          <span className="nome">Salário base<small>fixo todo mês · altere em Ajustes</small></span>
          <strong>{brl(r.salarioBase)}</strong>
        </li>

        {variaveis.length > 0 ? (
          variaveis.map(linhaEntrada)
        ) : (
          <li className="clicavel" onClick={() => setEditando({ entrada: null, tipo: 'variavel' })}>
            <span className="nome">
              Variável
              <small>{r.variavelEsperado > 0 ? 'estimado · toque para informar o deste mês' : 'não informado · toque para lançar'}</small>
            </span>
            <strong>{r.variavelEsperado > 0 ? '≈ ' + brl(r.variavelEsperado) : '—'}</strong>
          </li>
        )}

        {extras.map(linhaEntrada)}
      </ul>

      {editando && <EntradaForm entrada={editando.entrada} mes={mes} tipoInicial={editando.tipo} onFechar={() => setEditando(null)} />}
    </section>
  )
}
