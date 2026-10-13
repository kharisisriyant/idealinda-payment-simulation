import { calculatePayment, defaultScenario } from './calculator.js'
import { translate } from './i18n.js'

const ids = {
  hourlyRate: 'hourly-rate', hours: 'hours', companyShare: 'company-share',
  platformShare: 'platform-share', discount: 'discount',
  cashbackRate: 'cashback-rate', bonusRate: 'bonus-rate',
  discountOwner: 'discount-owner', stripeOwner: 'stripe-owner',
  cashbackOwner: 'cashback-owner', bonusOwner: 'bonus-owner',
}

const savedLanguage = localStorage.getItem('idealinda-language')
let language = savedLanguage === 'it' || savedLanguage === 'en'
  ? savedLanguage
  : navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en'
let euro = new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-IE', { style: 'currency', currency: 'EUR' })
const t = (key, variables) => translate(language, key, variables)
const money = value => euro.format(Math.abs(value) < 0.005 ? 0 : value)
const numberValue = id => Math.max(0, Number.parseFloat(document.getElementById(id).value) || 0)
const ownerLabel = owner => t(owner)
const costTranslationKeys = {
  'Redeemed credit': 'redeemedCredit',
  'Stripe fee': 'stripeFee',
  'Cashback reserve': 'cashbackReserve',
  'Worker bonus': 'workerBonusCost',
}
const costLabel = label => costTranslationKeys[label] ? t(costTranslationKeys[label]) : label

function applyStaticTranslations() {
  document.documentElement.lang = language
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n) })
  document.querySelectorAll('[data-i18n-title]').forEach(element => { element.title = t(element.dataset.i18nTitle) })
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel)) })
}

function getState() {
  const state = {}
  for (const [key, id] of Object.entries(ids)) {
    const element = document.getElementById(id)
    state[key] = element.tagName === 'SELECT' ? element.value : numberValue(id)
  }
  return state
}

function setText(id, value) { document.getElementById(id).textContent = value }

function renderPartyCards(result) {
  const colors = { worker: '#587bd9', company: '#7b8bad', platform: '#3f9b82' }
  document.getElementById('party-grid').innerHTML = Object.entries(result.parties).map(([key, party]) => {
    const deductions = party.costs.filter(cost => cost.amount > 0.004)
      .map(cost => `<div><dt>${costLabel(cost.label)}</dt><dd>−${money(cost.amount)}</dd></div>`).join('') || `<div><dt>${t('assignedCosts')}</dt><dd>—</dd></div>`
    return `<article class="party-card" style="--card-color:${colors[key]}">
      <header><span>${ownerLabel(key)}</span><i></i></header>
      <dl><div><dt>${t('grossEntitlement')}</dt><dd>${money(party.gross)}</dd></div>${deductions}
      <div class="net-row"><dt>${t('immediateAmount')}</dt><dd>${money(party.net)}</dd></div>
      ${party.shortfall > 0.004 ? `<div class="shortfall"><dt>${t('fundingShortfall')}</dt><dd>${money(party.shortfall)}</dd></div>` : ''}</dl>
    </article>`
  }).join('')
}

function sankeyPath(x1, y1, x2, y2) {
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}

function nodeMarkup(node) {
  const textClass = node.dark ? ' light' : ''
  return `<g class="node-card">
    <rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="13" fill="${node.fill}" stroke="${node.stroke || 'none'}" />
    <text x="${node.x + 16}" y="${node.y + 24}" class="node-label${textClass}">${node.label}</text>
    <text x="${node.x + 16}" y="${node.y + 48}" class="node-value${textClass}">${money(node.value)}</text>
    ${node.caption ? `<text x="${node.x + 16}" y="${node.y + 65}" class="node-caption${textClass}">${node.caption}</text>` : ''}
  </g>`
}

