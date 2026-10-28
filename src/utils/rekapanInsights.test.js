import {
    BBM_INSIGHT_KEY,
    buildCategoryDetail,
    buildCategorySuggestions,
    buildCostOutlook,
    filterCategories,
    monthRange,
    percentChange,
    projectFullYear,
    totalsByCategory
} from './rekapanInsights'

const months = (values) => {
    const result = Array(12).fill(0)
    Object.entries(values).forEach(([month, amount]) => { result[Number(month)] = amount })
    return result
}

describe('totalsByCategory', () => {
    it('menggabungkan BBM sebagai satu kategori dan hanya menjumlah bulan yang diminta', () => {
        const categoryData = { ATK: { 'PT A': months({ 0: 100, 5: 50 }), 'PT B': months({ 1: 20 }) } }
        const bbmTotals = { 'PT A': months({ 0: 300, 11: 999 }) }
        expect(totalsByCategory(categoryData, bbmTotals, monthRange(6))).toEqual({ [BBM_INSIGHT_KEY]: 300, ATK: 170 })
    })
})

describe('filterCategories', () => {
    it('hanya menyisakan kategori yang dipilih, kosong = semua', () => {
        const byCat = { BBM: 10, ATK: 5, RTG: 1 }
        expect(filterCategories(byCat, new Set(['BBM', 'RTG']))).toEqual({ BBM: 10, RTG: 1 })
        expect(filterCategories(byCat, new Set())).toBe(byCat)
        expect(filterCategories(byCat, null)).toBe(byCat)
    })
})

describe('percentChange & projectFullYear', () => {
    it('null kalau tahun lalu nol', () => {
        expect(percentChange(0, 100)).toBeNull()
        expect(percentChange(200, 150)).toBe(-25)
    })

    it('proyeksi linear dari rata-rata bulanan', () => {
        expect(projectFullYear(1000, 10)).toBe(1200)
        expect(projectFullYear(1000, 12)).toBe(1000)
    })
})

describe('buildCostOutlook', () => {
    const outlook = buildCostOutlook({
        prevFullByCat: { ATK: 1200, BBM: 2400 },
        prevSamePeriodByCat: { ATK: 1000, BBM: 2000 },
        currentByCat: { ATK: 1100, BBM: 1500 },
        monthsElapsed: 10,
        targetReductionPct: 10
    })

    it('kartu tahun lalu, tahun berjalan, dan target', () => {
        expect(outlook.previousYearTotal).toBe(3600)
        expect(outlook.topPreviousCategory).toEqual({ category: 'BBM', amount: 2400 })
        expect(outlook.currentTotal).toBe(2600)
        expect(outlook.previousSamePeriodTotal).toBe(3000)
        expect(outlook.changeAmount).toBe(-400)
        expect(outlook.changePct).toBeCloseTo(-13.33, 1)
        expect(outlook.projectedCurrentYearTotal).toBe(3120)
        expect(outlook.targetNextYearTotal).toBeCloseTo(2808)
        expect(outlook.targetSaving).toBeCloseTo(312)
    })

    it('baris kategori terurut dari biaya terbesar tahun ini', () => {
        expect(outlook.categories.map((row) => row.category)).toEqual(['BBM', 'ATK'])
        expect(outlook.categories[1].changePct).toBeCloseTo(10)
    })
})

describe('buildCategorySuggestions', () => {
    it('BBM menyebut plat terboros dan target', () => {
        const row = { category: BBM_INSIGHT_KEY, current: 1500, changePct: 12, changeAmount: 160, share: 60, target: 1620, saving: 180 }
        const detail = {
            topUnits: [{ name: 'PT A', amount: 1500, share: 100 }],
            topPlats: [{ name: 'DD 1234 AB', amount: 900, liter: 90, share: 60 }],
            topJenis: [{ name: 'BBM Pertamax', amount: 1000, share: 66 }]
        }
        const suggestions = buildCategorySuggestions(row, detail).join(' | ')
        expect(suggestions).toContain('Naik 12%')
        expect(suggestions).toContain('DD 1234 AB')
        expect(suggestions).toContain('non-subsidi')
        expect(suggestions).toContain('Target tahun depan')
    })

    it('kategori ATK memakai saran ATK, kategori Fasilitas tidak tertukar dengan IT', () => {
        const base = { current: 100, changePct: 0, changeAmount: 0, share: 5, target: 90, saving: 10 }
        expect(buildCategorySuggestions({ ...base, category: 'ATK' }).join(' ')).toContain('dokumen digital')
        expect(buildCategorySuggestions({ ...base, category: 'Fasilitas' }).join(' ')).not.toContain('preventive maintenance')
    })
})

describe('buildCategoryDetail', () => {
    it('unit penyumbang terbesar untuk kategori non-BBM', () => {
        const categoryData = { ATK: { 'PT A': months({ 0: 300 }), 'PT B': months({ 0: 100 }) } }
        const detail = buildCategoryDetail('ATK', { categoryData, monthIndexes: monthRange(12) })
        expect(detail.topUnits[0]).toEqual({ name: 'PT A', amount: 300, share: 75 })
    })
})
