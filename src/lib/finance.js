const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== '')

const amountValue = (value) => {
  if (value && typeof value === 'object') {
    return Number(firstDefined(value.amount, value.total, value.cost, value.value, 0)) || 0
  }
  return Number(value) || 0
}

export function normalizeFinanceStatus(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_')
}

export function getPaymentStatus(booking) {
  const explicit = firstDefined(booking?.paymentStatus, booking?.payment?.status)
  if (explicit) return normalizeFinanceStatus(explicit)
  if (booking?.paid === true) return 'PAID'
  if (booking?.refunded === true) return 'REFUNDED'
  return 'UNPAID'
}

export function getFinancialType(record) {
  const value = normalizeFinanceStatus(firstDefined(
    record?.transactionType,
    record?.paymentType,
    record?.feeType,
    record?.source,
    record?.type,
  ))
  if (value.includes('QUOTE') || value.includes('ESCROW') || record?.quote || record?.onSiteQuote || record?.quoteBreakdown) {
    return 'Quote settlement'
  }
  if (
    value.includes('BOOKING_FEE') ||
    value.includes('DIRECT') ||
    record?.bookingFee !== undefined ||
    record?.bookingFeeAmount !== undefined
  ) return 'Direct booking fee'
  return 'Unclassified'
}

export function getBookingFeeAmount(booking) {
  return amountValue(firstDefined(
    booking?.bookingFee,
    booking?.bookingFeeAmount,
    booking?.feeAmount,
    booking?.booking?.fee,
  ))
}

export function getQuoteAmount(record) {
  const quote = record?.quote || record?.onSiteQuote || record?.quoteBreakdown || record?.settlement
  const explicit = firstDefined(
    record?.settledQuoteAmount,
    record?.quoteAmount,
    record?.quoteTotal,
    quote?.totalAmount,
    quote?.total,
    quote?.amount,
    record?.settlementAmount,
  )
  if (explicit !== undefined) return amountValue(explicit)

  const parts = firstDefined(quote?.partsAmount, quote?.parts, quote?.materialsAmount, record?.partsAmount)
  const labor = firstDefined(quote?.laborAmount, quote?.labor, quote?.labourAmount, record?.laborAmount)
  if (parts !== undefined || labor !== undefined) return amountValue(parts) + amountValue(labor)
  return 0
}

export function isQuoteSettled(record) {
  const statuses = [
    record?.paymentStatus,
    record?.quotePaymentStatus,
    record?.settlementStatus,
    record?.quoteSettlementStatus,
    record?.escrowStatus,
  ].map(normalizeFinanceStatus)
  return statuses.some((status) => ['SETTLED', 'RELEASED', 'COMPLETED'].includes(status))
}
