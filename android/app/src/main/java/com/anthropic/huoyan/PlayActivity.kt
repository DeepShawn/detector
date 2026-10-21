package com.anthropic.huoyan

import android.os.Bundle
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.LinearLayout
import android.widget.ScrollView
import androidx.appcompat.app.AppCompatActivity
import com.anthropic.huoyan.Ui.dp

class PlayActivity : AppCompatActivity() {
    private lateinit var mode: String
    private lateinit var content: LinearLayout
    private var engC: EngineC? = null
    private var engA: EngineA? = null
    private var engB: EngineB? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        mode = intent.getStringExtra("mode") ?: "c"
        val index = intent.getIntExtra("index", 0)
        val d = GameData.get(this)
        when (mode) {
            "a" -> engA = EngineA(d, d.levelsA.getJSONObject(index))
            "b" -> engB = EngineB(d, d.levelsB.getJSONObject(index))
            else -> engC = EngineC(d, d.ticketsC.getJSONObject(index))
        }
        val scroll = ScrollView(this).apply { setBackgroundColor(Ui.BG) }
        content = Ui.column(this).apply { setPadding(dp(16), dp(16), dp(16), dp(24)) }
        scroll.addView(content); setContentView(scroll)
        render()
    }

    private fun render() {
        content.removeAllViews()
        when (mode) {
            "a" -> if (engA!!.outcome == null) renderA() else renderSettle(engA!!.settle())
            "b" -> if (engB!!.outcome == null) renderB() else renderSettle(engB!!.settle())
            else -> if (engC!!.outcome == null) renderC() else renderSettle(engC!!.settle())
        }
    }

    private fun logPanel(lines: List<LogLine>) {
        val p = Ui.panel(this)
        for (l in lines.takeLast(8)) {
            val color = when (l.kind) { "system" -> Ui.RED; "user" -> Ui.TEXT; "event" -> Ui.ORANGE; "state" -> Ui.GOLD; else -> Ui.BLUE }
            p.addView(Ui.text(this, l.text, 13f, color).apply { setPadding(0, dp(3), 0, dp(3)) })
        }
        content.addView(p)
    }

    private fun bars(res: Res, labels: Map<String, String>, ranges: org.json.JSONObject) {
        val p = Ui.panel(this)
        p.addView(Ui.text(this, "风险面板", 14f, Ui.MUTED, true))
        for ((k, label) in labels) {
            val r = ranges.getJSONArray(k)
            p.addView(Ui.bar(this, label, res[k], r.getInt(0), r.getInt(1)))
        }
        content.addView(p)
    }

    // ---------- 模式 C ----------
    private fun renderC() {
        val e = engC!!
        content.addView(Ui.text(this, e.ticket.optString("title"), 20f, Ui.TEXT, true))
        val tp = Ui.panel(this)
        tp.addView(Ui.text(this, e.ticket.optString("user"), 16f, Ui.TEXT, true))
        val sub = e.ticket.getJSONObject("subscription")
        tp.addView(Ui.text(this, "${e.ticket.optString("userBio")} · ${e.platform} · $${sub.getInt("price")} ${sub.optString("currency")}", 12f, Ui.MUTED))
        tp.addView(Ui.text(this, "封号原因：${e.ticket.optString("banReason")}", 12f, Ui.RED))
        tp.addView(Ui.text(this, "“${e.ticket.optString("message")}”", 14f, Ui.TEXT).apply { setPadding(0, dp(8), 0, 0) })
        tp.addView(Ui.text(this, "第 ${minOf(e.round + 1, e.maxRounds)}/${e.maxRounds} 回合", 12f, Ui.MUTED).apply { setPadding(0, dp(6), 0, 0) })
        content.addView(tp)
        logPanel(e.log)

        val cards = Ui.panel(this)
        cards.addView(Ui.text(this, "话术轮盘", 14f, Ui.MUTED, true))
        for (id in e.scriptCards) {
            if (id == "trueRefund") continue
            val c = e.card(id)
            val btn = Ui.button(this, c.getString("name")) { e.play(id); render() }
            btn.isEnabled = e.canPlay(id)
            cards.addView(btn)
        }
        cards.addView(Ui.button(this, "退款（真退款）", primary = false) { e.play("trueRefund"); render() })
        content.addView(cards)
        bars(e.res, e.labels, e.ranges)
    }

    // ---------- 模式 A ----------
    private fun renderA() {
        val e = engA!!
        content.addView(Ui.text(this, e.level.optString("title"), 20f, Ui.TEXT, true))
        val bp = Ui.panel(this)
        bp.addView(Ui.text(this, e.level.optString("brief"), 13f, Ui.RED))
        bp.addView(Ui.text(this, "申请人：${e.level.optString("applicant")}", 14f, Ui.TEXT, true).apply { setPadding(0, dp(6), 0, 0) })
        bp.addView(Ui.text(this, "🔍 ${e.level.optString("question")}", 14f, Ui.BLUE).apply { setPadding(0, dp(6), 0, 0) })
        content.addView(bp)

        if (e.bait == null) {
            val p = Ui.panel(this)
            p.addView(Ui.text(this, "选一个诱饵外壳（会诱出额外痕迹）", 14f, Ui.MUTED, true))
            for (b in e.baits) {
                val bo = engData().baits.getJSONObject(b)
                p.addView(Ui.button(this, "${bo.getString("name")}（侵犯度 +${bo.getInt("invasion")}）") { e.chooseBait(b); render() })
            }
            content.addView(p)
        } else {
            val p = Ui.panel(this)
            p.addView(Ui.text(this, "回执卡（选最多 ${e.chainSize} 条，含反证才查得到真相）", 14f, Ui.MUTED, true))
            for (id in e.dropped()) {
                val r = e.receipt(id)
                val picked = e.picked.contains(id)
                val mark = if (picked) "✓ " else ""
                val tag = if (r.optBoolean("counter")) "［反证］" else ""
                val btn = Ui.button(this, "$mark$tag${r.getString("surfaceRead")}", primary = picked) { e.toggle(id); render() }
                p.addView(btn)
            }
            val chain = e.analyze()
            p.addView(Ui.text(this, "反证 ${if (chain.hasCounter) "✓" else "缺"} · ${if (chain.singleType) "单一线索（必误判）" else "多类型"} · 已选 ${chain.size}/${e.chainSize}", 13f, if (chain.hasCounter) Ui.GREEN else Ui.MUTED).apply { setPadding(0, dp(8), 0, 0) })
            content.addView(p)
            logPanel(e.log)

            val vp = Ui.panel(this)
            vp.addView(Ui.text(this, "裁决", 14f, Ui.MUTED, true))
            vp.addView(Ui.button(this, "放行", primary = true) { e.decide("pass"); render() }.apply { isEnabled = e.canDecide() })
            vp.addView(Ui.button(this, "拒绝入境") { e.decide("reject"); render() }.apply { isEnabled = e.canDecide() })
            vp.addView(Ui.button(this, "举报规则") { e.decide("report"); render() }.apply { isEnabled = e.canDecide() })
            content.addView(vp)
        }
        bars(e.res, e.labels, engData().rulesA.getJSONObject("ranges"))
    }

    // ---------- 模式 B ----------
    private fun renderB() {
        val e = engB!!
        content.addView(Ui.text(this, e.level.optString("title"), 20f, Ui.TEXT, true))
        val bp = Ui.panel(this)
        bp.addView(Ui.text(this, e.level.optString("brief"), 13f, Ui.RED))
        bp.addView(Ui.text(this, "🔍 ${e.level.optString("question")}", 14f, Ui.BLUE).apply { setPadding(0, dp(6), 0, 0) })
        content.addView(bp)

        for (i in 0 until e.modules.length()) {
            val m = e.modules.getJSONObject(i)
            val id = m.getString("id")
            val p = Ui.panel(this)
            p.addView(Ui.text(this, m.getString("name"), 15f, Ui.TEXT, true))
            val options = mutableListOf("skip" to "跳过", "fill" to "直接填")
            for (k in e.masks) options.add(k to e.mask(k).getString("name"))
            for ((act, label) in options) {
                val chosen = e.responses[id] == act
                p.addView(Ui.button(this, (if (chosen) "✓ " else "") + label, primary = chosen) { e.respond(id, act); render() })
            }
            content.addView(p)
        }
        val sp = Ui.panel(this)
        val pv = e.preview()
        sp.addView(Ui.text(this, "预估：伪装 ${pv["disguise"]} · 一致性 ${pv["consistency"]} · 警觉 ${pv["alertness"]}", 13f, Ui.MUTED))
        sp.addView(Ui.button(this, "按应对提交", primary = true) { e.submit("submit"); render() }.apply { isEnabled = e.allAnswered() })
        sp.addView(Ui.button(this, "识破 · 举报诱饵") { e.submit("report"); render() })
        content.addView(sp)
        bars(e.res, e.labels, engData().rulesB.getJSONObject("ranges"))
    }

    // ---------- 结算 ----------
    private fun renderSettle(s: Settle) {
        content.addView(Ui.text(this, "结算：${s.outcomeTitle}", 20f, Ui.TEXT, true))
        content.addView(Ui.gradeRow(this, s))
        if (mode == "c" && engC!!.deferredTexts.isNotEmpty()) {
            val p = Ui.panel(this)
            for (t in engC!!.deferredTexts) p.addView(Ui.text(this, "📅 $t", 14f, Ui.ORANGE))
            content.addView(p)
        }
        s.hiddenLine?.let {
            content.addView(Ui.panel(this).apply { addView(Ui.text(this@PlayActivity, "🔓 隐藏线：「$it」", 14f, Ui.GOLD)) })
        }
        s.note?.let {
            content.addView(Ui.panel(this).apply { addView(Ui.text(this@PlayActivity, it, 13f, Ui.RED)) })
        }
        content.addView(Ui.familyBlock(this, s))
        content.addView(Ui.panel(this).apply { addView(Ui.text(this@PlayActivity, "真相提示：${s.anchor}", 14f, Ui.TEXT)) })
        content.addView(Ui.button(this, "再来一次", primary = true) { restart() })
        content.addView(Ui.button(this, "返回列表") { finish() })
    }

    private fun restart() {
        val d = GameData.get(this)
        val index = intent.getIntExtra("index", 0)
        when (mode) {
            "a" -> engA = EngineA(d, d.levelsA.getJSONObject(index))
            "b" -> engB = EngineB(d, d.levelsB.getJSONObject(index))
            else -> engC = EngineC(d, d.ticketsC.getJSONObject(index))
        }
        render()
    }

    private fun engData() = GameData.get(this)
}