function renderSankey(result) {
  const styles = {
    worker: { color: 'url(#flow-worker)', fill: '#eef3ff', stroke: '#cfdcff' },
    company: { color: 'url(#flow-company)', fill: '#f1f3f8', stroke: '#d9dfeb' },
    platform: { color: 'url(#flow-platform)', fill: '#edf8f5', stroke: '#cae9e0' },
  }
  const outcomeStyle = label => label === 'Stripe fee'
    ? { color: 'url(#flow-fee)', fill: '#fff1ed', stroke: '#f8d2c8' }
    : { color: 'url(#flow-reward)', fill: '#f5f0ff', stroke: '#e2d7fa' }
  const buckets = Object.entries(result.parties).map(([key, party]) => {
    const outputs = []
    if (party.net > 0.004) outputs.push({ label: t(key === 'worker' ? 'workerTransfer' : key === 'company' ? 'companySettlement' : 'platformRetained'), value: party.net, ...styles[key] })
    party.costs.filter(cost => cost.label !== 'Redeemed credit' && cost.amount > 0.004)
      .forEach(cost => outputs.push({ label: costLabel(cost.label), value: cost.amount, ...outcomeStyle(cost.label) }))
    return { key, party, outputs, ...styles[key] }
  })
  const outputs = buckets.flatMap(bucket => bucket.outputs.map(output => ({ ...output, bucketKey: bucket.key })))
  const nodeHeight = 54, top = 20, gap = outputs.length > 1 ? Math.min(14, (500 - outputs.length * nodeHeight) / (outputs.length - 1)) : 0
  let nextY = top
  outputs.forEach(output => { output.y = nextY; nextY += nodeHeight + gap })
  buckets.forEach(bucket => {
    const ownOutputs = outputs.filter(output => output.bucketKey === bucket.key)
    bucket.y = ownOutputs.length ? ownOutputs.reduce((sum, output) => sum + output.y + nodeHeight / 2, 0) / ownOutputs.length - 38 : 220
  })

  const source = { x: 18, y: 210, w: 170, h: 86, label: t('grossPaid'), value: result.clientCharge, caption: result.discount ? t('afterCreditShort', { amount: money(result.discount) }) : t('noRedeemedCredit'), fill: '#2f56bd', dark: true }
  const bucketX = 355, bucketW = 190, targetX = 835, targetW = 235
  const scale = value => Math.max(3, Math.min(62, value / Math.max(result.clientCharge, 1) * 80))
  const sourceFlows = buckets.filter(bucket => bucket.party.cashInflow > 0.004).map(bucket =>
    `<path class="sankey-flow" d="${sankeyPath(source.x + source.w, source.y + source.h / 2, bucketX, bucket.y + 38)}" stroke="${bucket.color}" stroke-width="${scale(bucket.party.cashInflow)}"><title>${t('bucketTitle', { party: ownerLabel(bucket.key), amount: money(bucket.party.cashInflow) })}</title></path>`
  ).join('')
  const outcomeFlows = outputs.map(output => {
    const bucket = buckets.find(item => item.key === output.bucketKey)
    return `<path class="sankey-flow" d="${sankeyPath(bucketX + bucketW, bucket.y + 38, targetX, output.y + nodeHeight / 2)}" stroke="${output.color}" stroke-width="${scale(output.value)}"><title>${t('flowTitle', { party: ownerLabel(bucket.key), label: output.label, amount: money(output.value) })}</title></path>`
  }).join('')
  const activeBuckets = buckets.filter(bucket => bucket.party.cashInflow > 0.004 || bucket.outputs.length)
  const bucketNodes = activeBuckets.map(bucket => nodeMarkup({
    x: bucketX, y: bucket.y, w: bucketW, h: 76,
    label: t('bucket', { party: ownerLabel(bucket.key) }), value: bucket.party.cashInflow,
    caption: bucket.party.discount ? t('creditDeducted', { amount: money(bucket.party.discount) }) : t('availablePayment'),
    fill: bucket.fill, stroke: bucket.stroke,
  })).join('')
  const outcomeNodes = outputs.map(output => nodeMarkup({ x: targetX, y: output.y, w: targetW, h: nodeHeight, ...output })).join('')
  document.getElementById('sankey-flows').innerHTML = sourceFlows + outcomeFlows
  document.getElementById('sankey-nodes').innerHTML = nodeMarkup(source) + bucketNodes + outcomeNodes
}

function render() {
  applyStaticTranslations()
  const state = getState()
  const result = calculatePayment(state)
  setText('worker-share-output', `${result.workerShare}%`)
  setText('company-share-output', `${state.companyShare}%`)
  setText('platform-share-output', `${state.platformShare}%`)
  setText('gross-service-control', money(result.gross))
  setText('hero-client-charge', money(result.clientCharge))
  setText('hero-charge-note', result.discount ? t('afterCredit', { amount: money(result.discount) }) : t('noCredit'))
  setText('charge-gross', money(result.gross))
  setText('charge-discount', money(result.discount))
  setText('charge-total', money(result.clientCharge))
  setText('stripe-fee-output', money(result.stripeFee))

  const configuredShare = state.companyShare + state.platformShare
  const splitHelp = document.getElementById('split-help')
  splitHelp.textContent = configuredShare <= 100
    ? t('splitHelp', { configuredShare, workerShare: result.workerShare })
    : t('splitErrorHelp', { configuredShare, excess: configuredShare - 100 })
  splitHelp.classList.toggle('error', configuredShare > 100)

  const errors = []
  if (configuredShare > 100) errors.push(t('shareError'))
  if (state.discount > result.cashbackBase) errors.push(t('creditCapError', { amount: money(result.cashbackBase) }))
  const shortfalls = Object.entries(result.parties).filter(([, party]) => party.shortfall > 0.004)
  shortfalls.forEach(([key, party]) => errors.push(t('shortfallError', { party: ownerLabel(key), amount: money(party.shortfall) })))
  const warning = document.getElementById('warning-banner')
  warning.hidden = errors.length === 0
  warning.innerHTML = errors.join('<br>')

  const valid = configuredShare <= 100 && Math.abs(result.reconciliation) < 0.01 && !shortfalls.length
  const reconcile = document.getElementById('reconcile-chip')
  reconcile.classList.toggle('invalid', !valid)
  reconcile.innerHTML = valid
    ? `<span>✓</span> ${t('reconciled', { amount: money(result.reconciliation) })}`
    : `<span>!</span> ${t('reviewDifference', { amount: money(Math.abs(result.reconciliation)) })}`

  const policyItems = [
    t('policyDiscount', { party: ownerLabel(state.discountOwner) }),
    t('policyStripe', { fee: money(result.stripeFee), fixed: money(0.30), party: ownerLabel(state.stripeOwner) }),
    t('policyCashback', { party: ownerLabel(state.cashbackOwner) }),
    t('policyBonus', { party: ownerLabel(state.bonusOwner) }),
  ]
  setText('policy-summary', t('policyBase', { items: policyItems.join('; '), amount: money(result.cashbackBase) }))
  renderPartyCards(result)
  renderSankey(result)
}

Object.values(ids).forEach(id => {
  const element = document.getElementById(id)
  element.addEventListener('input', render)
  element.addEventListener('change', render)
})

document.getElementById('reset-button').addEventListener('click', () => {
  for (const [key, value] of Object.entries(defaultScenario)) document.getElementById(ids[key]).value = value
  render()
})

const languageSelect = document.getElementById('language-select')
languageSelect.value = language
languageSelect.addEventListener('change', () => {
  language = languageSelect.value
  localStorage.setItem('idealinda-language', language)
  euro = new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-IE', { style: 'currency', currency: 'EUR' })
  render()
})

render()
