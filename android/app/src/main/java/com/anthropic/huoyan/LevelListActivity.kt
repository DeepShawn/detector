package com.anthropic.huoyan

import android.content.Intent
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.ScrollView
import androidx.appcompat.app.AppCompatActivity
import com.anthropic.huoyan.Ui.dp

class LevelListActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val mode = intent.getStringExtra("mode") ?: "c"
        val d = GameData.get(this)
        val scroll = ScrollView(this).apply { setBackgroundColor(Ui.BG) }
        val col = Ui.column(this).apply { setPadding(dp(16), dp(16), dp(16), dp(24)) }
        scroll.addView(col); setContentView(scroll)

        val titleText = when (mode) { "a" -> "模式A · 抓人"; "b" -> "模式B · 装人"; else -> "模式C · 拦退款" }
        col.addView(Ui.text(this, titleText, 20f, Ui.TEXT, true).apply { setPadding(0, 0, 0, dp(10)) })

        val levels = when (mode) { "a" -> d.levelsA; "b" -> d.levelsB; else -> d.ticketsC }
        for (i in 0 until levels.length()) {
            val lv = levels.getJSONObject(i)
            val title = lv.optString("title")
            val card = Ui.panel(this)
            val row = LinearLayout(this)
            row.addView(Ui.text(this, String.format("%02d", i + 1), 20f, Ui.BLUE, true).apply {
                layoutParams = LinearLayout.LayoutParams(dp(44), LinearLayout.LayoutParams.WRAP_CONTENT)
            })
            row.addView(Ui.text(this, title, 15f, Ui.TEXT, true).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            card.addView(row)
            card.setOnClickListener {
                startActivity(Intent(this, PlayActivity::class.java).putExtra("mode", mode).putExtra("index", i))
            }
            col.addView(card)
        }
    }
}
