import { useState } from 'react'
import { desconectar, useNuvem } from '../nuvem'
import { alterar, trocarPerfil, useEstado, zerarTudo, type Estado } from '../store'
import { Campo, lerValor, paraCampo } from '../ui'

type ChaveValor = 'salario' | 'salarioPar' | 'diaADia' | 'diaADiaPar'

function Dinheiro({ chave }: { chave: ChaveValor }) {
  const e = useEstado()
  const [txt, setTxt] = useState(paraCampo(e[chave]))
  return (
    <input
      value={txt}
      inputMode="decimal"
      placeholder="0,00"
      onChange={(ev) => {
        setTxt(ev.target.value)
        alterar((x) => ({ ...x, [chave]: lerValor(ev.target.value) }))
      }}
    />
  )
}

export function Ajustes() {
  const e = useEstado()
  const nuvem = useNuvem()
  const local = nuvem.status === 'local'
  const souEu = e.perfil === 'eu'
  const [copiado, setCopiado] = useState(false)
  const texto = (chave: keyof Pick<Estado, 'nomeEu' | 'nomePar'>) => (
    <input value={e[chave]} onChange={(ev) => alterar((x) => ({ ...x, [chave]: ev.target.value }))} />
  )

  return (
    <section className="cartao pagina estreita">
      <h3>Ajustes</h3>
      <p className="apoio">
        {local ? 'Tudo fica salvo só neste navegador.' : 'Os dados são sincronizados entre os computadores da casa.'}
      </p>

      <h4>Quem está usando este computador</h4>
      <div className="abas espaco">
        <button className={souEu ? 'ativo' : ''} onClick={() => trocarPerfil('eu')}>{e.nomeEu}</button>
        <button className={souEu ? '' : 'ativo'} onClick={() => trocarPerfil('par')}>{e.nomePar}</button>
      </div>

      <h4>Seu perfil</h4>
      <div className="duas espaco">
        <Campo rotulo="Seu nome">{texto(souEu ? 'nomeEu' : 'nomePar')}</Campo>
        <Campo rotulo="Seu salário (R$)"><Dinheiro key={e.perfil} chave={souEu ? 'salario' : 'salarioPar'} /></Campo>
      </div>
      <Campo rotulo="Reserva para o dia a dia (R$)"><Dinheiro key={e.perfil} chave={souEu ? 'diaADia' : 'diaADiaPar'} /></Campo>
      <Campo rotulo="Nome da outra pessoa">{texto(souEu ? 'nomePar' : 'nomeEu')}</Campo>

      {!local && (
        <>
          <h4>Código da casa</h4>
          <p className="apoio espaco">Digite este código no outro computador para ligar à mesma casa. Quem tem o código vê os dados, então não compartilhe fora de casa.</p>
          <p className="espaco">
            <span className="codigo">{nuvem.codigo}</span>{' '}
            <button
              className="botao leve"
              onClick={() => navigator.clipboard.writeText(nuvem.codigo ?? '').then(() => setCopiado(true), () => undefined)}
            >
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </p>
        </>
      )}

      <footer>
        <button
          className="botao perigo"
          onClick={() => confirm('Apagar todas as contas e cartões dos dois perfis? Isso não pode ser desfeito.') && zerarTudo()}
        >
          Apagar todas as contas e cartões
        </button>
        {!local && (
          <button
            className="botao leve"
            onClick={() => confirm('Desligar este computador da casa? Os dados continuam na nuvem; para voltar, é só digitar o código de novo.') && desconectar()}
          >
            Desconectar este computador
          </button>
        )}
      </footer>
    </section>
  )
}
