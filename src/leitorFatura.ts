import { parcelaNoMes } from './calc'
import { somaMes, type Compra } from './store'

/**
 * Leitura de faturas exportadas pelo banco (CSV ou OFX).
 *
 * Cada linha vira uma compra do cartão. Linhas "Parcela 2/10" viram uma compra
 * parcelada que começou meses antes, para a projeção enxergar as parcelas futuras.
 * Cada compra importada guarda uma chave (`origem`) para não ser importada duas vezes.
 */

export interface Lancamento {
  /** 'AAAA-MM-DD' */
  data: string
  descricao: string
  /** positivo = compra; negativo = crédito, estorno ou pagamento */
  valor: number
}

export interface Candidata {
  lanc: Lancamento
  compra: Omit<Compra, 'id' | 'cartaoId'>
  parcela?: { n: number; total: number }
  /** motivo para vir desmarcada */
  aviso?: 'importado' | 'manual' | 'pagamento'
}

const semAcento = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Aceita "45.90", "45,90", "R$ 1.234,56" e "-12.50". */
function numero(txt: string) {
  const t = txt.replace(/[^\d.,-]/g, '')
  const n = parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : NaN
}

/** Aceita "2026-11-03", "03/11/2026", "03/11/26" e "20261103" (OFX). */
function dataISO(txt: string) {
  const t = txt.trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = t.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return ''
}

/** Divide uma linha de CSV respeitando campos entre aspas. */
function campos(linha: string, sep: string) {
  const r: string[] = []
  let atual = ''
  let aspas = false
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i]
    if (aspas) {
      if (ch !== '"') atual += ch
      else if (linha[i + 1] === '"') {
        atual += '"'
        i++
      } else aspas = false
    } else if (ch === '"') aspas = true
    else if (ch === sep) {
      r.push(atual)
      atual = ''
    } else atual += ch
  }
  r.push(atual)
  return r.map((c) => c.trim())
}

function lerCSV(txt: string): Lancamento[] {
  const linhas = txt.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (linhas.length < 2) throw new Error('O arquivo não tem lançamentos.')
  const sep = linhas[0].split(';').length > linhas[0].split(',').length ? ';' : ','
  const cab = campos(linhas[0], sep).map(semAcento)
  const achar = (re: RegExp) => cab.findIndex((c) => re.test(c))
  const iData = achar(/^(date|data)/)
  const iDesc = achar(/(title|descri|estabelecimento|historico|lancamento)/)
  const iValor = achar(/(amount|valor)/)
  if (iData < 0 || iDesc < 0 || iValor < 0) {
    throw new Error('Não reconheci as colunas do CSV. Ele precisa ter data, descrição e valor.')
  }
  return linhas
    .slice(1)
    .map((l) => campos(l, sep))
    .map((c) => ({ data: dataISO(c[iData] ?? ''), descricao: c[iDesc] ?? '', valor: numero(c[iValor] ?? '') }))
    .filter((l) => l.data && l.descricao && Number.isFinite(l.valor))
}

function lerOFX(txt: string): Lancamento[] {
  const entidades = (t: string) =>
    t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  return txt
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((bloco) => {
      const tag = (n: string) => entidades(bloco.match(new RegExp('<' + n + '>([^<\\r\\n]*)', 'i'))?.[1]?.trim() ?? '')
      return { data: dataISO(tag('DTPOSTED')), descricao: tag('MEMO') || tag('NAME'), valor: numero(tag('TRNAMT')) }
    })
    .filter((l) => l.data && l.descricao && Number.isFinite(l.valor))
}

export function lerArquivoFatura(nome: string, texto: string): Lancamento[] {
  const l = /\.ofx$/i.test(nome) || /<OFX>/i.test(texto) ? lerOFX(texto) : lerCSV(texto)
  // cada banco usa um sinal; aqui compra é positiva. Se a maioria vier negativa, inverte.
  return l.filter((x) => x.valor < 0).length > l.length / 2 ? l.map((x) => ({ ...x, valor: -x.valor })) : l
}

const PARCELA = [/\s*[-–]?\s*parcela\s+(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*$/i, /\s+(\d{1,2})\/(\d{1,2})\s*$/]

/** "Loja - Parcela 2/10" → { base: "Loja", n: 2, total: 10 } */
function separarParcela(desc: string) {
  for (const re of PARCELA) {
    const m = desc.match(re)
    if (!m || m.index === undefined) continue
    const n = Number(m[1])
    const total = Number(m[2])
    if (total > 1 && total <= 48 && n >= 1 && n <= total) return { base: desc.slice(0, m.index).trim() || desc, n, total }
  }
  return null
}

const centavos = (v: number) => Math.round(v * 100) / 100

/** Transforma os lançamentos em compras da fatura `faturaMes`, marcando as que parecem repetidas. */
export function paraCompras(lancs: Lancamento[], faturaMes: string, existentes: Compra[]): Candidata[] {
  const origens = new Set(existentes.map((c) => c.origem).filter(Boolean))
  const vistos = new Map<string, number>()

  return lancs.map((lanc) => {
    const p = separarParcela(lanc.descricao)
    const valorParcela = centavos(lanc.valor)
    const compra = p
      ? { descricao: p.base, valor: centavos(valorParcela * p.total), parcelas: p.total, mes: somaMes(faturaMes, -(p.n - 1)) }
      : { descricao: lanc.descricao, valor: valorParcela, parcelas: 1, mes: faturaMes }

    // a mesma compra repetida no arquivo (dois cafés iguais no mesmo dia) ganha um sufixo
    const chave = p
      ? `parc|${semAcento(p.base)}|${p.total}|${compra.mes}|${valorParcela.toFixed(2)}`
      : `${lanc.data}|${semAcento(lanc.descricao)}|${valorParcela.toFixed(2)}`
    const k = vistos.get(chave) ?? 0
    vistos.set(chave, k + 1)
    const origem = k ? `${chave}#${k}` : chave

    let aviso: Candidata['aviso']
    if (lanc.valor < 0 && /pagamento/i.test(lanc.descricao)) aviso = 'pagamento'
    else if (origens.has(origem)) aviso = 'importado'
    else if (existentes.some((x) => !x.origem && Math.abs((parcelaNoMes(x, faturaMes)?.valor ?? NaN) - valorParcela) < 0.01)) {
      aviso = 'manual'
    }

    return { lanc, compra: { ...compra, origem }, parcela: p ? { n: p.n, total: p.total } : undefined, aviso }
  })
}
