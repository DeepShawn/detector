package com.anthropic.huoyan

import org.json.JSONObject

/** 模式A 审核/证据链，移植自 js/engine-a.js。 */
class EngineA(private val d: GameData, val level: JSONObject) {
    private val rules = d.rulesA
    private val ranges = rules.getJSONObject("ranges")
    private val def = d.defaultsA
    val chainSize = rules.getInt("chainSize")
    val minChain = rules.getInt("minChain")

    val res = Res(rules.getJSONObject("start"))
    var bait: String? = null
    val picked = mutableListOf<String>()
    val asked = mutableListOf<String>()
    var outcome: String? = null
    val log = mutableListOf<LogLine>()

    val labels = linkedMapOf(
        "kpi" to "KPI", "humanity" to "人性", "suspicion" to "怀疑值",
        "familySafety" to "家庭安全", "invasion" to "侵犯度", "truth" to "真相分",
    )
    val baits get() = level.getJSONArray("baits").toStringList()

    init {
        res.add(level.optJSONObject("openEffects")); res.clamp(ranges)
        log.add(LogLine("system", level.optString("openSystem", def.getString("openSystem"))))
    }

    fun receipt(id: String): JSONObject = d.receipts.getJSONObject(id)

    fun chooseBait(id: String) {
        if (bait != null) return
        val b = d.baits.getJSONObject(id)
        bait = id
        res.add(JSONObject().put("invasion", b.getInt("invasion"))); res.clamp(ranges)
        log.add(LogLine("player", "选用诱饵外壳：${b.getString("name")}（侵犯度 +${b.getInt("invasion")}）"))
        log.add(LogLine("system", b.getString("system")))
    }

    fun dropped(): List<String> {
        val clues = level.getJSONArray("clues").toStringList().toMutableList()
        val b = bait ?: return clues
        level.optJSONObject("baitDrops")?.optJSONArray(b)?.let { clues.addAll(it.toStringList()) }
        return clues
    }

    fun toggle(id: String) {
        if (outcome != null) return
        if (picked.contains(id)) { picked.remove(id); return }
        if (!dropped().contains(id)) return
        if (picked.size >= chainSize) return
        picked.add(id)
    }

    data class Chain(val size: Int, val hasCounter: Boolean, val singleType: Boolean, val leans: String)

    fun analyze(): Chain {
        val cards = picked.map { receipt(it) }
        val types = cards.map { it.getString("traceType") }.toSet()
        val verdicts = cards.map { it.getString("points") }.toSet()
        val leans = when {
            verdicts.contains("cn") && !verdicts.contains("intl") -> "cn"
            verdicts.contains("intl") && !verdicts.contains("cn") -> "intl"
            else -> "mixed"
        }
        return Chain(cards.size, cards.any { it.optBoolean("counter") }, cards.isNotEmpty() && types.size == 1, leans)
    }

    fun ask(id: String) {
        if (asked.contains(id)) return
        asked.add(id)
        val f = level.optJSONObject("followUps")?.optString(id).orEmpty()
        log.add(LogLine("ask", f.ifEmpty { "（对方沉默，没有更多信息）" }))
    }

    fun canDecide() = bait != null && picked.size >= minChain

    fun decide(verdict: String) {
        if (outcome != null || picked.size < minChain) return
        val chain = analyze()
        val truth = level.getJSONObject("truth")
        val oc = when {
            verdict == "report" -> "reported"
            chain.singleType || !chain.hasCounter ->
                if (verdict == truth.getString("systemWants")) "misjudged" else "wrongAndPenalized"
            verdict == truth.getString("correct") -> "justice"
            else -> "wrongAndPenalized"
        }
        res.add(rules.getJSONObject("outcomes").getJSONObject(oc).getJSONObject("effects"))
        if (oc == "misjudged" || oc == "justice") res.add(JSONObject().put("suspicion", res["invasion"] / 2))
        res.clamp(ranges)
        outcome = oc
    }

    fun settle(): Settle {
        val oc = outcome!!
        val oDef = rules.getJSONObject("outcomes").getJSONObject(oc)
        val sys = Grade.systemOverride(rules, oc) ?: Grade.bySystem(rules, res["kpi"])
        val fam = level.optJSONObject("family") ?: def.getJSONObject("family").getJSONObject(oc)
        return Settle(
            outcome = oc, outcomeTitle = oDef.getString("title"), systemGrade = sys,
            truthGrade = Grade.truth(rules, oc), family = Grade.family(JSONObject().put("family", fam)),
            hiddenLine = oDef.optString("hiddenLine").ifEmpty { null },
            note = if (res["suspicion"] >= rules.getInt("selfAuditAt")) "系统：怀疑值过高。你越会抓，就越像你要抓的人。" else null,
            anchor = level.optString("anchor", def.getString("anchor")), res = res,
        )
    }
}
