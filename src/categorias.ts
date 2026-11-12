/**
 * Categorias de gasto e categorização automática pelo nome do estabelecimento.
 *
 * Ordem de decisão para uma compra ou gasto:
 *   1. categoria escolhida só para aquele item
 *   2. regra aprendida para o estabelecimento (quando você corrige e marca "usar para todas")
 *   3. palavras-chave abaixo (iFood → delivery, Uber → transporte…)
 *   4. "outros"
 */

export type Categoria =
  | 'mercado' | 'delivery' | 'transporte' | 'saude' | 'compras' | 'assinaturas'
  | 'lazer' | 'casa' | 'educacao' | 'viagem' | 'outros'

export const NOMES_CATEGORIA: Record<Categoria, string> = {
  mercado: 'Mercado e padaria',
  delivery: 'Restaurantes e delivery',
  transporte: 'Transporte',
  saude: 'Saúde',
  compras: 'Compras',
  assinaturas: 'Assinaturas',
  lazer: 'Lazer',
  casa: 'Casa e pets',
  educacao: 'Educação',
  viagem: 'Viagem',
  outros: 'Outros',
}

export const ORDEM_CATEGORIAS = Object.keys(NOMES_CATEGORIA) as Categoria[]

/** Minúsculas, sem acento, só letras, números e "&", espaços simples. */
export function normalizar(txt: string) {
  return txt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, ' ')
    .trim()
}

/**
 * Palavras-chave por categoria. A ordem importa: a primeira que bater vence
 * (ex.: "amazon prime" é assinatura antes de "amazon" ser compra; "uber eats" é delivery antes de "uber").
 */
const REGRAS: [Categoria, RegExp][] = [
  ['assinaturas', /\b(netflix|spotify|amazon prime|prime video|primevideo|disney|hbo|max com|globoplay|youtube|apple com|icloud|google (one|storage|play)|deezer|paramount|crunchyroll|chatgpt|openai|anthropic|claude ai|microsoft|xbox game pass|playstation plus|ps plus|canva|adobe|dropbox|kindle unlimited|audible|tidal|mubi|telecine|premiere|nubank vida)\b/],
  ['delivery', /\b(ifood|i food|rappi|uber ?eats|ze delivery|aiqfome|restaurante\w*|rest |lanchonete|lanches|pizza\w*|pizzaria|burger|hamburg\w*|mcdonald|mc donald|bk brasil|burger king|subway|outback|starbucks|cafeteria\w*|coffee|sushi|temaki|churrasc\w*|habibs|giraffas|spoleto|madero|coco bambu|china in box|kfc|popeyes|jeronimo|bobs|acai|sorvet\w*|doceria|confeitaria\w*|bistro|cantina|esfiha)\b/],
  ['compras', /\b(amazon|amzn|mercado ?livre|mercadolivre|mercado ?pago|mercadopago|mp |shopee|magalu|magazine luiza|americanas|casas bahia|aliexpress|shein|temu|renner|riachuelo|c&a|cea |zara|centauro|netshoes|kabum|fast shop|fastshop|ponto frio|dafiti|nike|adidas|decathlon|havan|hering|marisa|pernambucanas|leader|kalunga|boticario|natura|sephora|o boticario|avon|eudora|apple store)\b/],
  ['transporte', /\b(uber|99 ?(app|pop|taxi|tecnologia)?|99app|cabify|indrive|posto|auto posto|combust\w*|gasolina|shell|ipiranga|petrobras|br mania|ale combust|estacion\w*|estapar|zona azul|sem parar|semparar|conectcar|veloe|move mais|taggy|pedagio|metro|cptm|sptrans|bilhete unico|riocard|taxi|localiza|movida|unidas|blablacar|buser|clickbus)\b/],
  ['saude', /\b(farmac\w*|drogar\w*|droga raia|drogasil|raia|pacheco|panvel|pague menos|onofre|sao joao|nissei|clinica\w*|laborat\w*|hospital\w*|odonto\w*|dentist\w*|unimed|amil|sulamerica|bradesco saude|hapvida|psicolog\w*|fisioter\w*|otica|oticas|academia|smart ?fit|smartfit|bluefit|gympass|wellhub|totalpass|crossfit|nutri)\b/],
  ['viagem', /\b(latam|gol linhas|gol trans|azul linhas|voeazul|azul s a|airbnb|booking|hotel|hoteis|pousada|hostel|decolar|123milhas|123 milhas|cvc|expedia|trivago|smiles|maxmilhas|rodoviaria)\b/],
  ['educacao', /\b(escola\w*|colegio\w*|faculdade\w*|universidade\w*|curso|cursos|udemy|alura|coursera|domestika|hotmart|livraria\w*|saraiva|leitura|cultura|estante virtual|duolingo|babbel|wizard|ccaa|fisk|cna|open english)\b/],
  ['lazer', /\b(cinema|cinemark|kinoplex|cinepolis|uci|ingresso|ingressos|sympla|eventim|ticketmaster|tickets for fun|steam|playstation|psn|nintendo|xbox|epic games|riot|bar|boteco|cervej\w*|choper|adega|teatro|museu|parque|show|balada|clube|boliche|karaoke)\b/],
  ['casa', /\b(leroy|telhanorte|tok ?stok|tokstok|camicado|etna|mobly|madeiramadeira|madeira madeira|ferragem\w*|ferragens|material de constr\w*|materiais de constr\w*|eletrica|hidraulica|casa e video|lojas cem|petz|cobasi|petlove|pet shop|petshop|veterin\w*|lavanderia|chaveiro|vidracaria)\b/],
  ['mercado', /\b(supermerc\w*|super merc\w*|mercado|mercadinho|mercearia\w*|minimercado|carrefour|pao de acucar|extra|assai|atacad\w*|atacarejo|dia brasil|hortifruti|hortifrut\w*|sacolao|oba|st marche|zaffari|guanabara|sams club|makro|tenda|savegnago|comper|condor|muffato|angeloni|bistek|giassi|nagumo|padaria|panificadora\w*|acougue\w*|emporio|quitanda|feira|sacolao)\b/],
]

/** Parte do nome que identifica o estabelecimento ("Uber *Trip 1234" → "uber trip"). */
export function chaveEstabelecimento(descricao: string) {
  return normalizar(descricao)
    .replace(/\bparcela \d+( de)? \d+\b/, '')
    .split(' ')
    .filter((p) => p && !/^\d+$/.test(p))
    .slice(0, 3)
    .join(' ')
}

/** Categoria pelas palavras-chave, ou null se nenhuma bater. */
export function categoriaAutomatica(descricao: string): Categoria | null {
  const t = ' ' + normalizar(descricao) + ' '
  for (const [cat, re] of REGRAS) if (re.test(t)) return cat
  return null
}

/** Categoria final de um item, seguindo a ordem descrita no topo do arquivo. */
export function categoriaDe(item: { descricao: string; categoria?: Categoria }, regras: Record<string, Categoria> = {}): Categoria {
  return item.categoria ?? regras[chaveEstabelecimento(item.descricao)] ?? categoriaAutomatica(item.descricao) ?? 'outros'
}
