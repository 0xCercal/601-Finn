import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Cor fixa de cada pessoa: a primeira é azul, a segunda é rosa. */
export const cor = (q: 'eu' | 'par') => (q === 'eu' ? 'azul' : 'rosa')

export const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0)

/** Aceita "1.234,56", "1234,56" e "1234.56". */
export function lerValor(txt: string) {
  const t = txt.trim().replace(/[^\d.,-]/g, '')
  const n = parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : 0
}

export const paraCampo = (v: number) => (v ? v.toFixed(2).replace('.', ',') : '')

/** Valor em destaque: "R$" e centavos menores, como no layout. */
export function Valor({ v, className = '' }: { v: number; className?: string }) {
  const [int, cent] = Math.abs(v)
    .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(',')
  return (
    <span className={'valor ' + className}>
      <small>{v < 0 ? '− ' : ''}R$</small> {int}
      <small>,{cent}</small>
    </span>
  )
}

export function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => ev.key === 'Escape' && onFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onFechar])

  return (
    <div className="modal-fundo" onMouseDown={(ev) => ev.target === ev.currentTarget && onFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button className="icone" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  )
}

export function Check({ marcado, onClick, rotulo }: { marcado: boolean; onClick: () => void; rotulo: string }) {
  return (
    <button
      className={'check' + (marcado ? ' marcado' : '')}
      onClick={(ev) => {
        ev.stopPropagation()
        onClick()
      }}
      role="checkbox"
      aria-checked={marcado}
      aria-label={rotulo}
    >
      {marcado && '✓'}
    </button>
  )
}
