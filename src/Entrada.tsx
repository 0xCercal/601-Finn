import { useState } from 'react'
import { criarCasa, desconectar, entrarNaCasa, tentarDeNovo, useNuvem } from './nuvem'
import { Campo } from './ui'

/** Telas antes do app: carregando, sem conexão e escolha da casa. */
export function Entrada() {
  const nuvem = useNuvem()
  const [codigo, setCodigo] = useState('')

  return (
    <div className="entrada">
      <div className="cartao">
        {nuvem.status === 'carregando' && <p className="apoio">Carregando…</p>}

        {nuvem.status === 'offline' && (
          <>
            <h2>Sem conexão</h2>
            <p className="aviso">{nuvem.erro}</p>
            <button className="botao primario" onClick={() => tentarDeNovo()}>Tentar de novo</button>
            <p className="ou">ou</p>
            <button className="botao leve" onClick={desconectar}>Usar outro código</button>
          </>
        )}

        {nuvem.status === 'sem-casa' && (
          <>
            <h2>Finanças da casa</h2>
            <p className="apoio">Ligue este computador à casa de vocês. Só precisa fazer isso uma vez.</p>
            {nuvem.erro && <p className="aviso">{nuvem.erro}</p>}
            <form onSubmit={(ev) => { ev.preventDefault(); void entrarNaCasa(codigo) }}>
              <Campo rotulo="Já tem o código da casa?">
                <input value={codigo} onChange={(ev) => setCodigo(ev.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" required />
              </Campo>
              <button className="botao primario">Entrar</button>
            </form>
            <p className="ou">ou</p>
            <button className="botao leve" onClick={() => void criarCasa()}>Criar a casa agora</button>
            <p className="apoio" style={{ marginTop: 10 }}>
              Criar a casa leva para ela as contas que estão neste navegador e gera o código para o outro computador.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
