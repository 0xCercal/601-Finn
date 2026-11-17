import { Minus, PiggyBank, Plus, Repeat } from 'lucide-react'
import type { ReactNode } from 'react'
import { resumo } from '../calc'
import type { PedidoLancamento } from '../Lancamento'
import { useEstado } from '../store'
import { brl, nomeDoMes } from '../ui'

function Botao({ icone, titulo, detalhe, cor, onClick }: { icone: ReactNode; titulo: string; detalhe: string; cor: string; onClick: () => void }) {
  return (
    <button className={'rapido-botao ' + cor} onClick={onClick}>
      <span className="rapido-icone">{icone}</span>
      <strong>{titulo}</strong>
      <small>{detalhe}</small>
    </button>
  )
}

/** Aba só de lançamentos rápidos: quatro botões grandes ocupando a tela. */
export function Rapido({ mes, onLancar, onNovaConta }: { mes: string; onLancar: (p: PedidoLancamento) => void; onNovaConta: () => void }) {
  const e = useEstado()
  const r = resumo(e, mes)

  return (
    <section className="rapido">
      <p className="rapido-livre">
        Livre em {nomeDoMes(mes)}: <strong className={r.disponivel < 0 ? 'negativo' : ''}>{brl(r.disponivel)}</strong>
      </p>
      <div className="rapido-grade">
        <Botao icone={<Minus size={30} />} titulo="Gasto" detalhe="Pix, débito, dinheiro ou cartão" cor="gasto" onClick={() => onLancar({ tipo: 'gasto' })} />
        <Botao icone={<Plus size={30} />} titulo="Entrada" detalhe="Variável, 13º, férias…" cor="entrada" onClick={() => onLancar({ tipo: 'receita' })} />
        <Botao icone={<PiggyBank size={30} />} titulo="Caixinha" detalhe="Guardar ou retirar" cor="caixinha" onClick={() => onLancar({ tipo: 'gasto', onde: 'caixinha' })} />
        <Botao icone={<Repeat size={30} />} titulo="Conta fixa" detalhe="Que se repete todo mês" cor="fixa" onClick={onNovaConta} />
      </div>
    </section>
  )
}
