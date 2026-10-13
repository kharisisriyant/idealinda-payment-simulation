export const defaultScenario = {
  hourlyRate: 25,
  hours: 2,
  companyShare: 20,
  platformShare: 0,
  discount: 3,
  cashbackRate: 5,
  bonusRate: 5,
  discountOwner: 'company',
  stripeOwner: 'company',
  cashbackOwner: 'company',
  bonusOwner: 'company',
}

export function calculatePayment(state) {
  const gross = state.hourlyRate * state.hours
  const workerShare = 100 - state.companyShare - state.platformShare
  const cashbackBase = gross
  const discount = Math.min(state.discount, cashbackBase)
  const clientCharge = cashbackBase - discount
  const stripeFee = Math.round((clientCharge * 0.029 + 0.30) * 100) / 100
  const workerGross = gross * workerShare / 100
  const companyGross = gross * state.companyShare / 100
  const platformGross = gross * state.platformShare / 100
  const cashback = cashbackBase * state.cashbackRate / 100
  const bonus = workerGross * state.bonusRate / 100
  const parties = {
    worker: { gross: workerGross, costs: [] },
    company: { gross: companyGross, costs: [] },
    platform: { gross: platformGross, costs: [] },
  }
  const allocate = (owner, label, amount) => parties[owner].costs.push({ label, amount })
  allocate(state.discountOwner, 'Redeemed credit', discount)
  allocate(state.stripeOwner, 'Stripe fee', stripeFee)
  allocate(state.cashbackOwner, 'Cashback reserve', cashback)
  allocate(state.bonusOwner, 'Worker bonus', bonus)
  Object.values(parties).forEach(party => {
    party.discount = party.costs
      .filter(item => item.label === 'Redeemed credit')
      .reduce((sum, item) => sum + item.amount, 0)
    party.cashInflow = Math.max(0, party.gross - party.discount)
    party.deductions = party.costs.reduce((sum, item) => sum + item.amount, 0)
    party.rawNet = party.gross - party.deductions
    party.net = Math.max(0, party.rawNet)
    party.shortfall = Math.max(0, -party.rawNet)
  })
  const totalShortfall = Object.values(parties).reduce((sum, party) => sum + party.shortfall, 0)
  const allocated = parties.worker.net + parties.company.net + parties.platform.net + stripeFee + cashback + bonus
  const reconciliation = clientCharge + totalShortfall - allocated
  return { gross, workerShare, cashbackBase, discount, clientCharge, stripeFee, cashback, bonus, parties, totalShortfall, allocated, reconciliation }
}
