/** Gizli mesajlar — yalnızca belirli programlarda görünür */

const stripAccents = (text) => String(text || '').normalize('NFD').replace(/\p{M}/gu, '')

const norm = (text) => (
  stripAccents(text)
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/[^A-Z0-9]/g, '')
)

const isAkdenizAntalya = (item) => {
  const uni = norm(item?.university || item?.full_name?.split(' - ')[0] || '')
  if (!uni.includes('AKDENIZ')) return false
  if (uni.includes('DOGUA') || uni.includes('DOGUAKDENIZ')) return false
  return true
}

const isTargetDepartment = (item) => {
  const dept = norm(item?.department || item?.department_group || '')
  if (!dept) return false
  if (dept.startsWith('BILGISAYARMUHENDISLIGI')) return true
  if (dept.startsWith('YAPAYZEKAVEVERIMUHENDISLIGI')) return true
  return false
}

export const AKDENIZ_DEPT_EASTER_EGG = 'Dünyanın en iyi bölümü (ben buradayım çünkü)'

export const getAkdenizDeptEasterEgg = (item) => (
  item && isAkdenizAntalya(item) && isTargetDepartment(item)
    ? AKDENIZ_DEPT_EASTER_EGG
    : null
)
