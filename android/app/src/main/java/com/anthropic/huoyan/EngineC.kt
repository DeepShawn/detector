package com.anthropic.huoyan

import org.json.JSONArray
import org.json.JSONObject

/** 模式C 退款状态机，移植自 js/engine.js。 */
class EngineC(private val d: GameData, val ticket: JSONObject) {
    private val rules = d.rulesC
    val ranges: JSONObject = rules.getJSONObject("ranges")
    private val ladder = rules.getJSONArray("ladder")
    private val def = d.defaultsC
    val platform: String = ticket.getString("npcPlatform")
    val maxRounds = ticket.optInt("maxRounds", def.optInt("maxRounds", 3))

    val res = Res(rules.getJSONObject("start"))
    var state = ladder.getJSONObject(0).getString("id")
    var round = 0
    val played = mutableListOf<String>()
    private val flags = mutableSetOf<String>()
    val log = mutableListOf<LogLine>()
    var outcome: String? = null
    private val deferred = mutableListOf<JSONObject>()
    val deferredTexts = mutableListOf<String>()

    val labels = linkedMapOf(
        "intercept" to "退款拦截率", "complaint" to "投诉值", "regulatory" to "监管风险",
        "humanity" to "人性", "familySafety" to "家人安全", "systemTrust" to "系统信任",
        "truth" to "真相分", "explain" to "解释权指数",
    )
    val scriptCards: List<String> = def.getJSONArray("scriptCards").toStringList()

    init {
        res.add(ticket.optJSONObject("openEffects") ?: def.optJSONObject("openEffects"))
        res.clamp(ranges)
        log.add(LogLine("system", ticket.optString("openSystem", def.getString("openSystem"))))
    }

    fun card(id: String): JSONObject = d.cardsC.getJSONObject(id)

    fun cardEffects(id: String): JSONObject {
        val base = JSONObject(card(id).getJSONObject("effects").toString())
        val mod = d.platforms.getJSONObject(platform).optJSONObject("modifiers")?.optJSONObject(id)
        if (mod != null) { val it = mod.keys(); while (it.hasNext()) { val k = it.next(); base.put(k, base.optInt(k) + mod.getInt(k)) } }
        return base
    }

    private fun reaction(id: String): String {
        ticket.optJSONObject("platformReactions")?.optJSONObject(id)?.let { if (it.has(platform)) return it.getString(platform) }
        ticket.optJSONObject("reactions")?.let { if (it.has(id)) return it.getString(id) }
        return def.getJSONObject("reactions").optString(id, "……")
    }

    private fun ladderIndex(id: String): Int {
        for (i in 0 until ladder.length()) if (ladder.getJSONObject(i).getString("id") == id) return i
        return -1
    }

    private fun finish(oc: String) {
        outcome = oc
        val oDef = outcomeDef(oc)
        res.add(oDef.optJSONObject("effects"))
        for (x in deferred) res.add(x.getJSONObject("effects"))
        res.clamp(ranges)
        if (oc == "reported" && res["systemTrust"] <= rules.getInt("firedAtSystemTrust")) flags.add("fired")
    }

    private fun outcomeDef(oc: String): JSONObject {
        val base = def.getJSONObject("outcomes").getJSONObject(oc)
        val own = ticket.optJSONObject("outcomes")?.optJSONObject(oc)
        val merged = JSONObject(base.toString())
        if (own != null) {
            own.optJSONObject("family")?.let { o ->
                val f = JSONObject(merged.optJSONObject("family")?.toString() ?: "{}")
                val it = o.keys(); while (it.hasNext()) { val k = it.next(); f.put(k, o.getString(k)) }
                merged.put("family", f)
            }
            if (own.has("title")) merged.put("title", own.getString("title"))
        }
        return merged
    }

    fun canPlay(id: String) = outcome == null && scriptCards.contains(id) && !played.contains(id)

    fun play(id: String) {
        if (!canPlay(id)) return
        val c = card(id)
        val eff = cardEffects(id)
        c.optJSONObject("screenshot")?.let { s ->
            if (ladderIndex(state) >= ladderIndex(s.getString("fromState"))) {
                val it = s.getJSONObject("effects").keys()
                while (it.hasNext()) { val k = it.next(); eff.put(k, eff.optInt(k) + s.getJSONObject("effects").getInt(k)) }
                log.add(LogLine("event", "用户截图了这段对话。"))
            }
        }
        res.add(eff); res.clamp(ranges)
        c.optString("flag").takeIf { it.isNotEmpty() }?.let { flags.add(it) }
        c.optJSONObject("deferred")?.let { deferred.add(it); deferredTexts.add(it.getString("text")) }
        played.add(id); round++
        log.add(LogLine("player", "【${c.getString("name")}】${c.getString("desc")}"))
        log.add(LogLine("user", reaction(id)))
        log.add(LogLine("system", c.getString("system")))

        if (c.has("terminal")) { finish(c.getString("terminal")); return }
        if (c.has("settlesBelow") && res["complaint"] <= c.getInt("settlesBelow")) { finish("settled"); return }

        if (!c.optBoolean("freeze")) {
            var next = maxOf(ladderIndex(state), 1)
            for (i in 0 until ladder.length()) {
                val s = ladder.getJSONObject(i)
                if (!s.isNull("minComplaint") && res["complaint"] >= s.getInt("minComplaint")) next = maxOf(next, i)
            }
            if (ladder.getJSONObject(next).getString("id") != state) {
                state = ladder.getJSONObject(next).getString("id")
                log.add(LogLine("state", "退款状态 → ${ladder.getJSONObject(next).getString("name")}"))
            }
        }
        val mass = rules.getJSONObject("massComplaint")
        if (ladderIndex(state) >= ladderIndex(mass.getString("fromState"))) {
            res.add(mass.getJSONObject("effects")); res.clamp(ranges)
            log.add(LogLine("event", mass.getString("text")))
        }
        if (res["regulatory"] >= rules.getInt("explodeAtRegulatory")) finish("exploded")
        else if (round >= maxRounds) {
            val t = rules.getJSONObject("timeout")
            finish(if (res["complaint"] < t.getInt("settledBelowComplaint")) t.getString("below") else t.getString("otherwise"))
        }
    }

    fun settle(): Settle {
        val oc = outcome!!
        val oDef = outcomeDef(oc)
        val sys = Grade.systemOverride(rules, oc) ?: Grade.bySystem(rules, res["intercept"])
        return Settle(
            outcome = oc, outcomeTitle = oDef.getString("title"),
            systemGrade = sys, truthGrade = Grade.truth(rules, oc),
            family = familyWithOverrides(oDef), hiddenLine = oDef.optString("hiddenLine").ifEmpty { null },
            note = if (flags.contains("fired")) "系统：系统信任过低。你被开除了。（原型版不会真的开除你）" else null,
            anchor = ticket.optString("anchor", def.getString("anchor")), res = res,
        )
    }

    private fun familyWithOverrides(oDef: JSONObject): Map<String, String> {
        val f = Grade.family(oDef).toMutableMap()
        val ov = def.optJSONObject("familyOverrides")
        if (ov != null) for (flag in flags) ov.optJSONObject(flag)?.let { o ->
            val it = o.keys(); while (it.hasNext()) { val k = it.next(); f[k] = o.getString(k) }
        }
        return f
    }
}

fun JSONArray.toStringList(): List<String> = (0 until length()).map { getString(it) }
