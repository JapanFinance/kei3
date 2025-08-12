export const formatJPY = (amount: number) => {
  return new Intl.NumberFormat('en-JP', {
    style: 'currency',
    currency: 'JPY'
  }).format(amount)
}

export const formatYenCompact = (amount: number, locale: string = 'en-US') =>{
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'JPY',
    notation: 'compact',
    compactDisplay: 'short'
  }).format(amount)
}
