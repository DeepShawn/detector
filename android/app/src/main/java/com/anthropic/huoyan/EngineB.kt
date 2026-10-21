package com.anthropic.huoyan

import org.json.JSONObject

/** 模式B 识破诱饵/举报，移植自 js/engine-b.js。 */
class EngineB(private val d: GameData, val level: JSONObject) {
    private val rules = d.rulesB
    private val ranges = rules.getJSONObject("ranges")
    private val def = d.defaultsB

    val res = Res(rules.getJSONObject("start"))
    val responses = linkedMapOf<String, String>()
    var outcome: String? = null
    val log = mutableListOf<LogLine>()

    val labels = linkedMapOf(
        "disguise" to "伪装值", "consistency" to "一致性", "alertness" to "警觉值",
        "systemTrust" to "系统信任", "familySafety" to "家人安全", "truth" to "真相分",
    )
    val modules get() = level.getJSONArray("modules")
    val masks get() = level.getJSONArray("masks").toStringList()

    init {
        res.add(level.optJSONObject("openEffects")); res.clamp(ranges)
        log.add(LogLine("system", level.optString("openSystem", def.getString("openSystem"))))
    }

    fun mask(id: String): JSONObject = d.masks.getJSONObject(id)

    fun module(id: String): JSONObject? {
        for (i in 0 until modules.length()) if (modules.getJSONObject(i).getString("id") == id) return modules.getJSONObject(i)
        return null
    }

    fun respond(moduleId: String, action: String) {
        if (outcome != null) return
        if (module(moduleId) == null) return
        if (action != "skip" && action != "fill" && !d.masks.has(action)) return
        responses[moduleId] = action
    }

    fun preview(): Res {
        val p = Res(JSONObject("{\"disguise\":0,\"consistency\":0,\"alertness\":0,\"systemTrust\":0,\"familySafety\":0,\"truth\":0,\"explain\":0}"))
        for (i in 0 until modules.length()) {
            val m = modules.getJSONObject(i)
            when (val a = responses[m.getString("id")]) {
                null -> {}
                "fill" -> p.add(m.getJSONObject("fill"))
                "skip" -> p.add(m.getJSONObject("skip"))
                else -> p.add(mask(a).getJSONObject("effects"))
            }
        }
        return p
    }

    fun allAnswered(): Boolean {
        for (i in 0 until modules.length()) if (!responses.containsKey(modules.getJSONObject(i).getString("id"))) return false
        return true
    }

    fun submit(mode: String) {
        if (outcome != null) return
        if (mode == "report") {
            res.add(rules.getJSONObject("outcomes").getJSONObject("reported").getJSONObject("effects")); res.clamp(ranges)
            outcome = "reported"
            log.add(LogLine("player", "识破这是诱饵，举报并拒绝填写。"))
            return
        }
        if (!allAnswered()) return
        val p = preview()
        for (k in p.keys) res.add(JSONObject().put(k, p[k]))
        res.clamp(ranges)
        val oc = when {
            res["alertness"] >= rules.getInt("caughtAtAlert") -> "caught"
            res["disguise"] >= rules.getInt("recruitAtDisguise") && res["consistency"] >= rules.getInt("recruitAtConsistency") -> "recruited"
            else -> "passed"
        }
        res.add(rules.getJSONObject("outcomes").getJSONObject(oc).getJSONObject("effects")); res.clamp(ranges)
        outcome = oc
    }

    fun settle(): Settle {
        val oc = outcome!!
        val oDef = rules.getJSONObject("outcomes").getJSONObject(oc)
        val sys = Grade.systemOverride(rules, oc) ?: Grade.bySystem(rules, res["systemTrust"])
        val fam = level.optJSONObject("family") ?: def.getJSONObject("family").getJSONObject(oc)
        return Settle(
            outcome = oc, outcomeTitle = oDef.getString("title"), systemGrade = sys,
            truthGrade = Grade.truth(rules, oc), family = Grade.family(JSONObject().put("family", fam)),
            hiddenLine = oDef.optString("hiddenLine").ifEmpty { null },
            note = if (oc == "recruited") "系统：恭喜晋升“纯度顾问”。从今天起，你来审你的家人。" else null,
            anchor = level.optString("anchor", def.getString("anchor")), res = res,
        )
    }
}
