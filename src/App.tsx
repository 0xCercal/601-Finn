import { ArrowLeftRight, Building2, ChevronLeft, ChevronRight, CreditCard, LayoutGrid, Moon, Plus, Settings, Sun, Target, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ContaForm } from './forms'
import { Ajustes } from './pages/Ajustes'
import { Cartoes } from './pages/Cartoes'
import { Contas } from './pages/Contas'
import { Fluxo } from './pages/Fluxo'
import { Metas } from './pages/Metas'
import { Geral } from './pages/Geral'
import { visao } from './calc'
import { Entrada } from './Entrada'
import { useNuvem } from './nuvem'
import { alterar, mesAtual, somaMes, trocarPerfil, useEstado, type Conta } from './store'
import { cor } from './ui'

export type Pagina = 'geral' | 'fluxo' | 'contas' | 'cartoes' | 'metas' | 'ajustes'

const MENU: { id: Pagina; rotulo: string; curto: string; Icone: typeof LayoutGrid }[] = [
  { id: 'geral', rotulo: 'Visão geral', curto: 'Início', Icone: LayoutGrid },
  { id: 'fluxo', rotulo: 'Fluxo de caixa', curto: 'Fluxo', Icone: TrendingUp },
  { id: 'contas', rotulo: 'Contas', curto: 'Contas', Icone: Building2 },
  { id: 'cartoes', rotulo: 'Cartões', curto: 'Cartões', Icone: CreditCard },
  { id: 'metas', rotulo: 'Objetivos', curto: 'Metas', Icone: Target },
  { id: 'ajustes', rotulo: 'Ajustes', curto: 'Ajustes', Icone: Settings },
]

export default function App() {
  const e = useEstado()
  const nuvem = useNuvem()
  const [pagina, setPagina] = useState<Pagina>('geral')
  const [mes, setMes] = useState(mesAtual())
  const [conta, setConta] = useState<Conta | 'nova' | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = e.tema
  }, [e.tema])

  const [ano, m] = mes.split('-').map(Number)
  const nomeMes = new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
  const v = visao(e)
  const trocarTema = () => alterar((x) => ({ ...x, tema: x.tema === 'claro' ? 'escuro' : 'claro' }))

  if (nuvem.status !== 'local' && nuvem.status !== 'pronto') return <Entrada />

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <span className="logo"><ArrowLeftRight size={16} /></span>
          <div>
            <strong>Finanças</strong>
            <small>{e.nomeEu} &amp; {e.nomePar}</small>
          </div>
        </div>
        <nav>
          {MENU.map(({ id, rotulo, Icone }) => (
            <button key={id} className={pagina === id ? 'ativo' : ''} onClick={() => setPagina(id)}>
              <Icone size={16} /> {rotulo}
            </button>
          ))}
        </nav>
        <button className="perfil" onClick={() => trocarPerfil()} title="Trocar de perfil">
          <span className={'avatar ' + cor(v.eu)}>{v.nome.trim()[0]?.toUpperCase() ?? '?'}</span>
          <span>
            <strong>{v.nome}</strong>
            <small>Trocar para {v.nomeOutro}</small>
          </span>
        </button>
        <button className="tema" onClick={trocarTema}>
          {e.tema === 'claro' ? <Moon size={16} /> : <Sun size={16} />} Tema {e.tema === 'claro' ? 'escuro' : 'claro'}
        </button>
      </aside>

      <main>
        <header className="topo cartao">
          <button className="icone" onClick={() => setMes(somaMes(mes, -1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
          <button className="icone" onClick={() => setMes(somaMes(mes, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
          <h1>
            {nomeMes[0].toUpperCase() + nomeMes.slice(1)} <span>{ano}</span>
          </h1>
          {mes !== mesAtual() && <button className="botao leve" onClick={() => setMes(mesAtual())}>Hoje</button>}
          <button className="botao primario so-desktop" onClick={() => setConta('nova')}><Plus size={16} /> Adicionar</button>
        </header>

        {nuvem.erro && <p className="aviso">{nuvem.erro}</p>}

        {pagina === 'geral' && <Geral mes={mes} ir={setPagina} />}
        {pagina === 'contas' && <Contas mes={mes} onEditar={setConta} />}
        {pagina === 'cartoes' && <Cartoes mes={mes} />}
        {pagina === 'fluxo' && <Fluxo mes={mes} />}
        {pagina === 'metas' && <Metas />}
        {pagina === 'ajustes' && <Ajustes />}
      </main>

      <nav className="inferior">
        {MENU.map(({ id, curto, Icone }) => (
          <button key={id} className={pagina === id ? 'ativo' : ''} onClick={() => setPagina(id)}>
            <Icone size={18} /> {curto}
          </button>
        ))}
      </nav>
      <button className="fab" onClick={() => setConta('nova')} aria-label="Adicionar conta"><Plus size={24} /></button>

      {conta && <ContaForm conta={conta === 'nova' ? null : conta} mes={mes} onFechar={() => setConta(null)} />}
    </div>
  )
}
