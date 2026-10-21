package com.anthropic.huoyan

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.LinearLayout
import android.widget.ScrollView
import androidx.appcompat.app.AppCompatActivity
import com.anthropic.huoyan.Ui.dp

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val d = GameData.get(this)
        val scroll = ScrollView(this).apply { setBackgroundColor(Ui.BG) }
        val col = Ui.column(this).apply { setPadding(dp(16), dp(24), dp(16), dp(24)) }
        scroll.addView(col)
        setContentView(scroll)

        col.addView(Ui.text(this, "🕵️", 48f).apply { gravity = Gravity.CENTER })
        col.addView(Ui.text(this, "火眼金睛", 30f, Ui.TEXT, true).apply { gravity = Gravity.CENTER })
        col.addView(Ui.text(this, "A社临时审核员的赛博养家模拟器", 14f, Ui.MUTED).apply {
            gravity = Gravity.CENTER; setPadding(0, 0, 0, dp(12))
        })

        data class Mode(val key: String, val title: String, val sub: String, val count: Int)
        val modes = listOf(
            Mode("a", "模式A · 抓人", "审核员：拼证据链，别被单一线索骗了", d.levelsA.length()),
            Mode("b", "模式B · 装人", "伪装者：识破诱饵，举报才是正解", d.levelsB.length()),
            Mode("c", "模式C · 拦退款", "退款客服：拦得越狠，监管越近", d.ticketsC.length()),
        )
        for (m in modes) {
            val card = Ui.panel(this)
            card.addView(Ui.text(this, m.title, 17f, Ui.TEXT, true))
            card.addView(Ui.text(this, "${m.sub} · ${m.count} 关", 12f, Ui.MUTED))
            card.setOnClickListener {
                startActivity(Intent(this, LevelListActivity::class.java).putExtra("mode", m.key))
            }
            col.addView(card)
        }

        col.addView(Ui.text(this, "虚构黑色喜剧 · 不采集任何真实系统信息 · 所有设备档案与卡牌均为虚构。现实中订阅退款请遵守平台规则与消费者权益法。", 12f, Ui.MUTED).apply {
            setPadding(0, dp(16), 0, 0)
        })

        showDisclaimer()
    }

    private fun showDisclaimer() {
        AlertDialog.Builder(this)
            .setTitle("火眼金睛 · 12+")
            .setMessage("本游戏不采集任何真实系统信息。所有设备档案均为虚构。\n\n虚构黑色喜剧，含职场压迫、家庭人质隐喻、消费者权益冲突。所有诱饵、回执卡、话术卡均为抽象叙事卡牌，不映射任何现实操作。现实中订阅退款请遵守平台规则与消费者权益法。")
            .setPositiveButton("我已了解") { dlg, _ -> dlg.dismiss() }
            .setCancelable(false)
            .show()
    }
}
