package com.anthropic.huoyan

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** 从 assets/data 读取全部关卡数据。内容与引擎分离，全部虚构。 */
class GameData private constructor(
    val cardsC: JSONObject,
    val platforms: JSONObject,
    val rulesC: JSONObject,
    val defaultsC: JSONObject,
    val ticketsC: JSONArray,
    val receipts: JSONObject,
    val baits: JSONObject,
    val rulesA: JSONObject,
    val defaultsA: JSONObject,
    val levelsA: JSONArray,
    val masks: JSONObject,
    val rulesB: JSONObject,
    val defaultsB: JSONObject,
    val levelsB: JSONArray,
) {
    companion object {
        @Volatile private var instance: GameData? = null

        fun get(ctx: Context): GameData = instance ?: synchronized(this) {
            instance ?: load(ctx).also { instance = it }
        }

        private fun read(ctx: Context, name: String): JSONObject =
            JSONObject(ctx.assets.open("data/$name").bufferedReader().use { it.readText() })

        private fun load(ctx: Context): GameData {
            val modeC = read(ctx, "mode-c.json")
            val modeA = read(ctx, "mode-a.json")
            val modeB = read(ctx, "mode-b.json")
            return GameData(
                cardsC = read(ctx, "cards-c.json").getJSONObject("cards"),
                platforms = read(ctx, "platforms.json").getJSONObject("platforms"),
                rulesC = read(ctx, "rules-c.json"),
                defaultsC = modeC.getJSONObject("defaults"),
                ticketsC = modeC.getJSONArray("tickets"),
                receipts = read(ctx, "receipts.json").getJSONObject("receipts"),
                baits = read(ctx, "baits.json").getJSONObject("baits"),
                rulesA = read(ctx, "rules-a.json"),
                defaultsA = modeA.getJSONObject("defaults"),
                levelsA = modeA.getJSONArray("levels"),
                masks = read(ctx, "masks.json").getJSONObject("masks"),
                rulesB = read(ctx, "rules-b.json"),
                defaultsB = modeB.getJSONObject("defaults"),
                levelsB = modeB.getJSONArray("levels"),
            )
        }
    }
}

/** 资源表：有序的名称→数值，附带区间裁剪。 */
class Res(private val map: LinkedHashMap<String, Int> = LinkedHashMap()) {
    constructor(start: JSONObject) : this() {
        val keys = start.keys()
        while (keys.hasNext()) { val k = keys.next(); map[k] = start.getInt(k) }
    }
    val keys: Set<String> get() = map.keys
    operator fun get(k: String): Int = map[k] ?: 0
    fun add(effects: JSONObject?) {
        if (effects == null) return
        val it = effects.keys()
        while (it.hasNext()) { val k = it.next(); map[k] = (map[k] ?: 0) + effects.getInt(k) }
    }
    fun clamp(ranges: JSONObject) {
        for (k in map.keys.toList()) {
            val r = ranges.optJSONArray(k) ?: continue
            map[k] = minOf(r.getInt(1), maxOf(r.getInt(0), map[k]!!))
        }
    }
    fun copy(): Res = Res(LinkedHashMap(map))
}

data class LogLine(val kind: String, val text: String)

data class Settle(
    val outcome: String,
    val outcomeTitle: String,
    val systemGrade: String,
    val truthGrade: String,
    val family: Map<String, String>,
    val hiddenLine: String?,
    val note: String?,
    val anchor: String,
    val res: Res,
)

/** 共享的评分工具。 */
object Grade {
    fun bySystem(rules: JSONObject, metric: Int): String {
        val arr = rules.getJSONObject("grades").getJSONArray("system")
        for (i in 0 until arr.length()) {
            val g = arr.getJSONObject(i)
            if (metric >= g.getInt("min")) return g.getString("grade")
        }
        return "D"
    }
    fun systemOverride(rules: JSONObject, outcome: String): String? =
        rules.getJSONObject("grades").optJSONObject("systemOverride")?.let {
            if (it.has(outcome)) it.getString(outcome) else null
        }
    fun truth(rules: JSONObject, outcome: String): String =
        rules.getJSONObject("grades").getJSONObject("truth").optString(outcome, "C")
    fun family(def: JSONObject): Map<String, String> {
        val f = def.optJSONObject("family") ?: return emptyMap()
        return mapOf("haiku" to f.optString("haiku"), "sonnet" to f.optString("sonnet"), "fable" to f.optString("fable"))
    }
}
