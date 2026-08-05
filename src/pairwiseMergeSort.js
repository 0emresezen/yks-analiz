/**
 * Interactive merge sort with transitivity graph optimization.
 * User answers replace machine comparisons during merge steps.
 */

export class PreferenceGraph {
  constructor() {
    this.beats = new Map()
  }

  record(winnerId, loserId) {
    if (winnerId === loserId) return
    if (!this.beats.has(winnerId)) this.beats.set(winnerId, new Set())
    this.beats.get(winnerId).add(loserId)
  }

  hasDirect(winnerId, loserId) {
    return this.beats.get(winnerId)?.has(loserId) ?? false
  }

  prefers(aId, bId) {
    if (this.canReach(aId, bId)) return aId
    if (this.canReach(bId, aId)) return bId
    return null
  }

  canReach(from, to) {
    if (from === to) return true
    const visited = new Set()
    const queue = [from]
    while (queue.length) {
      const cur = queue.shift()
      if (cur === to) return true
      if (visited.has(cur)) continue
      visited.add(cur)
      const next = this.beats.get(cur)
      if (next) {
        for (const n of next) queue.push(n)
      }
    }
    return false
  }
}

export class MergeSortWizard {
  constructor(candidates) {
    this.candidates = candidates
    this.graph = new PreferenceGraph()
    this.comparisons = []
    this.userAnswers = []
    this.result = null
    this.level = candidates.map((c) => [c])
    this.mergeState = null
    this.currentQuestion = null
  }

  static fromUserAnswers(candidates, userAnswers) {
    const wizard = new MergeSortWizard(candidates)
    for (const ans of userAnswers) {
      wizard.advance()
      if (!wizard.currentQuestion) break
      wizard.submitAnswer(ans.choice)
    }
    wizard.advance()
    return wizard
  }

  getEstimatedMaxQuestions() {
    const n = this.candidates.length
    if (n <= 1) return 0
    return Math.ceil(n * Math.log2(n))
  }

  isComplete() {
    return this.result !== null
  }

  getResult() {
    return this.result
  }

  advance() {
    while (!this.result) {
      if (!this.mergeState) {
        if (this.level.length <= 1) {
          this.result = this.level[0] || []
          this.currentQuestion = null
          return
        }
        const left = this.level.shift()
        const right = this.level.shift()
        this.mergeState = { left, right, out: [], li: 0, ri: 0 }
      }

      const step = this.mergeStep()
      if (step === 'need_question') return
    }
    this.currentQuestion = null
  }

  mergeStep() {
    const ms = this.mergeState
    const { left, right } = ms
    let { li, ri } = ms

    if (li >= left.length) {
      ms.out.push(...right.slice(ri))
      this.finishMerge()
      return 'merge_done'
    }
    if (ri >= right.length) {
      ms.out.push(...left.slice(li))
      this.finishMerge()
      return 'merge_done'
    }

    const a = left[li]
    const b = right[ri]
    const pref = this.graph.prefers(a.id, b.id)

    if (pref === a.id) {
      if (!this.graph.hasDirect(a.id, b.id) && !this.graph.hasDirect(b.id, a.id)) {
        this.comparisons.push({ idA: a.id, idB: b.id, choice: 'A', inferred: true })
      }
      ms.out.push(a)
      ms.li++
      return 'auto'
    }

    if (pref === b.id) {
      if (!this.graph.hasDirect(a.id, b.id) && !this.graph.hasDirect(b.id, a.id)) {
        this.comparisons.push({ idA: a.id, idB: b.id, choice: 'B', inferred: true })
      }
      ms.out.push(b)
      ms.ri++
      return 'auto'
    }

    const compIdx = this.comparisons.length
    this.comparisons.push({ idA: a.id, idB: b.id, choice: null, inferred: false })
    this.currentQuestion = { itemA: a, itemB: b, comparisonIndex: compIdx }
    return 'need_question'
  }

  finishMerge() {
    this.level.push(this.mergeState.out)
    this.mergeState = null
  }

  submitAnswer(choice) {
    const q = this.currentQuestion
    if (!q || (choice !== 'A' && choice !== 'B')) return

    const winner = choice === 'A' ? q.itemA : q.itemB
    const loser = choice === 'A' ? q.itemB : q.itemA
    this.graph.record(winner.id, loser.id)

    const comp = this.comparisons[q.comparisonIndex]
    if (comp) {
      comp.choice = choice
      comp.inferred = false
    }

    this.userAnswers.push({ idA: q.itemA.id, idB: q.itemB.id, choice })

    const ms = this.mergeState
    if (choice === 'A') {
      ms.out.push(q.itemA)
      ms.li++
    } else {
      ms.out.push(q.itemB)
      ms.ri++
    }

    this.currentQuestion = null
  }

  undoLastUserAnswer() {
    if (!this.userAnswers.length) return false
    this.userAnswers.pop()
    this.rebuild()
    return true
  }

  truncateFromUserAnswerIndex(userIdx) {
    this.userAnswers = this.userAnswers.slice(0, userIdx)
    this.rebuild()
  }

  rebuild() {
    const saved = [...this.userAnswers]
    Object.assign(this, {
      graph: new PreferenceGraph(),
      comparisons: [],
      userAnswers: [],
      result: null,
      level: this.candidates.map((c) => [c]),
      mergeState: null,
      currentQuestion: null,
    })
    for (const ans of saved) {
      this.advance()
      if (!this.currentQuestion) break
      this.submitAnswer(ans.choice)
    }
    this.advance()
  }

  getUserAnswerIndexForComparison(comparisonIndex) {
    const comp = this.comparisons[comparisonIndex]
    if (!comp || comp.inferred || !comp.choice) return -1
    let userIdx = 0
    for (let i = 0; i < comparisonIndex; i++) {
      const c = this.comparisons[i]
      if (!c.inferred && c.choice) userIdx++
    }
    return userIdx
  }
}
