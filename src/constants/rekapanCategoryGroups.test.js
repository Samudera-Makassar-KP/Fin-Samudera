import { canonicalizeCategoryLabel } from './rekapanCategoryGroups'

const MEETING_GROUP = {
    label: 'Meeting',
    members: ['Meals Meeting', 'Meeting', 'Biaya Meeting', 'Cemilan kue ruang meeting', 'Kue Kick off meeting hari ke 3']
}

describe('canonicalizeCategoryLabel', () => {
    test('label yang jadi anggota grup dikanonisasi ke nama grup', () => {
        expect(canonicalizeCategoryLabel('Meals Meeting', [MEETING_GROUP])).toBe('Meeting')
        expect(canonicalizeCategoryLabel('Biaya Meeting', [MEETING_GROUP])).toBe('Meeting')
        expect(canonicalizeCategoryLabel('Cemilan kue ruang meeting', [MEETING_GROUP])).toBe('Meeting')
    })

    test('label baru yang MENGANDUNG salah satu anggota grup (substring, case-insensitive) otomatis ikut tergabung', () => {
        expect(canonicalizeCategoryLabel('Snack meeting sore', [MEETING_GROUP])).toBe('Meeting')
        expect(canonicalizeCategoryLabel('MEETING mendadak', [MEETING_GROUP])).toBe('Meeting')
    })

    test('label yang tidak cocok grup mana pun dikembalikan apa adanya', () => {
        expect(canonicalizeCategoryLabel('ATK', [MEETING_GROUP])).toBe('ATK')
        expect(canonicalizeCategoryLabel('Entertaint', [MEETING_GROUP])).toBe('Entertaint')
    })

    test('tanpa groups (undefined/kosong) -> label dikembalikan apa adanya', () => {
        expect(canonicalizeCategoryLabel('Meeting', undefined)).toBe('Meeting')
        expect(canonicalizeCategoryLabel('Meeting', [])).toBe('Meeting')
    })

    test('label kosong/null -> dikembalikan apa adanya', () => {
        expect(canonicalizeCategoryLabel('', [MEETING_GROUP])).toBe('')
        expect(canonicalizeCategoryLabel(null, [MEETING_GROUP])).toBeNull()
    })

    test('cocok grup pertama yang match kalau ada lebih dari satu grup', () => {
        const groups = [
            { label: 'Parkir', members: ['Parkir'] },
            { label: 'Toll', members: ['Toll', 'Parkir Toll'] }
        ]
        expect(canonicalizeCategoryLabel('Parkir Toll', groups)).toBe('Parkir')
    })
})
